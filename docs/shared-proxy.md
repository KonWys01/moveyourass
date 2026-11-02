# Wspólny Caddy (jedno proxy dla wszystkich aplikacji na serwerze)

Na serwerze działa **jeden, samodzielny Caddy** w osobnym folderze. Tylko on
zajmuje porty 80/443 i trzyma certyfikaty. Aplikacje (CV / `do-backend` oraz
MoveYourAss) nie uruchamiają własnego Caddy: dołączają do zewnętrznej sieci
Dockera `web` i są tam widoczne pod **unikalnymi aliasami**:

| Aplikacja | Alias w sieci `web` | Port |
|-----------|---------------------|------|
| CV (`do-backend`) | `cv-backend` | 8000 |
| MoveYourAss | `mya-backend` | 8000 |

Aliasy muszą być unikalne: oba stacki mają usługę o nazwie `backend`, więc
wspólna nazwa kierowałaby ruch raz do jednej, raz do drugiej aplikacji.

## Układ folderów na serwerze

```
~/proxy/                 # NOWY: wspólny Caddy (nie jest w żadnym repo)
    docker-compose.yml
    Caddyfile
    .env
~/do-backend/            # repo CV
~/moveyourass/           # repo MoveYourAss
```

## Pliki w `~/proxy/`

### `Caddyfile`

```
{$DOMAIN_NAME} {
    root * /srv/frontend
    encode gzip
    try_files {path} /index.html
    file_server
}

{$API_DOMAIN_NAME} {
    handle /static/* {
        root * /srv
        file_server
    }

    handle /media/* {
        root * /srv
        file_server
    }

    handle /admin/* {
        reverse_proxy cv-backend:8000 {
            # Rolling deploy: stary kontener może zniknąć w trakcie połączenia.
            # Ponawiaj (z ponownym rozwiązaniem nazwy) zamiast zwracać 502.
            lb_try_duration 5s
            lb_try_interval 250ms
        }
    }

    handle /app/* {
        reverse_proxy cv-backend:8000 {
            lb_try_duration 5s
            lb_try_interval 250ms
        }
    }
}

{$MYA_DOMAIN_NAME} {
    encode gzip

    # API, /admin i /privacy MoveYourAss trafiają do jednego backendu.
    reverse_proxy mya-backend:8000 {
        lb_try_duration 5s
        lb_try_interval 250ms
    }
}
```

### `docker-compose.yml`

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    env_file: .env
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - cv_static:/srv/static:ro
      - cv_media:/srv/media:ro
      - cv_frontend:/srv/frontend:ro
    networks:
      - web

# Wolumeny już istnieją (stworzył je stack CV). Podłączamy je jako
# zewnętrzne, żeby NIE tracić certyfikatów (caddy_data) ani mediów.
volumes:
  caddy_data:
    external: true
    name: ${CADDY_DATA_VOLUME}
  caddy_config:
    external: true
    name: ${CADDY_CONFIG_VOLUME}
  cv_static:
    external: true
    name: ${CV_STATIC_VOLUME}
  cv_media:
    external: true
    name: ${CV_MEDIA_VOLUME}
  cv_frontend:
    external: true
    name: ${CV_FRONTEND_VOLUME}

networks:
  web:
    external: true
```

### `.env`

```
# domeny (te same, co były w ~/do-backend/.env, plus nowa)
DOMAIN_NAME=twoja-domena-cv.pl
API_DOMAIN_NAME=api.twoja-domena-cv.pl
MYA_DOMAIN_NAME=ruch.twojadomena.pl

# nazwy istniejących wolumenów: patrz krok 3 poniżej
CADDY_DATA_VOLUME=do-backend_caddy_data
CADDY_CONFIG_VOLUME=do-backend_caddy_config
CV_STATIC_VOLUME=do-backend_static_volume
CV_MEDIA_VOLUME=do-backend_media_volume
CV_FRONTEND_VOLUME=do-backend_frontend_volume
```

## Wdrożenie (jednorazowo)

### A. Przygotowanie (bez przerwy w działaniu)

1. Sieć: `docker network create web`
2. DNS: rekord A subdomeny MoveYourAss na IP serwera, **DNS only**
   (bez proxy Cloudflare).
3. Nazwy istniejących wolumenów (prefiks to nazwa folderu stacka CV):
   ```bash
   docker volume ls | grep -E 'caddy_data|caddy_config|static_volume|media_volume|frontend_volume'
   ```
   Wpisz je do `~/proxy/.env`.
4. Utwórz `~/proxy/` z trzema plikami powyżej.
5. Sprawdź konfigurację (nic jeszcze nie uruchamia):
   ```bash
   cd ~/proxy
   docker compose config -q
   docker run --rm --env-file .env \
     -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" \
     caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
   ```
6. Zmerguj PR-y (`do-backend` i `moveyourass`) i zrób `git pull` w obu repo.
   Stary Caddy dalej działa, bo kontenery nie zostały jeszcze odtworzone.

### B. Przełączenie (przerwa kilkadziesiąt sekund)

```bash
# 1. stary Caddy znika (zwalnia 80/443), backend CV dołącza do sieci `web`
cd ~/do-backend && docker compose up -d --remove-orphans

# 2. nowy, wspólny Caddy
cd ~/proxy && docker compose up -d

# 3. MoveYourAss (obraz z ghcr.io, migracje, rolling restart)
cd ~/moveyourass && ./scripts/deploy.sh
```

### C. Sprawdzenie

```bash
curl -I https://twoja-domena-cv.pl
curl -I https://api.twoja-domena-cv.pl/app/api/skills/
curl -s https://ruch.twojadomena.pl/health      # {"status":"ok"}
cd ~/proxy && docker compose logs --tail 30 caddy
```
Certyfikaty CV powinny zostać wczytane z istniejącego wolumenu (bez nowego
wystawiania), a dla nowej subdomeny Caddy wystawi certyfikat sam.

### Wycofanie (gdyby coś poszło źle)

```bash
cd ~/proxy && docker compose down
cd ~/do-backend
git checkout <commit-przed-tym-PR> -- docker-compose.yml Caddyfile scripts/deploy.sh
docker compose up -d --remove-orphans   # wraca stary Caddy
```

## Zmiana konfiguracji później

Po edycji `~/proxy/Caddyfile`:
```bash
cd ~/proxy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```
Niepoprawna konfiguracja zostanie odrzucona, a Caddy zostanie na starej.
Jeśli edytor podmienia plik (nowy inode) i reload nie widzi zmian:
`docker compose up -d --force-recreate caddy`.

## Nowa aplikacja na tym serwerze

1. W jej compose: sieć `web` jako `external: true` i unikalny alias
   (np. `app3-backend`), bez publikowania portów.
2. W `~/proxy/Caddyfile`: nowy blok z `reverse_proxy app3-backend:PORT`
   i nowa zmienna z domeną w `~/proxy/.env`.
3. `caddy reload` (jak wyżej).
