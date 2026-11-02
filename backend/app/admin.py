import contextlib
import hmac
import logging
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from sqladmin import Admin, ModelView, action
from sqladmin.authentication import AuthenticationBackend
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import RedirectResponse

from app import google
from app.config import get_settings
from app.db import SessionLocal, engine
from app.models import (
    AppVersion,
    Category,
    Comment,
    DayEntry,
    DeviceToken,
    Follow,
    Like,
    Photo,
    User,
    Workout,
)
from app.services.users import (
    find_or_create_user,
    get_by_sub,
    has_panel_access,
    is_first_admin_email,
)
from app.storage import get_storage

log = logging.getLogger(__name__)
TEMPLATES_DIR = str(Path(__file__).parent / 'admin_templates')


@contextlib.asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Own DB session for admin code (tests monkeypatch this)."""
    async with SessionLocal() as session:
        yield session


class GoogleAdminAuth(AuthenticationBackend):
    """Same Google accounts as the app; panel access is a DB flag."""

    async def login(self, request: Request) -> bool:
        form = await request.form()
        credential = form.get('credential')
        csrf_cookie = request.cookies.get('g_csrf_token', '')
        csrf_form = str(form.get('g_csrf_token', ''))
        # Google's double-submit-cookie check for the redirect flow.
        if not credential or not csrf_cookie:
            return False
        if not hmac.compare_digest(csrf_cookie, csrf_form):
            return False
        try:
            identity = google.verify_google_token(str(credential))
        except google.InvalidGoogleToken:
            return False
        async with session_scope() as session:
            # Panel never registers strangers; only the configured first
            # admin may bootstrap an account here.
            if is_first_admin_email(identity.email):
                user, _ = await find_or_create_user(session, identity)
            else:
                user = await get_by_sub(session, identity.sub)
            if user is None or user.is_blocked:
                return False
            if is_first_admin_email(user.email) and not user.is_admin:
                user.is_admin = True
                user.can_access_admin = True
            if not has_panel_access(user):
                return False
            await session.commit()
            request.session.update({'uid': str(user.id)})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        uid = request.session.get('uid')
        if not uid:
            return False
        try:
            user_id = uuid.UUID(uid)
        except ValueError:
            return False
        async with session_scope() as session:
            user = await session.get(User, user_id)
        # Re-checked on every request: blocking or revoking access
        # takes effect immediately, not at session expiry.
        return bool(user and not user.is_blocked and has_panel_access(user))


def _redirect_back(request: Request, identity: str) -> RedirectResponse:
    return RedirectResponse(
        request.headers.get('Referer')
        or str(request.url_for('admin:list', identity=identity)),
        status_code=302,
    )


def _pks(request: Request) -> list[uuid.UUID]:
    raw = request.query_params.get('pks', '')
    return [uuid.UUID(p) for p in raw.split(',') if p]


class UserAdmin(ModelView, model=User):
    name = 'Użytkownik'
    name_plural = 'Użytkownicy'
    icon = 'fa-solid fa-user'
    can_create = False  # accounts come from Google sign-in
    column_list = [
        User.email,
        User.first_name,
        User.last_name,
        User.is_public,
        User.is_admin,
        User.can_access_admin,
        User.is_blocked,
        User.created_at,
    ]
    column_searchable_list = [User.email, User.first_name, User.last_name]
    column_sortable_list = [User.email, User.created_at, User.is_blocked]
    column_default_sort = [(User.created_at, True)]
    form_excluded_columns = [User.google_sub]

    async def _set_blocked(self, request: Request, value: bool):
        async with session_scope() as session:
            await session.execute(
                update(User)
                .where(User.id.in_(_pks(request)))
                .values(is_blocked=value)
            )
            await session.commit()
        return _redirect_back(request, self.identity)

    @action(
        name='block',
        label='Zablokuj',
        confirmation_message='Zablokować zaznaczonych użytkowników?',
        add_in_list=True,
        add_in_detail=True,
    )
    async def block(self, request: Request):
        return await self._set_blocked(request, True)

    @action(
        name='unblock',
        label='Odblokuj',
        add_in_list=True,
        add_in_detail=True,
    )
    async def unblock(self, request: Request):
        return await self._set_blocked(request, False)


class CategoryAdmin(ModelView, model=Category):
    name = 'Kategoria'
    name_plural = 'Kategorie'
    icon = 'fa-solid fa-tags'
    column_list = [Category.name, Category.is_active, Category.sort_order]
    column_default_sort = [(Category.sort_order, False)]


class DayEntryAdmin(ModelView, model=DayEntry):
    name = 'Wpis dnia'
    name_plural = 'Wpisy dnia'
    icon = 'fa-solid fa-calendar-day'
    column_list = [DayEntry.date, DayEntry.user_id, DayEntry.status]
    column_default_sort = [(DayEntry.date, True)]


class WorkoutAdmin(ModelView, model=Workout):
    name = 'Trening'
    name_plural = 'Treningi'
    icon = 'fa-solid fa-dumbbell'
    column_list = [
        Workout.created_at,
        Workout.entry_id,
        Workout.category,
        Workout.description,
    ]
    column_default_sort = [(Workout.created_at, True)]


class PhotoAdmin(ModelView, model=Photo):
    name = 'Zdjęcie'
    name_plural = 'Zdjęcia'
    icon = 'fa-solid fa-image'
    can_create = False
    column_list = [Photo.created_at, Photo.workout_id, Photo.storage_path]
    column_default_sort = [(Photo.created_at, True)]

    async def after_model_delete(self, model: Photo, request: Request):
        """Moderation delete also removes the file from storage."""
        try:
            await get_storage().delete(model.storage_path)
        except Exception:
            log.exception('storage delete failed: %s', model.storage_path)


class CommentAdmin(ModelView, model=Comment):
    name = 'Komentarz'
    name_plural = 'Komentarze'
    icon = 'fa-solid fa-comment'
    column_list = [
        Comment.created_at,
        Comment.user_id,
        Comment.entry_id,
        Comment.text,
    ]
    column_searchable_list = [Comment.text]
    column_default_sort = [(Comment.created_at, True)]


class FollowAdmin(ModelView, model=Follow):
    name = 'Obserwowanie'
    name_plural = 'Obserwowania'
    icon = 'fa-solid fa-user-group'
    column_list = [
        Follow.follower_id,
        Follow.followee_id,
        Follow.status,
        Follow.created_at,
    ]


class LikeAdmin(ModelView, model=Like):
    name = 'Lajk'
    name_plural = 'Lajki'
    icon = 'fa-solid fa-heart'
    column_list = [Like.user_id, Like.entry_id, Like.created_at]


class DeviceTokenAdmin(ModelView, model=DeviceToken):
    name = 'Token urządzenia'
    name_plural = 'Tokeny urządzeń'
    icon = 'fa-solid fa-mobile'
    can_create = False
    column_list = [DeviceToken.user_id, DeviceToken.created_at]


class AppVersionAdmin(ModelView, model=AppVersion):
    name = 'Wersja aplikacji'
    name_plural = 'Wersje aplikacji'
    icon = 'fa-solid fa-mobile-screen'
    column_list = [
        AppVersion.latest_version,
        AppVersion.min_version,
        AppVersion.download_url,
        AppVersion.updated_at,
    ]
    column_default_sort = [(AppVersion.id, True)]


VIEWS = [
    UserAdmin,
    AppVersionAdmin,
    CategoryAdmin,
    DayEntryAdmin,
    WorkoutAdmin,
    PhotoAdmin,
    CommentAdmin,
    FollowAdmin,
    LikeAdmin,
    DeviceTokenAdmin,
]


def setup_admin(app: FastAPI) -> Admin:
    settings = get_settings()
    admin = Admin(
        app,
        engine,
        authentication_backend=GoogleAdminAuth(
            secret_key=settings.jwt_secret,
            https_only=False,
            same_site='lax',
        ),
        templates_dir=TEMPLATES_DIR,
        title='MoveYourAss',
    )
    admin.templates.env.globals['google_client_id'] = (
        settings.google_client_ids[0] if settings.google_client_ids else ''
    )
    for view in VIEWS:
        admin.add_view(view)
    return admin
