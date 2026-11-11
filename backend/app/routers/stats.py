import re
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.config import get_settings
from app.db import get_session
from app.deps import current_user
from app.models import Category, DayEntry, Photo, User, Workout
from app.schemas import (
    BadgeOut,
    CalendarDay,
    CalendarOut,
    CategoryCount,
    MonthStats,
    StatsOut,
    WeekBar,
)
from app.services.days import entry_date_for
from app.services.stats import (
    badge_progress,
    best_week_days,
    longest_streak,
    weekly_days,
)
from app.services.streak import compute_streak

router = APIRouter(prefix='/me', tags=['stats'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]

WEEKS = 12


def _today(user: User) -> date:
    return entry_date_for(
        clock.utcnow(), user.timezone, get_settings().day_buffer_end_hour
    )


@router.get('/stats')
async def my_stats(session: Session, user: CurrentUser) -> StatsOut:
    today = _today(user)
    entries = (
        await session.execute(
            select(DayEntry.date, DayEntry.status).where(
                DayEntry.user_id == user.id
            )
        )
    ).all()
    statuses = {d: s.value for d, s in entries}
    workout_days = {d for d, s in statuses.items() if s == 'workout'}

    kinds = (
        await session.execute(
            select(Category.name, DayEntry.date)
            .select_from(Workout)
            .join(DayEntry, DayEntry.id == Workout.entry_id)
            .join(Category, Category.id == Workout.category_id)
            .where(DayEntry.user_id == user.id)
        )
    ).all()
    by_category: dict[str, int] = {}
    for name, _ in kinds:
        by_category[name] = by_category.get(name, 0) + 1
    month = (today.year, today.month)
    month_workouts = sum(1 for _, d in kinds if (d.year, d.month) == month)
    month_days = sum(1 for d in workout_days if (d.year, d.month) == month)

    photos = (
        await session.scalar(
            select(func.count(Photo.id))
            .select_from(Photo)
            .join(Workout, Workout.id == Photo.workout_id)
            .join(DayEntry, DayEntry.id == Workout.entry_id)
            .where(DayEntry.user_id == user.id)
        )
    ) or 0

    streak = compute_streak(statuses, today, user.streak_threshold).streak
    longest = max(
        longest_streak(statuses, today, user.streak_threshold), streak
    )
    best_week = best_week_days(statuses)
    metrics = {
        'workouts': len(kinds),
        'days': len(workout_days),
        'streak': longest,
        'week': best_week,
        'kinds': len(by_category),
        'photos': photos,
    }
    return StatsOut(
        total_workouts=len(kinds),
        active_days=len(workout_days),
        total_photos=photos,
        this_month=MonthStats(workouts=month_workouts, active_days=month_days),
        current_streak=streak,
        longest_streak=longest,
        best_week_days=best_week,
        weeks=[
            WeekBar(week_start=m, days=n)
            for m, n in weekly_days(statuses, today, WEEKS)
        ],
        categories=[
            CategoryCount(name=n, count=c)
            for n, c in sorted(
                by_category.items(), key=lambda kv: (-kv[1], kv[0])
            )
        ],
        badges=[BadgeOut(**b) for b in badge_progress(metrics)],
    )


@router.get('/calendar')
async def my_calendar(
    session: Session, user: CurrentUser, month: str | None = None
) -> CalendarOut:
    if month is None:
        today = _today(user)
        year, mon = today.year, today.month
    else:
        if not re.fullmatch(r'\d{4}-\d{2}', month):
            raise HTTPException(422, 'month must be YYYY-MM')
        year, mon = int(month[:4]), int(month[5:])
        if not 1 <= mon <= 12 or year < 2000:
            raise HTTPException(422, 'month must be YYYY-MM')
    start = date(year, mon, 1)
    end = date(year + (mon == 12), mon % 12 + 1, 1)
    entries = (
        (
            await session.execute(
                select(DayEntry)
                .where(
                    DayEntry.user_id == user.id,
                    DayEntry.date >= start,
                    DayEntry.date < end,
                )
                .order_by(DayEntry.date)
            )
        )
        .scalars()
        .all()
    )
    return CalendarOut(
        month=f'{year:04d}-{mon:02d}',
        days=[
            CalendarDay(
                date=e.date,
                status=e.status.value,
                entry_id=e.id,
                workouts=len(e.workouts),
                photos=sum(len(w.photos) for w in e.workouts),
            )
            for e in entries
        ],
    )
