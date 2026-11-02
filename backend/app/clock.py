from datetime import UTC, datetime


def utcnow() -> datetime:
    """Single time source; tests monkeypatch it."""
    return datetime.now(UTC)
