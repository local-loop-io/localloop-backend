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

if command -v rg >/dev/null 2>&1; then
  if rg -n "(${pattern})" --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!scripts/check-domains.sh' --glob '!DOMAIN-POLICY.md' ; then
    echo "Banned domains found."
    exit 1
  fi
else
  if grep -RIn -E "(${pattern})" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=DOMAIN-POLICY.md --exclude=scripts/check-domains.sh . ; then
    echo "Banned domains found."
    exit 1
  fi
fi

echo "Domain check passed."
