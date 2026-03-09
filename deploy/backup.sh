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

mkdir -p "$RUN_DIR/postgres" "$RUN_DIR/redis" "$RUN_DIR/minio" "$RUN_DIR/manifests"

echo "Creating backup at $RUN_DIR"

cd "$PROJECT_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$RUN_DIR/postgres/localloop.dump"

docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli SAVE >/dev/null
cp "$PROJECT_DIR/data/redis/dump.rdb" "$RUN_DIR/redis/dump.rdb"

tar -czf "$RUN_DIR/minio/minio-data.tar.gz" -C "$PROJECT_DIR" data/minio

printf '%s\n' \
  "timestamp=$STAMP" \
  "project_dir=$PROJECT_DIR" \
  "compose_file=$COMPOSE_FILE" \
  "retention_days=$RETENTION_DAYS" \
  > "$RUN_DIR/manifests/backup.env"

ln -sfn "$RUN_DIR" "$BACKUP_ROOT/latest"

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name "$STAMP" -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup complete: $RUN_DIR"
