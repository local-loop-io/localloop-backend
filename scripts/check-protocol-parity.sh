#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/../loop-protocol"
TEMP_DIR=""

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

if [[ ! -f "$SOURCE_DIR/schemas/material-dna.schema.json" ]]; then
  TEMP_DIR="$(mktemp -d)"
  git clone --depth 1 https://github.com/local-loop-io/loop-protocol.git "$TEMP_DIR/loop-protocol" >/dev/null 2>&1
  SOURCE_DIR="$TEMP_DIR/loop-protocol"
fi

for schema in material-dna offer match transfer material-status handshake; do
  diff -u \
    "$SOURCE_DIR/schemas/${schema}.schema.json" \
    "$ROOT_DIR/src/schemas/${schema}.schema.json"
done

echo "Backend protocol schema copies are in sync."
