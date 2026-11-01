import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.deps import current_user
from app.models import DayEntry, Photo, User, Workout
from app.schemas import PhotoOut
from app.services.images import MAX_BYTES, InvalidImage, process_image
from app.storage import Storage, get_storage

router = APIRouter(tags=['photos'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]
StorageDep = Annotated[Storage, Depends(get_storage)]


async def _own_workout(
    session: AsyncSession, user: User, workout_id: uuid.UUID
) -> Workout:
    result = await session.execute(
        select(Workout)
        .join(DayEntry, DayEntry.id == Workout.entry_id)
        .where(Workout.id == workout_id, DayEntry.user_id == user.id)
        .with_for_update(of=Workout)
        .execution_options(populate_existing=True)
    )
    workout = result.scalar_one_or_none()
    if workout is None:
        raise HTTPException(404, 'Workout not found')
    return workout


@router.post('/workouts/{workout_id}/photos', status_code=201)
async def upload_photo(
    workout_id: uuid.UUID,
    file: UploadFile,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
) -> PhotoOut:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'Image too large')
    try:
        jpeg = process_image(data)
    except InvalidImage:
        raise HTTPException(422, 'Not a valid image') from None

    # Row lock on the workout serializes concurrent uploads, so the
    # per-workout limit cannot be exceeded by a race.
    workout = await _own_workout(session, user, workout_id)
    if len(workout.photos) >= get_settings().max_photos_per_workout:
        raise HTTPException(409, 'Photo limit reached')

    path = f'{user.id}/{workout.id}/{uuid.uuid4()}.jpg'
    await storage.upload(path, jpeg)
    photo = Photo(workout_id=workout.id, storage_path=path)
    session.add(photo)
    try:
        await session.commit()
    except Exception:
        await storage.delete(path)
        raise
    return PhotoOut(id=photo.id, url=await storage.signed_url(path))


@router.delete('/photos/{photo_id}', status_code=204)
async def delete_photo(
    photo_id: uuid.UUID,
    session: Session,
    user: CurrentUser,
    storage: StorageDep,
) -> None:
    result = await session.execute(
        select(Photo)
        .join(Workout, Workout.id == Photo.workout_id)
        .join(DayEntry, DayEntry.id == Workout.entry_id)
        .where(Photo.id == photo_id, DayEntry.user_id == user.id)
    )
    photo = result.scalar_one_or_none()
    if photo is None:
        raise HTTPException(404, 'Photo not found')
    path = photo.storage_path
    await session.delete(photo)
    await session.commit()
    await storage.delete(path)
