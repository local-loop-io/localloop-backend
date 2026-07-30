# Micro-sprint plan 0029 — Payments 503 §8.3 envelope regression guard

## Status
COMPLETED

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
- `bun test tests/payments.routes.test.ts` — 5 pass, 0 fail (1 new test)
- `bun run typecheck` — pass
- `bun run test` — 236 pass, 0 fail

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- P1 429/503 sweep: SSE 429 envelopes were already guarded; health 503 uses a
  bespoke degraded schema and is not a §8.3 surface.
- Payment disabled paths were the only lab routes emitting spec envelope on 503
  without route-level envelope assertions.
- Webhook disabled path had no test at all — added alongside intent envelope guard.

## Gaps for cycle 0030
- **P3** — loop-protocol audit docs: historical `localloop.github.io` path refs
  (12 hits across 5 audit files)
- **P1 alt** — apiKey 503 unit test when enabled but no key configured
- **Skip** — ETag on federation/nodes; docs cache policy; org root docs
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `4227691` | implementation | yes |
| `localloop-backend` | `b3308a6` | plan close (HEAD) | yes |
