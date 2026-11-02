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

Na serwerze działa **jeden Caddy** (ten z `do-backend`, ma porty 80/443). Ten
stack go nie uruchamia: backend dołącza do wspólnej sieci Dockera pod aliasem
`mya-backend`, a Caddy dostaje jeden dodatkowy blok.

### Jednorazowo: wspólny Caddy
1. Wspólna sieć: `docker network create web`.
2. W `do-backend/docker-compose.yml` serwis `caddy` ma być w obu sieciach:
   ```yaml
   caddy:
     networks: [default, web]
   networks:
     web:
       external: true
   ```
3. W `do-backend/Caddyfile` dopisz blok dla nowej subdomeny:
   ```
   {$MYA_DOMAIN_NAME} {
   	encode gzip
   	reverse_proxy mya-backend:8000 {
   		# rolling deploy: stary kontener może zniknąć w trakcie połączenia
   		lb_try_duration 5s
   		lb_try_interval 250ms
   	}
   }
   ```
   i w `.env` tego stacka dodaj `MYA_DOMAIN_NAME=ruch.twojadomena.pl`.
4. Zastosuj: `docker compose up -d caddy` (zmiana sieci) i
   `docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile`.
5. DNS: rekord A subdomeny na IP serwera, **DNS only** (bez proxy Cloudflare).

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
