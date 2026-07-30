# Micro-sprint plan 0029 — Payments 503 §8.3 envelope regression guard

## Status
IN PROGRESS

## Cycle
29

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `a01a020` matches `origin/main`
- Cycle 0028 closed federate empty/whitespace `X-Node-ID` tests; 235 tests pass
- P1 investigation: routes emitting §8.3 envelope on non-canonical statuses
  - 429 on SSE streams (`interestStream`, `loopStream`): envelope already tested
  - 503 on `/health`: custom health schema (not §8.3) — out of scope
  - 503 on `/api/payments/*`: uses `sendSpecErrorForStatus` but tests only assert status code
  - 503 on auth/apiKey guards: unit-level, not route-level — defer
- P3 loop-protocol `localloop.github.io` audit refs remain (12 hits, 5 files)

## Selected item
Add route-level regression tests asserting disabled payment routes return §8.3
`INTERNAL_ERROR` envelope on 503 for both intent and webhook endpoints.

## Priority rationale
Smallest complete P1 deliverable — routes already emit spec envelope; tests
only checked HTTP status. Prevents accidental regression to legacy error shapes.

## Implementation
1. `tests/payments.routes.test.ts` — extend intent disabled test with envelope
   assertions; add webhook disabled test with same envelope checks

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/payments.routes.test.ts`
- `bun run typecheck`
- `bun run test`

## Deploy order
1. `localloop-backend` only (test-only changes)

## Gaps for cycle 0030
- **P3** — loop-protocol audit docs: historical `localloop.github.io` path refs
- **P1 alt** — apiKey 503 unit test when enabled but no key configured
- **Skip** — ETag on federation/nodes; docs cache policy; org root docs

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| (pending) | | | |
