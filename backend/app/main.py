import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.admin import setup_admin
from app.config import get_settings
from app.routers import (
    auth,
    entries,
    feed,
    me,
    meta,
    notifications,
    photos,
    users,
)
from app.scheduler import release_loop, reminder_loop


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    tasks: list[asyncio.Task] = []
    if settings.scheduler_enabled:
        tasks.append(asyncio.create_task(reminder_loop()))
        if settings.release_repo:
            tasks.append(
                asyncio.create_task(
                    release_loop(
                        settings.release_repo,
                        settings.release_check_interval_hours,
                    )
                )
            )
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(title='MoveYourAss', lifespan=lifespan)
app.include_router(auth.router)
app.include_router(me.router)
app.include_router(entries.router)
app.include_router(photos.router)
app.include_router(users.router)
app.include_router(feed.router)
app.include_router(notifications.router)


app.include_router(meta.router)


setup_admin(app)
