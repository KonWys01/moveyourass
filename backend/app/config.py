from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    database_url: str = (
        'postgresql+asyncpg://moveyourass:moveyourass@localhost:5433/'
        'moveyourass'
    )
    jwt_secret: str = 'dev-secret'
    google_client_ids: list[str] = []
    first_admin_email: str = ''
    supabase_url: str = ''
    supabase_service_key: str = ''
    supabase_bucket: str = 'photos'
    day_buffer_end_hour: int = 1
    max_photos_per_workout: int = 5
    rest_hint_days: int = 3


@lru_cache
def get_settings() -> Settings:
    return Settings()
