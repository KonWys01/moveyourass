from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import get_settings


class InvalidGoogleToken(Exception):
    pass


@dataclass
class GoogleIdentity:
    sub: str
    email: str
    first_name: str
    last_name: str
    avatar_url: str | None


def verify_google_token(token: str) -> GoogleIdentity:
    """Verify a Google ID token against the configured client ids."""
    request = google_requests.Request()
    claims = None
    for client_id in get_settings().google_client_ids:
        try:
            claims = id_token.verify_oauth2_token(token, request, client_id)
            break
        except ValueError:
            continue
    if claims is None or not claims.get('email_verified'):
        raise InvalidGoogleToken
    return GoogleIdentity(
        sub=claims['sub'],
        email=claims['email'],
        first_name=claims.get('given_name', ''),
        last_name=claims.get('family_name', ''),
        avatar_url=claims.get('picture'),
    )
