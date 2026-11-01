import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings

ALGORITHM = 'HS256'
TOKEN_TTL = timedelta(days=60)


def create_access_token(user_id: uuid.UUID) -> str:
    payload = {
        'sub': str(user_id),
        'exp': datetime.now(UTC) + TOKEN_TTL,
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(
            token, get_settings().jwt_secret, algorithms=[ALGORITHM]
        )
        return uuid.UUID(payload['sub'])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
