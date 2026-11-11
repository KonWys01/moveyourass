import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

KINDS = (
    'reminder',
    'like',
    'comment',
    'follow_request',
    'new_follower',
    'request_accepted',
    'new_activity',
)


class DeviceToken(Base):
    __tablename__ = 'device_tokens'

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class NotificationPrefs(Base):
    __tablename__ = 'notification_prefs'

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), primary_key=True
    )
    reminder: Mapped[bool] = mapped_column(Boolean, default=True)
    like: Mapped[bool] = mapped_column(Boolean, default=True)
    comment: Mapped[bool] = mapped_column(Boolean, default=True)
    follow_request: Mapped[bool] = mapped_column(Boolean, default=True)
    new_follower: Mapped[bool] = mapped_column(Boolean, default=True)
    request_accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    new_activity: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true()
    )


class ReminderLog(Base):
    """One row per user per local day: makes the reminder send-once,
    even with several backend containers running."""

    __tablename__ = 'reminder_log'

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
