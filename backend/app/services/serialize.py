import asyncio

from app.models import DayEntry, Workout
from app.schemas import DayEntryOut, WorkoutOut
from app.storage import Storage


async def entry_out(entry: DayEntry, storage: Storage) -> DayEntryOut:
    """Serialize an entry with freshly signed photo URLs."""
    out = DayEntryOut.model_validate(entry)
    jobs = []
    for w_orm, w_out in zip(entry.workouts, out.workouts, strict=True):
        for p_orm, p_out in zip(w_orm.photos, w_out.photos, strict=True):
            jobs.append((p_out, storage.signed_url(p_orm.storage_path)))
    urls = await asyncio.gather(*(j[1] for j in jobs))
    for (p_out, _), url in zip(jobs, urls, strict=True):
        p_out.url = url
    return out


async def workout_out(workout: Workout, storage: Storage) -> WorkoutOut:
    out = WorkoutOut.model_validate(workout)
    urls = await asyncio.gather(
        *(storage.signed_url(p.storage_path) for p in workout.photos)
    )
    for p_out, url in zip(out.photos, urls, strict=True):
        p_out.url = url
    return out
