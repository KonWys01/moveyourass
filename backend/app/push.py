import asyncio
import logging
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


def get_pusher() -> Pusher:
    global _pusher
    if _pusher is None:
        path = get_settings().firebase_credentials_file
        _pusher = FirebasePusher(path) if path else NullPusher()
    return _pusher
