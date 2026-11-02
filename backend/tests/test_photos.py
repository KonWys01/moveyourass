import io
from datetime import UTC, datetime

import httpx
import pytest
from PIL import Image

from app import clock, google
from app.storage import SupabaseStorage


def make_image(size=(3000, 2000), fmt='JPEG', exif=False) -> bytes:
    img = Image.new('RGB', size, 'red')
    out = io.BytesIO()
    kwargs = {}
    if exif:
        e = Image.Exif()
        e[0x0112] = 6  # rotate 90
        e[0x010F] = 'SecretCamera'
        kwargs['exif'] = e
    img.save(out, fmt, **kwargs)
    return out.getvalue()


@pytest.fixture
async def headers(client, monkeypatch):
    identity = google.GoogleIdentity('s1', 'a@x.com', 'A', 'B', None)
    monkeypatch.setattr(google, 'verify_google_token', lambda t: identity)
    monkeypatch.setattr(
        clock, 'utcnow', lambda: datetime(2026, 1, 6, 12, tzinfo=UTC)
    )
    r = await client.post('/auth/google', json={'id_token': 'x'})
    return {'Authorization': f'Bearer {r.json()["access_token"]}'}


@pytest.fixture
async def workout_id(client, headers):
    cid = (await client.get('/categories', headers=headers)).json()[0]['id']
    r = await client.post(
        '/entries/workouts', headers=headers, json={'category_id': cid}
    )
    return r.json()['workouts'][0]['id']


async def upload(client, headers, workout_id, data, name='p.jpg'):
    return await client.post(
        f'/workouts/{workout_id}/photos',
        headers=headers,
        files={'file': (name, data, 'image/jpeg')},
    )


async def test_upload_resizes_and_strips_exif(
    client, headers, workout_id, storage
):
    r = await upload(
        client, headers, workout_id, make_image((3000, 2000), exif=True)
    )

    assert r.status_code == 201
    assert r.json()['url'].startswith('https://signed.test/')
    stored = Image.open(io.BytesIO(next(iter(storage.files.values()))))
    assert max(stored.size) == 1600
    assert stored.size == (1067, 1600)  # EXIF rotation applied
    assert not stored.getexif()


async def test_photo_appears_in_today_with_signed_url(
    client, headers, workout_id
):
    await upload(client, headers, workout_id, make_image((100, 100)))

    body = (await client.get('/entries/today', headers=headers)).json()

    photo = body['entry']['workouts'][0]['photos'][0]
    assert photo['url'].startswith('https://signed.test/')


async def test_not_an_image_is_422(client, headers, workout_id, storage):
    r = await upload(client, headers, workout_id, b'definitely not jpeg')

    assert r.status_code == 422
    assert storage.files == {}


async def test_too_large_is_413(client, headers, workout_id, monkeypatch):
    monkeypatch.setattr('app.routers.photos.MAX_BYTES', 10)

    r = await upload(client, headers, workout_id, make_image((50, 50)))

    assert r.status_code == 413


async def test_photo_limit_is_enforced(client, headers, workout_id):
    for _ in range(5):
        r = await upload(client, headers, workout_id, make_image((60, 60)))
        assert r.status_code == 201

    r = await upload(client, headers, workout_id, make_image((60, 60)))

    assert r.status_code == 409


async def test_cannot_upload_to_foreign_workout(
    client, headers, workout_id, monkeypatch
):
    other = google.GoogleIdentity('s2', 'b@x.com', 'B', 'C', None)
    monkeypatch.setattr(google, 'verify_google_token', lambda t: other)
    r = await client.post('/auth/google', json={'id_token': 'x'})
    h2 = {'Authorization': f'Bearer {r.json()["access_token"]}'}

    r = await upload(client, h2, workout_id, make_image((60, 60)))

    assert r.status_code == 404


async def test_delete_photo_removes_from_storage(
    client, headers, workout_id, storage
):
    photo = (
        await upload(client, headers, workout_id, make_image((60, 60)))
    ).json()

    r = await client.delete(f'/photos/{photo["id"]}', headers=headers)

    assert r.status_code == 204
    assert storage.files == {}
    again = await client.delete(f'/photos/{photo["id"]}', headers=headers)
    assert again.status_code == 404


async def test_photo_requires_auth(client, workout_id):
    r = await client.post(
        f'/workouts/{workout_id}/photos',
        files={'file': ('p.jpg', b'x', 'image/jpeg')},
    )

    assert r.status_code == 401


async def test_supabase_storage_http_shape(monkeypatch):
    from app.config import get_settings

    s = get_settings()
    monkeypatch.setattr(s, 'supabase_url', 'https://x.supabase.co')
    monkeypatch.setattr(s, 'supabase_bucket', 'photos')
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, str(request.url)))
        if 'sign' in request.url.path:
            return httpx.Response(
                200, json={'signedURL': '/object/sign/photos/a.jpg?token=z'}
            )
        return httpx.Response(200, json={})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    storage = SupabaseStorage(client)

    await storage.upload('u/a.jpg', b'1')
    url = await storage.signed_url('u/a.jpg')
    await storage.delete('u/a.jpg')

    base = 'https://x.supabase.co/storage/v1'
    assert seen[0] == ('POST', f'{base}/object/photos/u/a.jpg')
    assert seen[1] == ('POST', f'{base}/object/sign/photos/u/a.jpg')
    assert seen[2] == ('DELETE', f'{base}/object/photos/u/a.jpg')
    assert url == f'{base}/object/sign/photos/a.jpg?token=z'
