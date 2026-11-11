from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import current_user
from app.models import DeviceToken, NotificationPrefs, User

router = APIRouter(tags=['notifications'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=4096)


class PrefsOut(BaseModel):
    reminder: bool = True
    like: bool = True
    comment: bool = True
    follow_request: bool = True
    new_follower: bool = True
    request_accepted: bool = True
    new_activity: bool = True


class PrefsPatch(BaseModel):
    reminder: bool | None = None
    like: bool | None = None
    comment: bool | None = None
    follow_request: bool | None = None
    new_follower: bool | None = None
    request_accepted: bool | None = None
    new_activity: bool | None = None


@router.post('/devices', status_code=204)
async def register_device(
    body: DeviceIn, session: Session, me: CurrentUser
) -> None:
    """Upsert; a token moves to whoever logged in on the device last."""
    stmt = pg_insert(DeviceToken).values(token=body.token, user_id=me.id)
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=['token'], set_={'user_id': me.id}
        )
    )
    await session.commit()


@router.delete('/devices/{token}', status_code=204)
async def unregister_device(
    token: str, session: Session, me: CurrentUser
) -> None:
    await session.execute(
        delete(DeviceToken).where(
            DeviceToken.token == token, DeviceToken.user_id == me.id
        )
    )
    await session.commit()


@router.get('/me/notifications')
async def get_prefs(session: Session, me: CurrentUser) -> PrefsOut:
    prefs = await session.get(NotificationPrefs, me.id)
    return (
        PrefsOut.model_validate(prefs, from_attributes=True)
        if prefs
        else PrefsOut()
    )


@router.patch('/me/notifications')
async def patch_prefs(
    body: PrefsPatch, session: Session, me: CurrentUser
) -> PrefsOut:
    await session.execute(
        pg_insert(NotificationPrefs)
        .values(user_id=me.id)
        .on_conflict_do_nothing(index_elements=['user_id'])
    )
    prefs = await session.get(NotificationPrefs, me.id, populate_existing=True)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(prefs, field, value)
    await session.commit()
    return PrefsOut.model_validate(prefs, from_attributes=True)
