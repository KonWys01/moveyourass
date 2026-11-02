import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Follow, FollowStatus, User


async def follow_status(
    session: AsyncSession, viewer_id: uuid.UUID, owner_id: uuid.UUID
) -> str:
    """'none' | 'pending' | 'accepted' for viewer -> owner."""
    result = await session.execute(
        select(Follow.status).where(
            Follow.follower_id == viewer_id,
            Follow.followee_id == owner_id,
        )
    )
    status = result.scalar_one_or_none()
    return status.value if status else 'none'


async def can_view(session: AsyncSession, viewer: User, owner: User) -> bool:
    """Public profiles: any logged-in user. Private: owner + accepted.

    Checked against the database on every call, so removing a follow
    takes effect immediately (signed URLs are only issued after this).
    """
    if owner.is_blocked and viewer.id != owner.id:
        return False
    if viewer.id == owner.id or owner.is_public:
        return True
    return (
        await follow_status(session, viewer.id, owner.id)
        == FollowStatus.accepted
    )
