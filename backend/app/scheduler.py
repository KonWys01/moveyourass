import asyncio
import logging

from app import clock
from app.db import SessionLocal
from app.push import get_pusher
from app.services.reminders import send_due_reminders

log = logging.getLogger(__name__)


async def reminder_loop(interval: int = 60) -> None:
    while True:
        try:
            async with SessionLocal() as session:
                await send_due_reminders(session, get_pusher(), clock.utcnow())
        except Exception:
            log.exception('reminder tick failed')
        await asyncio.sleep(interval)
