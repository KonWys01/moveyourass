import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.config import get_settings
from app.db import get_session
from app.deps import current_user
from app.models import Category, DayEntry, EntryStatus, User, Workout
from app.models.entry import STATUS_RANK
from app.schemas import (
    CategoryOut,
    DayEntryOut,
    TodayOut,
    WorkoutIn,
)
from app.services.days import entry_date_for
from app.services.streak import compute_streak

router = APIRouter(tags=['entries'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]


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
    body: WorkoutIn, session: Session, user: CurrentUser
) -> DayEntryOut:
    category = await session.get(Category, body.category_id)
    if category is None or not category.is_active:
        raise HTTPException(422, 'Unknown category')
    entry = await _get_or_create_entry(
        session, user, _today(user), EntryStatus.workout
    )
    session.add(
        Workout(
            entry_id=entry.id,
            category_id=category.id,
            description=body.description,
        )
    )
    await session.commit()
    await session.refresh(entry, ['workouts'])
    return DayEntryOut.model_validate(entry)


async def _mark(
    session: AsyncSession, user: User, status: EntryStatus
) -> DayEntryOut:
    entry = await _get_or_create_entry(session, user, _today(user), status)
    await session.commit()
    return DayEntryOut.model_validate(entry)


@router.post('/entries/rest', status_code=201)
async def mark_rest(session: Session, user: CurrentUser) -> DayEntryOut:
    return await _mark(session, user, EntryStatus.rest)


@router.post('/entries/sick', status_code=201)
async def mark_sick(session: Session, user: CurrentUser) -> DayEntryOut:
    return await _mark(session, user, EntryStatus.sick)


@router.get('/entries/today')
async def today(session: Session, user: CurrentUser) -> TodayOut:
    day = _today(user)
    result = await session.execute(
        select(DayEntry).where(DayEntry.user_id == user.id)
    )
    entries = list(result.scalars())
    statuses = {e.date: e.status.value for e in entries}
    info = compute_streak(statuses, day, user.streak_threshold)
    workout_days = [e.date for e in entries if e.status == 'workout']
    since = (day - max(workout_days)).days if workout_days else None
    hint_after = get_settings().rest_hint_days
    return TodayOut(
        date=day,
        entry=next((e for e in entries if e.date == day), None),
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
    limit: int = 30,
    offset: int = 0,
) -> list[DayEntryOut]:
    result = await session.execute(
        select(DayEntry)
        .where(DayEntry.user_id == user.id)
        .order_by(DayEntry.date.desc())
        .limit(min(max(limit, 1), 100))
        .offset(max(offset, 0))
    )
    return [DayEntryOut.model_validate(e) for e in result.scalars()]
