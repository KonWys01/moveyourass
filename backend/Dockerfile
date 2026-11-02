FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN pip install --no-cache-dir poetry==2.2.1

WORKDIR /app

# Dependency layer first, for build cache.
COPY pyproject.toml poetry.lock /app/
RUN poetry install --only main --no-root

COPY . /app/

EXPOSE 8000

# --proxy-headers: behind Caddy, so redirects / the Google login_uri
# get https. One worker is plenty here; the reminder scheduler is safe
# with several containers (send-once guard in the database).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
