from typing import Protocol

import httpx

from app.config import get_settings

SIGNED_URL_TTL = 3600


class Storage(Protocol):
    async def upload(self, path: str, data: bytes) -> None: ...

    async def delete(self, path: str) -> None: ...

    async def signed_url(self, path: str) -> str: ...


class SupabaseStorage:
    """Private-bucket Supabase Storage over its REST API."""

    def __init__(self, client: httpx.AsyncClient | None = None):
        s = get_settings()
        self._base = f'{s.supabase_url.rstrip("/")}/storage/v1'
        self._bucket = s.supabase_bucket
        self._client = client or httpx.AsyncClient(
            headers={'Authorization': f'Bearer {s.supabase_service_key}'},
            timeout=20,
        )

    async def upload(self, path: str, data: bytes) -> None:
        r = await self._client.post(
            f'{self._base}/object/{self._bucket}/{path}',
            content=data,
            headers={'Content-Type': 'image/jpeg'},
        )
        r.raise_for_status()

    async def delete(self, path: str) -> None:
        r = await self._client.delete(
            f'{self._base}/object/{self._bucket}/{path}'
        )
        if r.status_code != 404:
            r.raise_for_status()

    async def signed_url(self, path: str) -> str:
        r = await self._client.post(
            f'{self._base}/object/sign/{self._bucket}/{path}',
            json={'expiresIn': SIGNED_URL_TTL},
        )
        r.raise_for_status()
        return f'{self._base}{r.json()["signedURL"]}'


_storage: SupabaseStorage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = SupabaseStorage()
    return _storage
