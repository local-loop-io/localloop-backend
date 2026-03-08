#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/../loop-protocol"
TEMP_DIR=""
SCHEMAS=(material-dna offer match transfer material-status handshake)

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

if [[ ! -f "$SOURCE_DIR/schemas/material-dna.schema.json" ]]; then
  if [[ -z "${PROTOCOL_SYNC_TOKEN:-}" ]]; then
    echo "Skipping protocol parity check: local sibling repo unavailable and PROTOCOL_SYNC_TOKEN is not configured."
    exit 0
  fi

  TEMP_DIR="$(mktemp -d)"
  CLONE_URL="https://x-access-token:${PROTOCOL_SYNC_TOKEN}@github.com/local-loop-io/loop-protocol.git"
  git clone --depth 1 "$CLONE_URL" "$TEMP_DIR/loop-protocol"
  SOURCE_DIR="$TEMP_DIR/loop-protocol"
fi

for schema in "${SCHEMAS[@]}"; do
  diff -u \
    "$SOURCE_DIR/schemas/${schema}.schema.json" \
    "$ROOT_DIR/src/schemas/${schema}.schema.json"
done

echo "Backend protocol schema copies are in sync."
