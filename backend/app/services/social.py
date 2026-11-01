from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.config import get_settings
from app.models import Comment, DayEntry, Like, User
from app.schemas import SocialEntryOut, StreakOut, UserBrief
from app.services.days import entry_date_for
from app.services.serialize import entry_out
from app.services.streak import compute_streak
from app.storage import Storage


async def streak_stats(session: AsyncSession, user: User) -> StreakOut:
    today: date = entry_date_for(
        clock.utcnow(), user.timezone, get_settings().day_buffer_end_hour
    )
    result = await session.execute(
        select(DayEntry.date, DayEntry.status).where(
            DayEntry.user_id == user.id
        )
    )
    statuses = {d: s.value for d, s in result.all()}
    info = compute_streak(statuses, today, user.streak_threshold)
    return StreakOut(
        streak=info.streak,
        week_progress=info.week_progress,
        week_threshold=info.week_threshold,
    )


async def social_entries(
    session: AsyncSession,
    viewer: User,
    entries: list[DayEntry],
    storage: Storage,
) -> list[SocialEntryOut]:
    """Entries with owner, like/comment counts. Caller checked access."""
    if not entries:
        return []
    ids = [e.id for e in entries]
    likes = dict(
        (
            await session.execute(
                select(Like.entry_id, func.count())
                .where(Like.entry_id.in_(ids))
                .group_by(Like.entry_id)
            )
        ).all()
    )
    comments = dict(
        (
            await session.execute(
                select(Comment.entry_id, func.count())
                .where(Comment.entry_id.in_(ids))
                .group_by(Comment.entry_id)
            )
        ).all()
    )
    mine = set(
        (
            await session.execute(
                select(Like.entry_id).where(
                    Like.user_id == viewer.id, Like.entry_id.in_(ids)
                )
            )
        ).scalars()
    )
    owners = {
        u.id: u
        for u in (
            await session.execute(
                select(User).where(User.id.in_({e.user_id for e in entries}))
            )
        ).scalars()
    }
    out = []
    for e in entries:
        base = await entry_out(e, storage)
        out.append(
            SocialEntryOut(
                **base.model_dump(),
                user=UserBrief.model_validate(owners[e.user_id]),
                like_count=likes.get(e.id, 0),
                liked_by_me=e.id in mine,
                comment_count=comments.get(e.id, 0),
            )
        )
    return out
