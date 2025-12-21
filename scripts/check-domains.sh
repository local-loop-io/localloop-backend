#!/usr/bin/env bash
set -euo pipefail

banned=(
  "loop-protocol.org"
  "localloop.org"
  "local-loop.io"
  "api.local-loop.io"
  "local-loop.eu"
  "materialdna.eu"
)

pattern=$(IFS='|'; echo "${banned[*]//./\\.}")

if rg -n "(${pattern})" --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' ; then
  echo "Banned domains found."
  exit 1
fi

echo "Domain check passed."
