import logging

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppVersion
from app.services.versions import is_older, parse_version

log = logging.getLogger(__name__)

APK_NAME = 'moveyourass.apk'
# serializes concurrent checks (several containers during a rolling deploy)
LOCK_KEY = 7_340_211


async def fetch_latest_release(
    client: httpx.AsyncClient, repo: str
) -> dict | None:
    """Latest published (non-draft, non-prerelease) release, or None."""
    response = await client.get(
        f'https://api.github.com/repos/{repo}/releases/latest',
        headers={
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'moveyourass-backend',
        },
    )
    if response.status_code == 404:  # no release yet, or repo is private
        return None
    response.raise_for_status()
    return response.json()


async def sync_latest_release(
    session: AsyncSession, client: httpx.AsyncClient, repo: str
) -> str | None:
    """Add a new AppVersion row when GitHub has a newer release.

    Returns the new version, or None when nothing changed. Never
    lowers the version (so a manual, higher value set in the admin
    panel wins) and keeps the current ``min_version``.
    """
    release = await fetch_latest_release(client, repo)
    if not release:
        return None
    version = parse_version(release.get('tag_name'))
    asset = next(
        (a for a in release.get('assets', []) if a.get('name') == APK_NAME),
        None,
    )
    url = (asset or {}).get('browser_download_url', '')
    if version is None or not url.startswith('https://'):
        log.warning(
            'release %r ignored (no version or no APK asset)',
            release.get('tag_name'),
        )
        return None

    await session.execute(
        text('select pg_advisory_xact_lock(:key)'), {'key': LOCK_KEY}
    )
    current = (
        await session.execute(
            select(AppVersion).order_by(AppVersion.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if current is not None:
        known = parse_version(current.latest_version)
        if known is not None and not is_older(known, version):
            await session.commit()  # nothing to write; releases the lock
            return None

    new_version = '.'.join(str(n) for n in version)
    session.add(
        AppVersion(
            min_version=current.min_version if current else '0.0.0',
            latest_version=new_version,
            download_url=url,
        )
    )
    await session.commit()
    return new_version
