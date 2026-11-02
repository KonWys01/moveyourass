from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import google
from app.db import get_session
from app.schemas import GoogleLoginIn, TokenOut, UserOut
from app.security import create_access_token
from app.services.users import find_or_create_user

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/google')
async def login_with_google(
    body: GoogleLoginIn,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenOut:
    try:
        identity = google.verify_google_token(body.id_token)
    except google.InvalidGoogleToken:
        raise HTTPException(401, 'Invalid Google token') from None

    user, is_new = await find_or_create_user(
        session, identity, body.is_public, body.timezone
    )
    if user is None:
        raise HTTPException(409, 'Account conflict')
    if user.is_blocked:
        raise HTTPException(403, 'User is blocked')
    await session.commit()
    return TokenOut(
        access_token=create_access_token(user.id),
        is_new_user=is_new,
        user=UserOut.model_validate(user),
    )
