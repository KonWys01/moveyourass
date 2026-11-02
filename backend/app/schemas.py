import uuid
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _check_timezone(value: str | None) -> str | None:
    if value is None:
        return value
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise ValueError('Unknown IANA timezone') from None
    return value


class GoogleLoginIn(BaseModel):
    id_token: str
    is_public: bool | None = None
    timezone: str | None = None

    _tz = field_validator('timezone')(_check_timezone)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    avatar_url: str | None
    is_public: bool
    timezone: str
    streak_threshold: int
    is_admin: bool


class TokenOut(BaseModel):
    access_token: str
    is_new_user: bool
    user: UserOut


class ProfilePatch(BaseModel):
    is_public: bool | None = None
    timezone: str | None = None
    streak_threshold: int | None = Field(default=None, ge=1, le=7)

    _tz = field_validator('timezone')(_check_timezone)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class WorkoutIn(BaseModel):
    category_id: int
    description: str | None = Field(default=None, max_length=500)


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: CategoryOut
    description: str | None


class DayEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    status: str
    workouts: list[WorkoutOut]


class TodayOut(BaseModel):
    date: date
    entry: DayEntryOut | None
    streak: int
    week_progress: int
    week_threshold: int
    days_since_workout: int | None
    show_rest_hint: bool
