from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app import clock
from app.models import DeviceToken, ReminderLog
from app.services.reminders import send_due_reminders
from tests.test_social import Person

TOKEN = 'fcm-token-aaaaaaaaaa'


@pytest.fixture(autouse=True)
def fixed_now(monkeypatch):
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 6, 12, tzinfo=UTC)
    )


@pytest.fixture
async def owner(client, monkeypatch):
    p = await Person(client, monkeypatch, 'own', 'Olek').login()
    await p.post('/devices', json={'token': TOKEN})
    return p


@pytest.fixture
async def other(client, monkeypatch):
    return await Person(client, monkeypatch, 'oth', 'Ola').login()


async def test_register_and_move_device_token(client, owner, other, session):
    await other.post('/devices', json={'token': TOKEN})

    row = (await session.execute(select(DeviceToken))).scalar_one()
    assert str(row.user_id) == other.id


async def test_like_notifies_owner_once(owner, other, pusher):
    entry = await owner.train()

    await other.post(f'/entries/{entry["id"]}/like')
    await other.post(f'/entries/{entry["id"]}/like')

    assert len(pusher.sent) == 1
    assert pusher.sent[0]['tokens'] == [TOKEN]
    assert pusher.sent[0]['data']['kind'] == 'like'
    assert 'Ola' in pusher.sent[0]['body']


async def test_own_like_and_comment_do_not_notify(owner, pusher):
    entry = await owner.train()

    await owner.post(f'/entries/{entry["id"]}/like')
    await owner.post(
        f'/entries/{entry["id"]}/comments', json={'text': 'sam sobie'}
    )

    assert pusher.sent == []


async def test_comment_notifies_with_text(owner, other, pusher):
    entry = await owner.train()

    await other.post(
        f'/entries/{entry["id"]}/comments', json={'text': 'dobra robota'}
    )

    assert pusher.sent[0]['data']['kind'] == 'comment'
    assert 'dobra robota' in pusher.sent[0]['body']


async def test_follow_public_and_private_and_accept(
    client, monkeypatch, owner, other, pusher
):
    await other.post(f'/users/{owner.id}/follow')
    assert pusher.sent[-1]['data']['kind'] == 'new_follower'

    secret = await Person(
        client, monkeypatch, 'sec', 'Sekret', public=False
    ).login()
    await secret.post('/devices', json={'token': 'sec-token-bbbbbbbb'})
    await other.post(f'/users/{secret.id}/follow')
    assert pusher.sent[-1]['data']['kind'] == 'follow_request'

    await other.post('/devices', json={'token': 'oth-token-cccccccc'})
    await secret.post(f'/follow-requests/{other.id}/accept')
    assert pusher.sent[-1]['data']['kind'] == 'request_accepted'
    assert pusher.sent[-1]['tokens'] == ['oth-token-cccccccc']


async def test_disabled_kind_is_not_sent(owner, other, pusher):
    r = await owner.client.patch(
        '/me/notifications', headers=owner.headers, json={'like': False}
    )
    assert r.json()['like'] is False
    assert r.json()['comment'] is True
    entry = await owner.train()

    await other.post(f'/entries/{entry["id"]}/like')
    await other.post(f'/entries/{entry["id"]}/comments', json={'text': 'hej'})

    assert [m['data']['kind'] for m in pusher.sent] == ['comment']


async def test_default_prefs_all_enabled(owner):
    r = await owner.get('/me/notifications')

    assert all(r.json().values())


async def test_dead_token_is_removed(owner, other, pusher, session):
    pusher.dead = [TOKEN]
    entry = await owner.train()

    await other.post(f'/entries/{entry["id"]}/like')

    assert (await session.execute(select(DeviceToken))).first() is None


async def test_push_failure_does_not_break_request(owner, other, pusher):
    pusher.fail = True
    entry = await owner.train()

    r = await other.post(f'/entries/{entry["id"]}/like')

    assert r.status_code == 204


async def test_blocked_recipient_gets_nothing(owner, other, pusher, session):
    from sqlalchemy import update

    from app.models import User

    entry = await owner.train()
    await session.execute(
        update(User).where(User.id == owner.id).values(is_blocked=True)
    )

    await other.post(f'/entries/{entry["id"]}/like')

    assert pusher.sent == []


# --- reminders ---


def utc(*a):
    return datetime(*a, tzinfo=UTC)


async def test_reminder_sent_in_window_once(owner, session, pusher):
    now = utc(2026, 1, 6, 19, 30)  # 20:30 Warsaw

    assert await send_due_reminders(session, pusher, now) == 1
    assert await send_due_reminders(session, pusher, now) == 0
    assert (
        await send_due_reminders(session, pusher, utc(2026, 1, 6, 20, 30)) == 0
    )
    assert pusher.sent[0]['data']['kind'] == 'reminder'
    assert (await session.execute(select(ReminderLog))).scalars().all()


async def test_reminder_not_outside_window(owner, session, pusher):
    assert await send_due_reminders(session, pusher, utc(2026, 1, 6, 17)) == 0
    assert await send_due_reminders(session, pusher, utc(2026, 1, 6, 21)) == 0


async def test_reminder_skipped_when_entry_exists(owner, session, pusher):
    await owner.train()  # fixed_now: 2026-01-06 13:00 Warsaw

    assert (
        await send_due_reminders(session, pusher, utc(2026, 1, 6, 19, 30)) == 0
    )


async def test_reminder_respects_user_timezone(owner, session, pusher):
    await owner.client.patch(
        '/me', headers=owner.headers, json={'timezone': 'America/New_York'}
    )

    # 19:30 UTC = 14:30 New York -> not due
    assert (
        await send_due_reminders(session, pusher, utc(2026, 1, 6, 19, 30)) == 0
    )
    # 01:30 UTC next day = 20:30 New York on Jan 6 -> due
    assert (
        await send_due_reminders(session, pusher, utc(2026, 1, 7, 1, 30)) == 1
    )


async def test_reminder_respects_pref_and_needs_token(
    client, monkeypatch, owner, session, pusher
):
    await owner.client.patch(
        '/me/notifications', headers=owner.headers, json={'reminder': False}
    )
    await Person(client, monkeypatch, 'nt', 'Notoken').login()

    assert (
        await send_due_reminders(session, pusher, utc(2026, 1, 6, 19, 30)) == 0
    )
