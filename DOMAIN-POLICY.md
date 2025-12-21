# Domain Policy

This backend serves the LocalLoop lab demo and public APIs.

## Canonical domains

- Frontend (GitHub Pages): https://local-loop-io.github.io
- Backend API: https://loop-api.urbnia.com

## Protocol namespace

All JSON-LD `@context` and schema `$id` references must live under:

- https://local-loop-io.github.io/projects/loop-protocol

JSON-LD contexts are published here:

- https://local-loop-io.github.io/projects/loop-protocol/contexts/

## Disallowed domains

Do not introduce or reference the following domains in code, docs, or tests:

- loop-protocol.org
- localloop.org
- local-loop.io
- api.local-loop.io
- local-loop.eu
- materialdna.eu

## Enforcement

The CI workflow runs `scripts/check-domains.sh` on every push and PR.
