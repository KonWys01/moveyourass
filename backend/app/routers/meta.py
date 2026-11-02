from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import AppVersion
from app.services.versions import is_older, parse_version

router = APIRouter(tags=['meta'])
Session = Annotated[AsyncSession, Depends(get_session)]

PRIVACY_HTML = (Path(__file__).parent.parent / 'privacy.html').read_text(
    encoding='utf-8'
)


class VersionOut(BaseModel):
    current_version: str | None
    latest_version: str
    min_version: str
    download_url: str
    update_available: bool
    update_required: bool


@router.get('/app/version')
async def app_version(
    session: Session,
    current: str | None = None,
    x_app_version: Annotated[str | None, Header()] = None,
) -> VersionOut:
    """Public. The app sends its version (header or ?current=) and shows
    a download link when outdated; ``update_required`` = below minimum."""
    row = (
        await session.execute(
            select(AppVersion).order_by(AppVersion.id.desc()).limit(1)
        )
    ).scalar_one_or_none()
    latest = row.latest_version if row else '0.0.0'
    minimum = row.min_version if row else '0.0.0'
    url = row.download_url if row else ''
    raw = current or x_app_version
    cur = parse_version(raw)
    lat, mini = parse_version(latest), parse_version(minimum)
    return VersionOut(
        current_version=raw,
        latest_version=latest,
        min_version=minimum,
        download_url=url,
        update_available=bool(cur and lat and is_older(cur, lat)),
        update_required=bool(cur and mini and is_older(cur, mini)),
    )


@router.get('/privacy', response_class=HTMLResponse)
async def privacy() -> str:
    contact = get_settings().contact_email or 'administrator aplikacji'
    return PRIVACY_HTML.replace('{{CONTACT}}', contact)


@router.get('/health')
async def health(session: Session) -> dict[str, str]:
    await session.execute(text('select 1'))
    return {'status': 'ok'}
