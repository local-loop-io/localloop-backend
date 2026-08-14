#!/usr/bin/env bash
# Basic health-check alerting: polls the local API's /health endpoint and
# reports failure two ways — (1) a non-zero exit, so the systemd service
# that runs this script is marked failed and shows up in `systemctl
# --failed` / `journalctl -u localloop-backend-healthcheck`, and (2) an
# optional webhook POST (Slack/Discord/generic-JSON compatible) if
# ALERT_WEBHOOK_URL is set. Deliberately not a metrics/alerting stack —
# this is a lab-stage solo-operator project; a systemd timer plus a
# reachable failure signal is the appropriate scope, matching the existing
# backup.sh automation pattern.

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8088/health}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-5}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command curl

send_alert() {
  local message="$1"
  echo "ALERT: $message" >&2
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl -fsS -m "$TIMEOUT_SECONDS" -X POST "$ALERT_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"localLOOP backend health check failed: $message\"}" \
      >/dev/null 2>&1 || echo "ALERT: failed to deliver webhook notification" >&2
  fi
}

body="$(curl -fsS -m "$TIMEOUT_SECONDS" "$HEALTH_URL" 2>&1)" || {
  send_alert "could not reach $HEALTH_URL: $body"
  exit 1
}

status="$(echo "$body" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)"
db="$(echo "$body" | grep -o '"db":"[^"]*"' | head -1 | cut -d'"' -f4)"
redis="$(echo "$body" | grep -o '"redis":"[^"]*"' | head -1 | cut -d'"' -f4)"

if [[ "$status" != "ok" ]]; then
  send_alert "status=$status db=$db redis=$redis (full body: $body)"
  exit 1
fi

echo "localLOOP backend healthy: status=$status db=$db redis=$redis"
