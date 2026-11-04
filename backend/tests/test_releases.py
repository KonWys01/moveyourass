import httpx
import pytest
from sqlalchemy import select

from app.models import AppVersion
from app.services.releases import APK_NAME, sync_latest_release

REPO = 'owner/app'


def release(tag='v0.2.0', assets=None):
    if assets is None:
        assets = [
            {
                'name': APK_NAME,
                'browser_download_url': f'https://github.com/owner/app/releases/download/{tag}/{APK_NAME}',
            }
        ]
    return {'tag_name': tag, 'assets': assets}


def client_for(status=200, body=None, calls=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request)
        return httpx.Response(status, json=body if body is not None else {})

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def newest(session):
    return (
        await session.execute(
            select(AppVersion).order_by(AppVersion.id.desc()).limit(1)
        )
    ).scalar_one()


async def count(session):
    return len((await session.execute(select(AppVersion))).scalars().all())


async def test_new_release_adds_a_version_row(session):
    calls = []
    client = client_for(body=release('v0.2.0'), calls=calls)

    new = await sync_latest_release(session, client, REPO)

    assert new == '0.2.0'
    row = await newest(session)
    assert row.latest_version == '0.2.0'
    assert row.download_url.endswith('/v0.2.0/moveyourass.apk')
    assert str(calls[0].url) == (
        'https://api.github.com/repos/owner/app/releases/latest'
    )
    assert calls[0].headers['user-agent'] == 'moveyourass-backend'


async def test_second_check_with_same_release_does_nothing(session):
    client = client_for(body=release('v0.2.0'))
    await sync_latest_release(session, client, REPO)
    before = await count(session)

    again = await sync_latest_release(session, client, REPO)

    assert again is None
    assert await count(session) == before


async def test_min_version_is_carried_over(session):
    session.add(
        AppVersion(
            min_version='0.1.5', latest_version='0.1.0', download_url=''
        )
    )
    await session.flush()

    await sync_latest_release(
        session, client_for(body=release('v0.3.0')), REPO
    )

    row = await newest(session)
    assert (row.min_version, row.latest_version) == ('0.1.5', '0.3.0')


async def test_never_lowers_a_version_set_by_hand(session):
    session.add(
        AppVersion(
            min_version='0.0.0', latest_version='9.0.0', download_url='x'
        )
    )
    await session.flush()
    before = await count(session)

    result = await sync_latest_release(
        session, client_for(body=release('v0.2.0')), REPO
    )

    assert result is None
    assert await count(session) == before
    assert (await newest(session)).latest_version == '9.0.0'


@pytest.mark.parametrize(
    'tag,expected',
    [('0.2.0', '0.2.0'), ('v1.10.0', '1.10.0')],
)
async def test_tag_with_or_without_v(session, tag, expected):
    new = await sync_latest_release(
        session, client_for(body=release(tag)), REPO
    )

    assert new == expected


@pytest.mark.parametrize('tag', ['nightly', 'latest', '', None])
async def test_unparseable_tag_is_ignored(session, tag):
    before = await count(session)

    result = await sync_latest_release(
        session, client_for(body=release(tag)), REPO
    )

    assert result is None
    assert await count(session) == before


async def test_release_without_apk_asset_is_ignored(session):
    before = await count(session)
    body = release('v0.2.0', assets=[{'name': 'notes.txt'}])

    assert (
        await sync_latest_release(session, client_for(body=body), REPO) is None
    )
    assert await count(session) == before


async def test_non_https_download_url_is_ignored(session):
    body = release(
        'v0.2.0',
        assets=[
            {'name': APK_NAME, 'browser_download_url': 'http://evil/x.apk'}
        ],
    )

    assert (
        await sync_latest_release(session, client_for(body=body), REPO) is None
    )


async def test_no_release_or_private_repo_is_a_quiet_noop(session):
    result = await sync_latest_release(session, client_for(status=404), REPO)

    assert result is None


async def test_github_error_raises_so_the_loop_retries_later(session):
    with pytest.raises(httpx.HTTPStatusError):
        await sync_latest_release(session, client_for(status=503), REPO)
