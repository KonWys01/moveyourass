import logging
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DeviceToken, NotificationPrefs, User
from app.models.notification import KINDS
from app.push import Pusher

log = logging.getLogger(__name__)


async def notify(
    session: AsyncSession,
    pusher: Pusher,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> bool:
    """Send one push if the user wants this kind. Never raises:
    a push failure must not fail the request that triggered it."""
    assert kind in KINDS
    try:
        user = await session.get(User, user_id)
        if user is None or user.is_blocked:
            return False
        prefs = await session.get(NotificationPrefs, user_id)
        if prefs is not None and not getattr(prefs, kind):
            return False
        tokens = list(
            (
                await session.execute(
                    select(DeviceToken.token).where(
                        DeviceToken.user_id == user_id
                    )
                )
            ).scalars()
        )
        if not tokens:
            return False
        payload = {'kind': kind, **(data or {})}
        dead = await pusher.send(tokens, title, body, payload)
        if dead:
            await session.execute(
                delete(DeviceToken).where(DeviceToken.token.in_(dead))
            )
            await session.commit()
        return True
    except Exception:
        log.exception('push failed (kind=%s)', kind)
        return False
