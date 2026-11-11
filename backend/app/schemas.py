import uuid
from datetime import date, datetime
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


class WorkoutPatch(BaseModel):
    category_id: int | None = None
    description: str | None = Field(default=None, max_length=500)


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str | None = None


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: CategoryOut
    description: str | None
    photos: list[PhotoOut] = []


class DayEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    created_at: datetime
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
    like_count: int = 0
    comment_count: int = 0


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    avatar_url: str | None
    is_public: bool


class UserSearchOut(UserBrief):
    follow_status: str


class StreakOut(BaseModel):
    streak: int
    week_progress: int
    week_threshold: int


class ProfileOut(UserSearchOut):
    can_view: bool
    stats: StreakOut | None = None


class FollowOut(BaseModel):
    status: str


class SocialEntryOut(DayEntryOut):
    user: UserBrief
    like_count: int
    liked_by_me: bool
    comment_count: int


class FeedItemOut(SocialEntryOut):
    stats: StreakOut


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: uuid.UUID
    user: UserBrief
    text: str
    created_at: datetime


class MonthStats(BaseModel):
    workouts: int
    active_days: int


class WeekBar(BaseModel):
    week_start: date
    days: int


class CategoryCount(BaseModel):
    name: str
    count: int


class BadgeOut(BaseModel):
    id: str
    icon: str
    title: str
    description: str
    earned: bool
    progress: int
    target: int


class StatsOut(BaseModel):
    total_workouts: int
    active_days: int
    total_photos: int
    this_month: MonthStats
    current_streak: int
    longest_streak: int
    best_week_days: int
    weeks: list[WeekBar]
    categories: list[CategoryCount]
    badges: list[BadgeOut]


class CalendarDay(BaseModel):
    date: date
    status: str
    entry_id: uuid.UUID
    workouts: int
    photos: int


class CalendarOut(BaseModel):
    month: str
    days: list[CalendarDay]
