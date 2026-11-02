from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.security import decode_access_token

bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer)
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    user_id = (
        decode_access_token(credentials.credentials) if credentials else None
    )
    user = await session.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(401, 'Invalid or missing token')
    if user.is_blocked:
        raise HTTPException(403, 'User is blocked')
    return user
