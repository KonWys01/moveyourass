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

## Wdrożenie backendu (serwer z Dockerem, jeden wspólny Caddy)

Na serwerze działa **jeden samodzielny Caddy** (porty 80/443). Ten stack go
nie uruchamia: backend dołącza do wspólnej sieci Dockera `web` pod aliasem
`mya-backend`.

### Jednorazowo: wspólny Caddy
Samodzielny Caddy w osobnym folderze (`~/proxy`), z dostępem do sieci `web`.
Pełna instrukcja: **[`docs/shared-proxy.md`](docs/shared-proxy.md)**: gotowy
`Caddyfile`, `docker-compose.yml` i `.env` proxy, kolejność przełączenia
z Caddy z `do-backend` (bez utraty certyfikatów) i wycofanie. Ten stack
widoczny jest w sieci jako `mya-backend:8000`; DNS: rekord A, **DNS only**.

### Backend
1. Na serwerze: sklonuj repo, `cp .env.example .env` i uzupełnij (m.in.
   `DATABASE_URL` Supabase, `JWT_SECRET` min. 32 znaki, `GOOGLE_CLIENT_IDS`,
   `FIRST_ADMIN_EMAIL`, `SUPABASE_*`).
2. Push (opcjonalnie): plik service account z Firebase zapisz jako
   `secrets/firebase.json` (katalog jest w `.gitignore`).
3. Obraz leży w prywatnym ghcr.io: `docker login ghcr.io` (PAT z
   `read:packages`).
4. `./scripts/deploy.sh` (lub `./scripts/deploy.sh sha-abc1234` do rollbacku):
   pull, migracje, rolling restart (nowy kontener musi być zdrowy, zanim
   stary zostanie zatrzymany).

Do ręcznego skonfigurowania poza repo:
- Supabase: prywatny bucket `photos`.
- Google Cloud: klient OAuth typu Web; w „Authorized redirect URIs” dodaj
  `https://<subdomena>/admin/login`; ekran zgody w trybie produkcyjnym
  (zakresy: e-mail, profil).
- Adres polityki prywatności: `https://<subdomena>/privacy`.
