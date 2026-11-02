import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import current_user
from app.models import DayEntry, Follow, FollowStatus, User
from app.schemas import (
    FollowOut,
    ProfileOut,
    SocialEntryOut,
    UserBrief,
    UserSearchOut,
)
from app.services.access import can_view, follow_status
from app.services.social import social_entries, streak_stats
from app.storage import Storage, get_storage

router = APIRouter(tags=['users'])

Session = Annotated[AsyncSession, Depends(get_session)]
CurrentUser = Annotated[User, Depends(current_user)]
StorageDep = Annotated[Storage, Depends(get_storage)]


async def _visible_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None or user.is_blocked:
        raise HTTPException(404, 'User not found')
    return user


def _like_escape(q: str) -> str:
    return q.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


@router.get('/users/search')
async def search_users(
    q: str, session: Session, me: CurrentUser
) -> list[UserSearchOut]:
    q = q.strip()
    if len(q) < 2:
        return []
    pattern = f'%{_like_escape(q)}%'
    result = await session.execute(
        select(User)
        .where(
            User.id != me.id,
            User.is_blocked.is_(False),
            or_(
                User.first_name.ilike(pattern, escape='\\'),
                User.last_name.ilike(pattern, escape='\\'),
                (User.first_name + ' ' + User.last_name).ilike(
                    pattern, escape='\\'
                ),
            ),
        )
        .order_by(User.first_name, User.last_name)
        .limit(30)
    )
    out = []
    for u in result.scalars():
        out.append(
            UserSearchOut(
                **UserBrief.model_validate(u).model_dump(),
                follow_status=await follow_status(session, me.id, u.id),
            )
        )
    return out


@router.get('/users/{user_id}')
async def get_profile(
    user_id: uuid.UUID, session: Session, me: CurrentUser
) -> ProfileOut:
    user = await _visible_user(session, user_id)
    allowed = await can_view(session, me, user)
    return ProfileOut(
        **UserBrief.model_validate(user).model_dump(),
        follow_status=await follow_status(session, me.id, user.id),
        can_view=allowed,
        stats=await streak_stats(session, user) if allowed else None,
    )


@router.get('/users/{user_id}/entries')
async def user_entries(
    user_id: uuid.UUID,
    session: Session,
    me: CurrentUser,
    storage: StorageDep,
    limit: int = 30,
    offset: int = 0,
) -> list[SocialEntryOut]:
    user = await _visible_user(session, user_id)
    if not await can_view(session, me, user):
        raise HTTPException(403, 'Profile is private')
    result = await session.execute(
        select(DayEntry)
        .where(DayEntry.user_id == user.id)
        .order_by(DayEntry.date.desc())
        .limit(min(max(limit, 1), 100))
        .offset(max(offset, 0))
    )
    return await social_entries(session, me, list(result.scalars()), storage)


@router.post('/users/{user_id}/follow')
async def follow(
    user_id: uuid.UUID, session: Session, me: CurrentUser
) -> FollowOut:
    if user_id == me.id:
        raise HTTPException(400, 'Cannot follow yourself')
    target = await _visible_user(session, user_id)
    status = (
        FollowStatus.accepted if target.is_public else FollowStatus.pending
    )
    await session.execute(
        pg_insert(Follow)
        .values(follower_id=me.id, followee_id=target.id, status=status)
        .on_conflict_do_nothing(index_elements=['follower_id', 'followee_id'])
    )
    await session.commit()
    return FollowOut(status=await follow_status(session, me.id, target.id))


@router.delete('/users/{user_id}/follow', status_code=204)
async def unfollow(
    user_id: uuid.UUID, session: Session, me: CurrentUser
) -> None:
    await session.execute(
        delete(Follow).where(
            Follow.follower_id == me.id, Follow.followee_id == user_id
        )
    )
    await session.commit()


@router.get('/follow-requests')
async def follow_requests(
    session: Session, me: CurrentUser
) -> list[UserBrief]:
    result = await session.execute(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(
            Follow.followee_id == me.id,
            Follow.status == FollowStatus.pending,
            User.is_blocked.is_(False),
        )
        .order_by(Follow.created_at)
    )
    return [UserBrief.model_validate(u) for u in result.scalars()]


@router.post('/follow-requests/{follower_id}/accept')
async def accept_request(
    follower_id: uuid.UUID, session: Session, me: CurrentUser
) -> FollowOut:
    row = await session.get(Follow, (follower_id, me.id))
    if row is None:
        raise HTTPException(404, 'Request not found')
    row.status = FollowStatus.accepted
    await session.commit()
    return FollowOut(status='accepted')


@router.delete('/follow-requests/{follower_id}', status_code=204)
async def reject_request(
    follower_id: uuid.UUID, session: Session, me: CurrentUser
) -> None:
    await session.execute(
        delete(Follow).where(
            Follow.follower_id == follower_id,
            Follow.followee_id == me.id,
            Follow.status == FollowStatus.pending,
        )
    )
    await session.commit()


@router.delete('/followers/{follower_id}', status_code=204)
async def remove_follower(
    follower_id: uuid.UUID, session: Session, me: CurrentUser
) -> None:
    await session.execute(
        delete(Follow).where(
            Follow.follower_id == follower_id, Follow.followee_id == me.id
        )
    )
    await session.commit()
