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
from app.scheduler import reminder_loop


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None
    if get_settings().scheduler_enabled:
        task = asyncio.create_task(reminder_loop())
    yield
    if task:
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
