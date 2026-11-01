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

## Wdrożenie backendu (serwer z Dockerem + Caddy)

1. Na serwerze: sklonuj repo, `cp .env.example .env` i uzupełnij (m.in.
   `DATABASE_URL` Supabase, `JWT_SECRET` min. 32 znaki, `GOOGLE_CLIENT_IDS`,
   `FIRST_ADMIN_EMAIL`, `SUPABASE_*`, `API_DOMAIN_NAME`).
2. Obraz buduje workflow „Build and push images” po merge do `main`
   (ghcr.io, tagi `latest` i `sha-<commit>`).
3. `./scripts/deploy.sh` (lub `./scripts/deploy.sh sha-abc1234` do rollbacku):
   pull, migracje, rolling restart (nowy kontener musi być zdrowy, zanim
   stary zostanie zatrzymany), reload Caddy.

Do ręcznego skonfigurowania poza repo:
- Supabase: prywatny bucket `photos`.
- Google Cloud: klient OAuth typu Web; w „Authorized redirect URIs” dodaj
  `https://<API_DOMAIN_NAME>/admin/login`; ekran zgody w trybie produkcyjnym
  (zakresy: e-mail, profil).
- Firebase: plik service account i jego ścieżka w `FIREBASE_CREDENTIALS_FILE`.
- Adres polityki prywatności: `https://<API_DOMAIN_NAME>/privacy`.
