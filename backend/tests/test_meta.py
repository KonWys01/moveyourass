import pytest

from app.config import get_settings
from app.models import AppVersion
from app.services.versions import is_older, parse_version
from tests.test_social import Person


def test_parse_version():
    assert parse_version('1.2.3') == (1, 2, 3)
    assert parse_version('v2.0') == (2, 0)
    assert parse_version('') is None
    assert parse_version('abc') is None
    assert parse_version('1.x') is None


def test_is_older_pads_lengths():
    assert is_older((1, 2), (1, 2, 1))
    assert not is_older((1, 2, 0), (1, 2))
    assert is_older((1, 9, 0), (1, 10, 0))  # numeric, not lexical


@pytest.fixture
async def versions(session):
    session.add(
        AppVersion(
            min_version='1.1.0',
            latest_version='1.3.0',
            download_url='https://dl.example/app.apk',
        )
    )
    await session.flush()


async def test_version_defaults_have_no_update(client):
    r = await client.get('/app/version', params={'current': '1.0.0'})

    assert r.status_code == 200
    assert r.json()['update_available'] is False
    assert r.json()['update_required'] is False


async def test_outdated_but_supported(client, versions):
    r = await client.get('/app/version', headers={'X-App-Version': '1.2.0'})

    body = r.json()
    assert body['update_available'] is True
    assert body['update_required'] is False
    assert body['download_url'] == 'https://dl.example/app.apk'


async def test_below_minimum_requires_update(client, versions):
    r = await client.get('/app/version', params={'current': '1.0.9'})

    assert r.json()['update_required'] is True


async def test_current_is_up_to_date(client, versions):
    r = await client.get('/app/version', params={'current': '1.3.0'})

    assert r.json()['update_available'] is False


async def test_missing_or_garbage_version_never_forces_update(
    client, versions
):
    for params in ({}, {'current': 'banana'}):
        r = await client.get('/app/version', params=params)
        assert r.status_code == 200
        assert r.json()['update_required'] is False
        assert r.json()['update_available'] is False


async def test_privacy_page_is_public_html(client, monkeypatch):
    monkeypatch.setattr(get_settings(), 'contact_email', 'me@example.com')

    r = await client.get('/privacy')

    assert r.status_code == 200
    assert 'text/html' in r.headers['content-type']
    assert 'me@example.com' in r.text
    assert '{{CONTACT}}' not in r.text


async def test_health_checks_database(client):
    r = await client.get('/health')

    assert r.json() == {'status': 'ok'}


async def test_delete_account_removes_data_and_files(
    client, monkeypatch, storage, session
):
    from sqlalchemy import select

    from app.models import User

    me = await Person(client, monkeypatch, 'del', 'Del').login()
    entry = await me.train(with_photo=True)
    assert len(storage.files) == 1
    assert entry

    r = await me.delete('/me')

    assert r.status_code == 204
    assert storage.files == {}
    left = await session.execute(select(User).where(User.google_sub == 'del'))
    assert left.scalar_one_or_none() is None
    assert (await me.get('/me')).status_code == 401


async def test_delete_account_requires_auth(client):
    assert (await client.delete('/me')).status_code == 401
