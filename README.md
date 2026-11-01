# moveyourass

Aplikacja do codziennego motywowania się do ruchu (styl BeReal).
Projekt: `docs/superpowers/specs/`, plan: `docs/superpowers/plans/`.

## Backend (dev)

```bash
cp .env.example .env
docker compose up -d --wait db
cd backend && poetry install
poetry run alembic upgrade head
poetry run pytest
poetry run uvicorn app.main:app --reload
```
