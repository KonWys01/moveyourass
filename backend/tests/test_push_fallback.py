import logging

import pytest

from app import push
from app.config import get_settings
from app.push import NullPusher, get_pusher
from tests.test_social import Person


@pytest.fixture(autouse=True)
def reset_pusher(monkeypatch):
    monkeypatch.setattr(push, '_pusher', None)
    monkeypatch.setattr(push, '_last_failure_log', 0.0)


def test_no_credentials_path_means_a_noop_pusher(monkeypatch):
    monkeypatch.setattr(get_settings(), 'firebase_credentials_file', '')

    assert isinstance(get_pusher(), NullPusher)


def test_missing_credentials_file_does_not_raise(monkeypatch, caplog):
    monkeypatch.setattr(
        get_settings(), 'firebase_credentials_file', '/no/such/firebase.json'
    )

    with caplog.at_level(logging.ERROR):
        pusher = get_pusher()

    assert isinstance(pusher, NullPusher)
    assert 'Firebase credentials unusable' in caplog.text


def test_failure_is_logged_once_not_on_every_call(monkeypatch, caplog):
    monkeypatch.setattr(
        get_settings(), 'firebase_credentials_file', '/no/such/firebase.json'
    )

    with caplog.at_level(logging.ERROR):
        for _ in range(5):
            get_pusher()

    assert caplog.text.count('Firebase credentials unusable') == 1


def test_fixing_the_file_takes_effect_without_a_restart(monkeypatch):
    monkeypatch.setattr(
        get_settings(), 'firebase_credentials_file', '/run/secrets/f.json'
    )
    attempts = []

    class Flaky:
        def __init__(self, path):
            attempts.append(path)
            if len(attempts) == 1:
                raise FileNotFoundError(path)

    monkeypatch.setattr(push, 'FirebasePusher', Flaky)

    first = get_pusher()
    second = get_pusher()
    third = get_pusher()

    assert isinstance(first, NullPusher)
    assert isinstance(second, Flaky)  # file appeared: retried and used
    assert third is second  # success is cached


async def test_endpoints_keep_working_with_a_broken_firebase_path(
    client, monkeypatch
):
    """Like/comment/follow used to answer 500 in this situation."""
    from app.main import app

    app.dependency_overrides.pop(get_pusher, None)  # use the real one
    monkeypatch.setattr(
        get_settings(), 'firebase_credentials_file', '/no/such/firebase.json'
    )
    owner = await Person(client, monkeypatch, 'own', 'Olek').login()
    other = await Person(client, monkeypatch, 'oth', 'Ola').login()
    entry = await owner.train()

    liked = await other.post(f'/entries/{entry["id"]}/like')
    commented = await other.post(
        f'/entries/{entry["id"]}/comments', json={'text': 'hej'}
    )
    followed = await other.post(f'/users/{owner.id}/follow')

    assert liked.status_code == 204
    assert commented.status_code == 201
    assert followed.status_code == 200
