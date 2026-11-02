from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.google import GoogleIdentity
from app.models import User


async def get_by_sub(session: AsyncSession, sub: str) -> User | None:
    result = await session.execute(select(User).where(User.google_sub == sub))
    return result.scalar_one_or_none()


def is_first_admin_email(email: str) -> bool:
    admin_email = get_settings().first_admin_email.strip().lower()
    return bool(admin_email) and email.lower() == admin_email


def has_panel_access(user: User) -> bool:
    return user.is_admin or user.can_access_admin


async def find_or_create_user(
    session: AsyncSession,
    identity: GoogleIdentity,
    is_public: bool | None = None,
    timezone: str | None = None,
) -> tuple[User | None, bool]:
    """Return (user, is_new). Race-safe: a concurrent first login
    falls back to the row that won. (None, False) = unresolvable
    conflict (e.g. e-mail already used by another Google account)."""
    user = await get_by_sub(session, identity.sub)
    if user is not None:
        return user, False
    user = User(
        google_sub=identity.sub,
        email=identity.email,
        first_name=identity.first_name,
        last_name=identity.last_name,
        avatar_url=identity.avatar_url,
        is_public=True if is_public is None else is_public,
        is_admin=is_first_admin_email(identity.email),
        can_access_admin=is_first_admin_email(identity.email),
    )
    if timezone:
        user.timezone = timezone
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        winner = await get_by_sub(session, identity.sub)
        return winner, False
    return user, True
