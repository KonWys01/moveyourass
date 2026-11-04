import asyncio
import logging
import time
from typing import Protocol

from app.config import get_settings

log = logging.getLogger(__name__)


class Pusher(Protocol):
    async def send(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, str],
    ) -> list[str]:
        """Send to all tokens; return tokens FCM says are dead."""
        ...


class NullPusher:
    async def send(self, tokens, title, body, data) -> list[str]:
        log.info('push (no FCM configured): %s / %s', title, body)
        return []


class FirebasePusher:
    def __init__(self, credentials_file: str):
        import firebase_admin
        from firebase_admin import credentials

        self._app = firebase_admin.initialize_app(
            credentials.Certificate(credentials_file)
        )

    def _send_sync(self, tokens, title, body, data) -> list[str]:
        from firebase_admin import messaging

        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=data,
        )
        response = messaging.send_each_for_multicast(message, app=self._app)
        dead = []
        for token, result in zip(tokens, response.responses, strict=True):
            if result.exception is not None and isinstance(
                result.exception,
                (messaging.UnregisteredError, messaging.SenderIdMismatchError),
            ):
                dead.append(token)
        return dead

    async def send(self, tokens, title, body, data) -> list[str]:
        return await asyncio.to_thread(
            self._send_sync, tokens, title, body, data
        )


_pusher: Pusher | None = None
_last_failure_log = 0.0
FAILURE_LOG_EVERY = 600  # seconds


def get_pusher() -> Pusher:
    """Push is optional: a broken Firebase setup must never break the API.

    If the credentials file is set but unusable (missing, bad json) we
    log it (at most every 10 min) and fall back to a no-op pusher WITHOUT
    caching the failure, so fixing the file takes effect on its own.
    """
    global _pusher, _last_failure_log
    if _pusher is not None:
        return _pusher
    path = get_settings().firebase_credentials_file
    if not path:
        _pusher = NullPusher()
        return _pusher
    try:
        _pusher = FirebasePusher(path)
    except Exception:
        now = time.monotonic()
        if (
            now - _last_failure_log > FAILURE_LOG_EVERY
            or not _last_failure_log
        ):
            _last_failure_log = now
            log.exception(
                'Firebase credentials unusable (%s): push disabled until '
                'the file is fixed',
                path,
            )
        return NullPusher()
    return _pusher
