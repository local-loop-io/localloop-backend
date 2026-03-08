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
  TEMP_DIR="$(mktemp -d)"
  mkdir -p "$TEMP_DIR/schemas"
  for schema in "${SCHEMAS[@]}"; do
    curl -fsSL \
      "https://raw.githubusercontent.com/local-loop-io/loop-protocol/main/schemas/${schema}.schema.json" \
      -o "$TEMP_DIR/schemas/${schema}.schema.json"
  done
  SOURCE_DIR="$TEMP_DIR"
fi

for schema in "${SCHEMAS[@]}"; do
  diff -u \
    "$SOURCE_DIR/schemas/${schema}.schema.json" \
    "$ROOT_DIR/src/schemas/${schema}.schema.json"
done

echo "Backend protocol schema copies are in sync."
