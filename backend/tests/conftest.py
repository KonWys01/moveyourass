from collections.abc import AsyncIterator

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import get_settings
from app.db import get_session
from app.main import app
from app.push import get_pusher
from app.storage import get_storage


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(get_settings().database_url)
    async with engine.connect() as conn:
        trans = await conn.begin()
        async with AsyncSession(
            bind=conn,
            join_transaction_mode='create_savepoint',
            expire_on_commit=False,
        ) as s:
            yield s
        await trans.rollback()
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    async def override() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = override
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url='http://test'
    ) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


class FakeStorage:
    def __init__(self):
        self.files: dict[str, bytes] = {}

    async def upload(self, path, data):
        self.files[path] = data

    async def delete(self, path):
        self.files.pop(path, None)

    async def signed_url(self, path):
        return f'https://signed.test/{path}?token=t'


@pytest.fixture(autouse=True)
def storage():
    fake = FakeStorage()
    app.dependency_overrides[get_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_storage, None)


class FakePusher:
    def __init__(self):
        self.sent: list[dict] = []
        self.dead: list[str] = []
        self.fail = False

    async def send(self, tokens, title, body, data):
        if self.fail:
            raise RuntimeError('fcm down')
        self.sent.append(
            {'tokens': tokens, 'title': title, 'body': body, 'data': data}
        )
        return [t for t in tokens if t in self.dead]


@pytest.fixture(autouse=True)
def pusher():
    fake = FakePusher()
    app.dependency_overrides[get_pusher] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_pusher, None)
