import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.photo import Photo


class EntryStatus(enum.StrEnum):
    workout = 'workout'
    rest = 'rest'
    sick = 'sick'


# workout beats sick beats rest
STATUS_RANK = {
    EntryStatus.rest: 0,
    EntryStatus.sick: 1,
    EntryStatus.workout: 2,
}


class Category(Base):
    __tablename__ = 'categories'

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    def __str__(self) -> str:
        return self.name


class DayEntry(Base):
    __tablename__ = 'day_entries'
    __table_args__ = (UniqueConstraint('user_id', 'date'),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), index=True
    )
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[EntryStatus] = mapped_column(
        Enum(EntryStatus, native_enum=False, length=16)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    workouts: Mapped[list['Workout']] = relationship(
        back_populates='entry',
        order_by='Workout.created_at',
        lazy='selectin',
        cascade='all, delete-orphan',
    )


class Workout(Base):
    __tablename__ = 'workouts'

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey('day_entries.id', ondelete='CASCADE'), index=True
    )
    category_id: Mapped[int] = mapped_column(ForeignKey('categories.id'))
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    entry: Mapped[DayEntry] = relationship(back_populates='workouts')
    photos: Mapped[list['Photo']] = relationship(
        order_by='Photo.created_at',
        lazy='selectin',
        cascade='all, delete-orphan',
    )
    category: Mapped[Category] = relationship(lazy='joined')
