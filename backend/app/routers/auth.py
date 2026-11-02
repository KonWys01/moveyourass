from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import google
from app.config import get_settings
from app.db import get_session
from app.models import User
from app.schemas import GoogleLoginIn, TokenOut, UserOut
from app.security import create_access_token

router = APIRouter(prefix='/auth', tags=['auth'])


async def _get_by_sub(session: AsyncSession, sub: str) -> User | None:
    result = await session.execute(select(User).where(User.google_sub == sub))
    return result.scalar_one_or_none()


@router.post('/google')
async def login_with_google(
    body: GoogleLoginIn,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenOut:
    try:
        identity = google.verify_google_token(body.id_token)
    except google.InvalidGoogleToken:
        raise HTTPException(401, 'Invalid Google token') from None

    user = await _get_by_sub(session, identity.sub)
    is_new = user is None
    if user is None:
        admin_email = get_settings().first_admin_email.lower()
        user = User(
            google_sub=identity.sub,
            email=identity.email,
            first_name=identity.first_name,
            last_name=identity.last_name,
            avatar_url=identity.avatar_url,
            is_public=True if body.is_public is None else body.is_public,
            is_admin=bool(admin_email)
            and identity.email.lower() == admin_email,
        )
        if body.timezone:
            user.timezone = body.timezone
        session.add(user)
        try:
            await session.flush()
        except IntegrityError:
            # Concurrent first login (or e-mail clash): fall back to
            # the row that won, never a 500.
            await session.rollback()
            user = await _get_by_sub(session, identity.sub)
            if user is None:
                raise HTTPException(409, 'Account conflict') from None
            is_new = False
    if user.is_blocked:
        raise HTTPException(403, 'User is blocked')
    await session.commit()
    return TokenOut(
        access_token=create_access_token(user.id),
        is_new_user=is_new,
        user=UserOut.model_validate(user),
    )
