#!/usr/bin/env bash
# Production deploy with zero downtime.
#
#   ./scripts/deploy.sh            # deploys :latest
#   ./scripts/deploy.sh sha-abc123 # deploys (or rolls back to) a given tag
#
# Order: pull -> migrate -> rolling backend restart (new container must be
# healthy BEFORE the old one is stopped).
#
# NOTE: migrations run while the old code is still serving, so keep them
# backwards compatible (add columns/tables first, drop them in a later deploy).
set -euo pipefail
cd "$(dirname "$0")/.."

export IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
echo "==> Deploying tag: ${IMAGE_TAG}"

echo "==> Pulling images"
docker compose pull backend

echo "==> Migrations"
docker compose run --rm --no-deps backend alembic upgrade head

echo "==> Rolling restart of backend"
old_ids="$(docker compose ps -q backend || true)"

if [ -z "$old_ids" ]; then
  docker compose up -d --no-deps backend
  new_ids="$(docker compose ps -q backend)"
else
  # Start an extra container from the NEW image next to the old one(s).
  docker compose up -d --no-deps --no-recreate --scale backend=$(( $(echo "$old_ids" | wc -l) + 1 )) backend
  new_ids="$(comm -13 <(echo "$old_ids" | sort) <(docker compose ps -q backend | sort))"
fi

wait_healthy() {
  local id="$1" waited=0 status
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
    [ "$status" = "healthy" ] && return 0
    [ "$(docker inspect -f '{{.State.Running}}' "$id")" = "true" ] || return 1
    sleep 2; waited=$((waited + 2))
  done
  return 1
}

for id in $new_ids; do
  if ! wait_healthy "$id"; then
    echo "!! New backend container did not become healthy - aborting, old one keeps serving." >&2
    docker logs --tail 50 "$id" >&2 || true
    docker stop "$id" >/dev/null && docker rm "$id" >/dev/null
    exit 1
  fi
done

# New containers are healthy: now (and only now) drain the old ones.
for id in $old_ids; do
  echo "==> Stopping old backend container ${id:0:12}"
  docker stop "$id" >/dev/null
  docker rm "$id" >/dev/null
done

docker image prune -f >/dev/null
echo "==> Done"
docker compose ps
# Caddy is NOT part of this stack: it is the shared one from the other
# project on this server (see README). Its config is not touched here.
