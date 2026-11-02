import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import current_user
from app.models import (
    Comment,
    DayEntry,
    EntryStatus,
    Follow,
    FollowStatus,
    Like,
    User,
)
from app.push import Pusher, get_pusher
from app.schemas import (
    CommentIn,
    CommentOut,
    FeedItemOut,
    SocialEntryOut,
    UserBrief,
)
from app.services.access import can_view
from app.services.notify import notify
from app.services.social import social_entries, streak_stats
from app.storage import Storage, get_storage

router = APIRouter(tags=['feed'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]
StorageDep = Annotated[Storage, Depends(get_storage)]
PusherDep = Annotated[Pusher, Depends(get_pusher)]


@router.get('/feed')
async def feed(
    session: Session,
    me: CurrentUser,
    storage: StorageDep,
    limit: int = 20,
    before: datetime | None = None,
) -> list[FeedItemOut]:
    """Workout entries of accepted followees, newest first.

    Only positives are shown (no rest/sick, no 'who did not train').
    Cursor: pass the created_at of the last item's entry as ``before``.
    """
    query = (
        select(DayEntry)
        .join(
            Follow,
            (Follow.followee_id == DayEntry.user_id)
            & (Follow.follower_id == me.id)
            & (Follow.status == FollowStatus.accepted),
        )
        .join(User, User.id == DayEntry.user_id)
        .where(
            DayEntry.status == EntryStatus.workout,
            User.is_blocked.is_(False),
        )
        .order_by(DayEntry.created_at.desc(), DayEntry.id)
        .limit(min(max(limit, 1), 50))
    )
    if before is not None:
        query = query.where(DayEntry.created_at < before)
    entries = list((await session.execute(query)).scalars())
    social = await social_entries(session, me, entries, storage)
    stats = {}
    items = []
    for item in social:
        if item.user.id not in stats:
            owner = await session.get(User, item.user.id)
            stats[item.user.id] = await streak_stats(session, owner)
        items.append(
            FeedItemOut(**item.model_dump(), stats=stats[item.user.id])
        )
    return items


async def _viewable_entry(
    session: AsyncSession, me: User, entry_id: uuid.UUID
) -> DayEntry:
    entry = await session.get(DayEntry, entry_id)
    owner = await session.get(User, entry.user_id) if entry else None
    if (
        entry is None
        or owner is None
        or not await can_view(session, me, owner)
    ):
        # 404 for both missing and forbidden: do not leak existence.
        raise HTTPException(404, 'Entry not found')
    return entry


@router.get('/entries/{entry_id}')
async def get_entry(
    entry_id: uuid.UUID,
    session: Session,
    me: CurrentUser,
    storage: StorageDep,
) -> SocialEntryOut:
    entry = await _viewable_entry(session, me, entry_id)
    return (await social_entries(session, me, [entry], storage))[0]


@router.post('/entries/{entry_id}/like', status_code=204)
async def like(
    entry_id: uuid.UUID,
    session: Session,
    me: CurrentUser,
    pusher: PusherDep,
) -> None:
    entry = await _viewable_entry(session, me, entry_id)
    result = await session.execute(
        pg_insert(Like)
        .values(user_id=me.id, entry_id=entry.id)
        .on_conflict_do_nothing(index_elements=['user_id', 'entry_id'])
    )
    await session.commit()
    # Only a new like notifies (repeated taps stay silent).
    if result.rowcount and entry.user_id != me.id:
        await notify(
            session,
            pusher,
            entry.user_id,
            'like',
            'Nowy lajk',
            f'{me.first_name} polubił(a) Twój wpis',
            {'entry_id': str(entry.id)},
        )


@router.delete('/entries/{entry_id}/like', status_code=204)
async def unlike(
    entry_id: uuid.UUID, session: Session, me: CurrentUser
) -> None:
    await session.execute(
        delete(Like).where(Like.user_id == me.id, Like.entry_id == entry_id)
    )
    await session.commit()


@router.get('/entries/{entry_id}/comments')
async def list_comments(
    entry_id: uuid.UUID, session: Session, me: CurrentUser
) -> list[CommentOut]:
    entry = await _viewable_entry(session, me, entry_id)
    result = await session.execute(
        select(Comment, User)
        .join(User, User.id == Comment.user_id)
        .where(Comment.entry_id == entry.id)
        .order_by(Comment.created_at)
    )
    return [
        CommentOut(
            id=c.id,
            user=UserBrief.model_validate(u),
            text=c.text,
            created_at=c.created_at,
        )
        for c, u in result.all()
    ]


@router.post('/entries/{entry_id}/comments', status_code=201)
async def add_comment(
    entry_id: uuid.UUID,
    body: CommentIn,
    session: Session,
    me: CurrentUser,
    pusher: PusherDep,
) -> CommentOut:
    entry = await _viewable_entry(session, me, entry_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(422, 'Empty comment')
    comment = Comment(entry_id=entry.id, user_id=me.id, text=text)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    if entry.user_id != me.id:
        await notify(
            session,
            pusher,
            entry.user_id,
            'comment',
            'Nowy komentarz',
            f'{me.first_name}: {comment.text[:80]}',
            {'entry_id': str(entry.id)},
        )
    return CommentOut(
        id=comment.id,
        user=UserBrief.model_validate(me),
        text=comment.text,
        created_at=comment.created_at,
    )


@router.delete('/comments/{comment_id}', status_code=204)
async def delete_comment(
    comment_id: uuid.UUID, session: Session, me: CurrentUser
) -> None:
    """Author or the entry's owner may delete."""
    comment = await session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(404, 'Comment not found')
    entry = await session.get(DayEntry, comment.entry_id)
    if me.id not in (comment.user_id, entry.user_id):
        raise HTTPException(403, 'Not allowed')
    await session.delete(comment)
    await session.commit()
