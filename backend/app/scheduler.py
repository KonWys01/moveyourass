import asyncio
import logging

import httpx

from app import clock
from app.db import SessionLocal
from app.push import get_pusher
from app.services.releases import sync_latest_release
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


async def release_loop(repo: str, interval_hours: float) -> None:
    """Checks GitHub Releases at startup and then every N hours."""
    async with httpx.AsyncClient(timeout=15) as client:
        while True:
            try:
                async with SessionLocal() as session:
                    new = await sync_latest_release(session, client, repo)
                if new:
                    log.info('app version updated from GitHub: %s', new)
            except Exception:
                log.exception('release check failed')
            await asyncio.sleep(interval_hours * 3600)
