from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import current_user
from app.models import DayEntry, Photo, User, Workout
from app.schemas import ProfilePatch, UserOut
from app.storage import Storage, get_storage

router = APIRouter(prefix='/me', tags=['me'])


@router.get('')
async def get_me(user: Annotated[User, Depends(current_user)]) -> UserOut:
    return UserOut.model_validate(user)


@router.patch('')
async def patch_me(
    body: ProfilePatch,
    user: Annotated[User, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    await session.commit()
    return UserOut.model_validate(user)


@router.delete('', status_code=204)
async def delete_me(
    user: Annotated[User, Depends(current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    storage: Annotated[Storage, Depends(get_storage)],
) -> None:
    """Delete the account with all data, including photo files."""
    paths = list(
        (
            await session.execute(
                select(Photo.storage_path)
                .join(Workout, Workout.id == Photo.workout_id)
                .join(DayEntry, DayEntry.id == Workout.entry_id)
                .where(DayEntry.user_id == user.id)
            )
        ).scalars()
    )
    await session.execute(delete(User).where(User.id == user.id))
    await session.commit()
    for path in paths:
        await storage.delete(path)
