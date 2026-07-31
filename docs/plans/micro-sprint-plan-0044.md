# Micro-sprint plan 0044 — federation handshake response schema conformance

## Status
IN_PROGRESS

## Cycle
44

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `3f51fe6` matches `origin/main`
- Cycle 0043 closed apiKey guard + envelope theme; 244 tests pass
- `bun run check:conformance` — all checks passed
- `tests/specResponses.test.ts` validates node/info, signals, transaction,
  material GET, and product GET against canonical schemas — federation
  handshake 202 response is uncovered despite `handshake.schema.json` in sync
- Closed themes: cache headers, federate lab boundaries, 503 envelopes,
  mock.module, mirror drift, apiKey route guards
- Site smoke tests green (28 pass); loop-protocol audit docs stale but org-root
  / mirror work skipped per guidance

## Selected item
Add `specResponses` regression asserting `POST /api/v1/federation/handshake`
202 body validates against `HandshakeResponse` in the canonical handshake schema.

## Priority rationale
Smallest shippable post-apiKey pivot — test-only, extends the existing
response-side conformance pattern to the last lab federation write response without
production churn or closed-theme extension.

## Implementation
1. `tests/specResponses.test.ts` — compile `HandshakeResponse` from
   `handshake.schema.json`, POST handshake, AJV-validate 202 body

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/specResponses.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
_(filled on close)_

## Gaps for cycle 0045
_(filled on close)_

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | — | implementation | — |
| `localloop-backend` | — | plan close (HEAD) | — |
