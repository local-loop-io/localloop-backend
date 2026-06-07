# Domain Policy

This backend serves the localLOOP lab demo and public APIs.

## Canonical domains

- Public site / docs hub: https://localloop.urbnia.com
- Backend API: https://loop-api.urbnia.com

## Protocol namespace

All JSON-LD `@context` and schema `$id` references must live under:

- https://localloop.urbnia.com/projects/loop-protocol

JSON-LD contexts are published here:

- https://localloop.urbnia.com/projects/loop-protocol/contexts/

## Disallowed domains

Do not introduce or reference the following domains in code, docs, or tests:

- local-loop-io.github.io
- loop-protocol.org
- localloop.org
- local-loop.io
- api.local-loop.io
- local-loop.eu
- materialdna.eu

## Enforcement

The CI workflow runs `scripts/check-domains.sh` on every push and PR.
