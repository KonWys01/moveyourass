import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    DayEntry,
    DeviceToken,
    NotificationPrefs,
    ReminderLog,
    User,
)
from app.push import Pusher
from app.services.notify import notify

log = logging.getLogger(__name__)


async def send_due_reminders(
    session: AsyncSession, pusher: Pusher, now_utc: datetime
) -> int:
    """Remind users whose local time is within the reminder window.

    Window (default 20:00-21:59 local) instead of an exact minute, so a
    restart or slow tick does not skip the day. The ReminderLog insert
    is the send-once guard across containers. Users with an entry for
    today are skipped.
    """
    s = get_settings()
    users = (
        await session.execute(
            select(User)
            .join(DeviceToken, DeviceToken.user_id == User.id)
            .where(User.is_blocked.is_(False))
            .distinct()
        )
    ).scalars()
    sent = 0
    for user in list(users):
        local = now_utc.astimezone(ZoneInfo(user.timezone))
        if not (
            s.reminder_hour
            <= local.hour
            < s.reminder_hour + s.reminder_window_hours
        ):
            continue
        prefs = await session.get(NotificationPrefs, user.id)
        if prefs is not None and not prefs.reminder:
            continue
        has_entry = (
            await session.execute(
                select(DayEntry.id).where(
                    DayEntry.user_id == user.id,
                    DayEntry.date == local.date(),
                )
            )
        ).first()
        if has_entry:
            continue
        claimed = await session.execute(
            pg_insert(ReminderLog)
            .values(user_id=user.id, day=local.date())
            .on_conflict_do_nothing()
        )
        await session.commit()
        if claimed.rowcount == 0:
            continue
        if await notify(
            session,
            pusher,
            user.id,
            'reminder',
            'MoveYourAss',
            'Dziś jeszcze bez wpisu. Rusz się i potwierdź zdjęciem!',
        ):
            sent += 1
    return sent
