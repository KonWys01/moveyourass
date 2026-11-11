import logging
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.config import get_settings
from app.db import get_session
from app.deps import current_user
from app.models import (
    Category,
    DayEntry,
    EntryStatus,
    Follow,
    FollowStatus,
    User,
    Workout,
)
from app.models.entry import STATUS_RANK
from app.push import Pusher, get_pusher
from app.schemas import (
    CategoryOut,
    DayEntryOut,
    SocialEntryOut,
    TodayOut,
    WorkoutIn,
    WorkoutOut,
    WorkoutPatch,
)
from app.services.days import entry_date_for
from app.services.notify import notify
from app.services.serialize import entry_out, workout_out
from app.services.social import social_entries
from app.services.streak import compute_streak
from app.storage import Storage, get_storage

log = logging.getLogger(__name__)
router = APIRouter(tags=['entries'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]
StorageDep = Annotated[Storage, Depends(get_storage)]
PusherDep = Annotated[Pusher, Depends(get_pusher)]


def _today(user: User) -> date:
    return entry_date_for(
        clock.utcnow(), user.timezone, get_settings().day_buffer_end_hour
    )


async def _get_or_create_entry(
    session: AsyncSession, user: User, day: date, status: EntryStatus
) -> DayEntry:
    """Race-safe: unique(user, date) + ON CONFLICT DO NOTHING."""
    await session.execute(
        pg_insert(DayEntry)
        .values(id=uuid.uuid4(), user_id=user.id, date=day, status=status)
        .on_conflict_do_nothing(index_elements=['user_id', 'date'])
    )
    result = await session.execute(
        select(DayEntry)
        .where(DayEntry.user_id == user.id, DayEntry.date == day)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    entry = result.scalar_one()
    if STATUS_RANK[status] > STATUS_RANK[entry.status]:
        entry.status = status
    return entry


@router.get('/categories')
async def list_categories(
    session: Session, _: CurrentUser
) -> list[CategoryOut]:
    result = await session.execute(
        select(Category)
        .where(Category.is_active)
        .order_by(Category.sort_order, Category.name)
    )
    return [CategoryOut.model_validate(c) for c in result.scalars()]


@router.post('/entries/workouts', status_code=201)
async def add_workout(
    body: WorkoutIn,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
    pusher: PusherDep,
) -> DayEntryOut:
    category = await session.get(Category, body.category_id)
    if category is None or not category.is_active:
        raise HTTPException(422, 'Unknown category')
    entry = await _get_or_create_entry(
        session, user, _today(user), EntryStatus.workout
    )
    first_of_day = not entry.workouts
    session.add(
        Workout(
            entry_id=entry.id,
            category_id=category.id,
            description=body.description,
        )
    )
    await session.commit()
    await session.refresh(entry, ['workouts'])
    if first_of_day:
        await _notify_followers(session, pusher, user, entry, category)
    return await entry_out(entry, storage)


async def _notify_followers(
    session: AsyncSession,
    pusher: Pusher,
    user: User,
    entry: DayEntry,
    category: Category,
) -> None:
    """One push per day per follower: the first workout of the day.
    Only accepted followers (a pending request must not see activity)."""
    ids = list(
        (
            await session.execute(
                select(Follow.follower_id).where(
                    Follow.followee_id == user.id,
                    Follow.status == FollowStatus.accepted,
                )
            )
        ).scalars()
    )
    for follower_id in ids:
        await notify(
            session,
            pusher,
            follower_id,
            'new_activity',
            'Nowy trening',
            f'{user.first_name} {user.last_name} dodał(a) trening: '
            f'{category.name}',
            {'entry_id': str(entry.id), 'user_id': str(user.id)},
        )


async def _mark(
    session: AsyncSession,
    user: User,
    status: EntryStatus,
    storage: Storage,
) -> DayEntryOut:
    entry = await _get_or_create_entry(session, user, _today(user), status)
    await session.commit()
    return await entry_out(entry, storage)


@router.post('/entries/rest', status_code=201)
async def mark_rest(
    session: Session, user: CurrentUser, storage: StorageDep
) -> DayEntryOut:
    return await _mark(session, user, EntryStatus.rest, storage)


@router.post('/entries/sick', status_code=201)
async def mark_sick(
    session: Session, user: CurrentUser, storage: StorageDep
) -> DayEntryOut:
    return await _mark(session, user, EntryStatus.sick, storage)


@router.get('/entries/today')
async def today(
    session: Session, user: CurrentUser, storage: StorageDep
) -> TodayOut:
    day = _today(user)
    result = await session.execute(
        select(DayEntry).where(DayEntry.user_id == user.id)
    )
    entries = list(result.scalars())
    statuses = {e.date: e.status.value for e in entries}
    todays = next((e for e in entries if e.date == day), None)
    info = compute_streak(statuses, day, user.streak_threshold)
    workout_days = [e.date for e in entries if e.status == 'workout']
    since = (day - max(workout_days)).days if workout_days else None
    hint_after = get_settings().rest_hint_days
    return TodayOut(
        date=day,
        entry=(
            await entry_out(todays, storage) if todays is not None else None
        ),
        streak=info.streak,
        week_progress=info.week_progress,
        week_threshold=info.week_threshold,
        days_since_workout=since,
        show_rest_hint=(since is None or since >= hint_after)
        and statuses.get(day) is None,
    )


@router.get('/entries/me')
async def my_entries(
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
    limit: int = 30,
    offset: int = 0,
) -> list[SocialEntryOut]:
    """Own history, with like/comment counts like everywhere else."""
    result = await session.execute(
        select(DayEntry)
        .where(DayEntry.user_id == user.id)
        .order_by(DayEntry.date.desc())
        .limit(min(max(limit, 1), 100))
        .offset(max(offset, 0))
    )
    return await social_entries(session, user, list(result.scalars()), storage)


async def _own_workout(
    session: AsyncSession, user: User, workout_id: uuid.UUID
) -> Workout:
    result = await session.execute(
        select(Workout)
        .join(DayEntry, DayEntry.id == Workout.entry_id)
        .where(Workout.id == workout_id, DayEntry.user_id == user.id)
        .with_for_update(of=Workout)
        .execution_options(populate_existing=True)
    )
    workout = result.scalar_one_or_none()
    if workout is None:
        raise HTTPException(404, 'Workout not found')
    return workout


async def _remove_files(storage: Storage, paths: list[str]) -> None:
    """Best effort, after the DB commit: an orphan file is harmless, a
    failed request after the rows are gone would not be."""
    for path in paths:
        try:
            await storage.delete(path)
        except Exception:
            log.exception('could not delete %s from storage', path)


@router.patch('/workouts/{workout_id}')
async def edit_workout(
    workout_id: uuid.UUID,
    body: WorkoutPatch,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
) -> WorkoutOut:
    workout = await _own_workout(session, user, workout_id)
    fields = body.model_fields_set
    if 'category_id' in fields and body.category_id is not None:
        category = await session.get(Category, body.category_id)
        if category is None or not category.is_active:
            raise HTTPException(422, 'Unknown category')
        workout.category_id = category.id
    if 'description' in fields:
        workout.description = body.description
    await session.commit()
    await session.refresh(workout, ['category', 'photos'])
    return await workout_out(workout, storage)


@router.delete('/workouts/{workout_id}', status_code=204)
async def delete_workout(
    workout_id: uuid.UUID,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
) -> None:
    workout = await _own_workout(session, user, workout_id)
    paths = [p.storage_path for p in workout.photos]
    siblings = await session.scalar(
        select(func.count())
        .select_from(Workout)
        .where(Workout.entry_id == workout.entry_id)
    )
    if siblings <= 1:
        # last workout of the day: the day entry itself goes too
        await session.delete(await session.get(DayEntry, workout.entry_id))
    else:
        await session.delete(workout)
    await session.commit()
    await _remove_files(storage, paths)


@router.delete('/entries/{entry_id}', status_code=204)
async def delete_entry(
    entry_id: uuid.UUID,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
) -> None:
    entry = await session.get(DayEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(404, 'Entry not found')
    paths = [p.storage_path for w in entry.workouts for p in w.photos]
    await session.delete(entry)
    await session.commit()
    await _remove_files(storage, paths)
