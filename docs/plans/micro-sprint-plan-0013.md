# Micro-sprint plan 0013 — payment route cache header tests

## Status
COMPLETED

## Cycle
13

## Control repository
`localloop-backend`

## Observation
- Cycle 0012 gaps: cache header tests for evidence or payments plugins (each has own `onRequest` hook)
- `payments.ts` applies plugin-wide `onRequest` `setNoStore` hook — distinct from loop/federate/transactions plugins
- `payments.routes.test.ts` covers payloads and enable/disable but not `Cache-Control`
- Evidence routes import DB functions directly (no deps injection); payments has clearer isolated Fastify test pattern
- Remote HEAD verified at `39698aa` (synced with `origin/main`)

## Selected item
Add `Cache-Control: no-store` assertions for `POST /api/payments/intent` and `POST /api/payments/webhook` in a new `tests/payments.cache.headers.test.ts`.

## Priority rationale
Payments plugin has its own `onRequest` hook; write responses must not be cached. Production behavior is correct; missing tests leave payment paths undocumented and unguarded if the hook is removed. Payments selected over evidence because `payments.routes.test.ts` already provides a clean Fastify inject + mocked deps pattern.

## Skipped optional items
- Cache header tests for evidence plugin — next highest-value gap for cycle 0014 (requires DB module mocking or integration setup)
- ETag/Last-Modified on federation/nodes — deferred per cycle 0012
- GET-by-id loop cache tests — same loop hook already covered 15 times

## Implementation
1. Created `tests/payments.cache.headers.test.ts` mirroring `payments.routes.test.ts` setup
2. `it.each` asserts `cache-control: no-store` on POST intent (201) and POST webhook (202)
3. No production changes required

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/payments.cache.headers.test.ts` — 2 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Payments plugin has its own `onRequest` no-store hook, separate from loop, federate, and transactions plugins; cache regressions on one plugin are not caught by tests on another.
- Route plugins without deps injection (evidence) are harder to unit-test in isolation than those with injectable deps (payments, transactions); prefer evidence integration-style cache tests or module mocks in cycle 0014.
- After cycle 0013, cache header test coverage spans loop (15), federation registry (3), federate (2), transactions (2), payments (2), signals (1), cities (1), interest (1), SSE streams (2), health/auth/metrics/utility — evidence plugin remains uncovered.

## Gaps for next cycle
- Add cache header tests for evidence plugin (3 routes: GET by id, GET list, POST search; requires DB mocking or integration setup).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `a807c74` | implementation | yes |
| `localloop-backend` | `ffc4c56` | plan close (HEAD) | yes (`origin/main`) |
