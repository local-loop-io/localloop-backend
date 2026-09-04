#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$BACKUP_ROOT/$STAMP"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Required file not found: $1" >&2
    exit 1
  fi
}

require_command docker
require_file "$COMPOSE_FILE"

# The compose redis (Valkey) service always runs with --requirepass, so the
# SAVE below must authenticate; unauthenticated it returns NOAUTH with exit
# status 0 and the copied dump.rdb is silently whatever the last automatic
# save wrote. REDIS_PASSWORD comes from the project .env (the same file the
# compose stack reads), unless already exported by the caller.
if [[ -z "${REDIS_PASSWORD:-}" && -f "$PROJECT_DIR/.env" ]]; then
  REDIS_PASSWORD="$(grep -E '^REDIS_PASSWORD=' "$PROJECT_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d "\"'")"
fi
if [[ -z "${REDIS_PASSWORD:-}" ]]; then
  echo "REDIS_PASSWORD is not set (export it or define it in $PROJECT_DIR/.env)" >&2
  exit 1
fi

mkdir -p "$RUN_DIR/postgres" "$RUN_DIR/redis" "$RUN_DIR/seaweedfs" "$RUN_DIR/manifests"

echo "Creating backup at $RUN_DIR"

cd "$PROJECT_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$RUN_DIR/postgres/localloop.dump"

save_result="$(docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --no-auth-warning -a "$REDIS_PASSWORD" SAVE)"
if [[ "$save_result" != "OK" ]]; then
  echo "Redis SAVE failed: $save_result" >&2
  exit 1
fi
cp "$PROJECT_DIR/data/redis/dump.rdb" "$RUN_DIR/redis/dump.rdb"

tar -czf "$RUN_DIR/seaweedfs/seaweedfs-data.tar.gz" -C "$PROJECT_DIR" data/seaweedfs

printf '%s\n' \
  "timestamp=$STAMP" \
  "project_dir=$PROJECT_DIR" \
  "compose_file=$COMPOSE_FILE" \
  "retention_days=$RETENTION_DAYS" \
  > "$RUN_DIR/manifests/backup.env"

ln -sfn "$RUN_DIR" "$BACKUP_ROOT/latest"

# Retention: never delete the run `latest` points at, even if it is older than
# RETENTION_DAYS (e.g. after a long gap in runs), so the symlink cannot dangle.
latest_target="$(readlink -f "$BACKUP_ROOT/latest" 2>/dev/null || true)"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name "$STAMP" -mtime +"$RETENTION_DAYS" -print0 |
  while IFS= read -r -d '' dir; do
    if [[ -n "$latest_target" && "$(readlink -f "$dir")" == "$latest_target" ]]; then
      continue
    fi
    rm -rf "$dir"
  done

echo "Backup complete: $RUN_DIR"
