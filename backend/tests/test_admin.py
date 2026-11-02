import contextlib
import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app import google
from app.config import get_settings
from app.models import User

CSRF = 'csrf-abc'


@pytest.fixture(autouse=True)
def admin_session(session, monkeypatch):
    @contextlib.asynccontextmanager
    async def scope():
        yield session

    monkeypatch.setattr('app.admin.session_scope', scope)


@pytest.fixture
def web(client):
    client.follow_redirects = False
    return client


def identity(sub, email):
    return google.GoogleIdentity(sub, email, 'Ala', 'Admin', None)


async def admin_login(
    web,
    monkeypatch,
    sub='s1',
    email='a@x.com',
    csrf=CSRF,
    cookie=f'g_csrf_token={CSRF}',
):
    monkeypatch.setattr(
        google, 'verify_google_token', lambda t: identity(sub, email)
    )
    return await web.post(
        '/admin/login',
        data={'credential': 'tok', 'g_csrf_token': csrf},
        headers={'Cookie': cookie} if cookie else {},
    )


async def make_user(session, sub, email, **flags):
    user = User(
        google_sub=sub, email=email, first_name='U', last_name='X', **flags
    )
    session.add(user)
    await session.flush()
    return user


async def test_unauthenticated_redirects_to_login(web):
    r = await web.get('/admin/')

    assert r.status_code in (302, 307)
    assert r.headers['location'].endswith('/admin/login')


async def test_login_page_has_google_button(web):
    get_settings().google_client_ids = ['cid.apps.googleusercontent.com']
    from app.main import app

    app.router.routes  # noqa: B018 (admin is mounted at import time)
    r = await web.get('/admin/login')

    assert r.status_code == 200
    assert 'accounts.google.com/gsi/client' in r.text
    assert 'data-login_uri' in r.text


async def test_login_rejects_missing_or_wrong_csrf(web, session, monkeypatch):
    await make_user(session, 's1', 'a@x.com', can_access_admin=True)

    wrong = await admin_login(web, monkeypatch, csrf='nope')
    assert wrong.status_code == 400
    no_cookie = await admin_login(web, monkeypatch, cookie='')
    assert no_cookie.status_code == 400
    empty = await admin_login(web, monkeypatch, csrf='', cookie='')
    assert empty.status_code == 400


async def test_user_without_panel_access_is_rejected(
    web, session, monkeypatch
):
    await make_user(session, 's1', 'a@x.com')

    r = await admin_login(web, monkeypatch)

    assert r.status_code == 400
    assert (await web.get('/admin/')).status_code in (302, 307)


async def test_unknown_account_is_rejected_and_not_created(
    web, session, monkeypatch
):
    r = await admin_login(web, monkeypatch, sub='new', email='z@x.com')

    assert r.status_code == 400
    found = await session.execute(select(User).where(User.email == 'z@x.com'))
    assert found.scalar_one_or_none() is None


async def test_admin_with_access_can_log_in_and_browse(
    web, session, monkeypatch
):
    await make_user(session, 's1', 'a@x.com', can_access_admin=True)

    r = await admin_login(web, monkeypatch)

    assert r.status_code == 302
    assert (await web.get('/admin/')).status_code == 200
    assert (await web.get('/admin/user/list')).status_code == 200
    assert (await web.get('/admin/category/list')).status_code == 200


async def test_first_admin_email_bootstraps_account(web, session, monkeypatch):
    monkeypatch.setattr(get_settings(), 'first_admin_email', 'Boss@X.com')

    r = await admin_login(web, monkeypatch, sub='boss', email='boss@x.com')

    assert r.status_code == 302
    user = (
        await session.execute(select(User).where(User.google_sub == 'boss'))
    ).scalar_one()
    assert user.is_admin and user.can_access_admin


async def test_existing_user_with_first_admin_email_is_promoted(
    web, session, monkeypatch
):
    await make_user(session, 'boss', 'boss@x.com')
    monkeypatch.setattr(get_settings(), 'first_admin_email', 'boss@x.com')

    r = await admin_login(web, monkeypatch, sub='boss', email='boss@x.com')

    assert r.status_code == 302


async def test_blocking_admin_ends_session_immediately(
    web, session, monkeypatch
):
    user = await make_user(session, 's1', 'a@x.com', can_access_admin=True)
    await admin_login(web, monkeypatch)
    assert (await web.get('/admin/')).status_code == 200

    user.is_blocked = True
    await session.flush()

    assert (await web.get('/admin/')).status_code in (302, 307)


async def test_revoking_access_ends_session_immediately(
    web, session, monkeypatch
):
    user = await make_user(session, 's1', 'a@x.com', can_access_admin=True)
    await admin_login(web, monkeypatch)

    user.can_access_admin = False
    await session.flush()

    assert (await web.get('/admin/')).status_code in (302, 307)


async def test_block_and_unblock_actions(web, session, monkeypatch):
    await make_user(session, 's1', 'a@x.com', can_access_admin=True)
    victim = await make_user(session, 's2', 'v@x.com')
    await admin_login(web, monkeypatch)

    r = await web.get(
        '/admin/user/action/block', params={'pks': str(victim.id)}
    )
    assert r.status_code == 302
    await session.refresh(victim)
    assert victim.is_blocked is True

    await web.get('/admin/user/action/unblock', params={'pks': str(victim.id)})
    await session.refresh(victim)
    assert victim.is_blocked is False


async def test_photo_moderation_delete_removes_file(monkeypatch, storage):
    from app.admin import PhotoAdmin

    await storage.upload('u/w/a.jpg', b'x')
    monkeypatch.setattr('app.admin.get_storage', lambda: storage)
    photo = SimpleNamespace(storage_path='u/w/a.jpg', id=uuid.uuid4())

    await PhotoAdmin().after_model_delete(photo, None)

    assert storage.files == {}


async def test_photo_moderation_survives_storage_error(monkeypatch):
    from app.admin import PhotoAdmin

    class Broken:
        async def delete(self, path):
            raise RuntimeError('down')

    monkeypatch.setattr('app.admin.get_storage', lambda: Broken())

    await PhotoAdmin().after_model_delete(
        SimpleNamespace(storage_path='x'), None
    )
