from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AppVersion(Base):
    """Editable in the admin panel. The newest row (highest id) wins."""

    __tablename__ = 'app_versions'

    id: Mapped[int] = mapped_column(primary_key=True)
    min_version: Mapped[str] = mapped_column(String, default='0.0.0')
    latest_version: Mapped[str] = mapped_column(String, default='0.0.0')
    download_url: Mapped[str] = mapped_column(String, default='')
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __str__(self) -> str:
        return f'{self.latest_version} (min {self.min_version})'
