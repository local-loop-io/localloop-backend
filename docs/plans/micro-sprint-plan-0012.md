# Micro-sprint plan 0012 — transaction route cache header tests

## Status
COMPLETED

## Cycle
12

## Control repository
`localloop-backend`

## Observation
- Cycle 0011 gaps: cache header tests for transactions, evidence, or payments plugins (each has own `onRequest` hook)
- `transactions.ts` applies plugin-wide `onRequest` `setNoStore` hook — distinct from loop/federate plugins
- `transactions.routes.test.ts` covers payloads and idempotency but not `Cache-Control`
- Remote HEAD verified at `036fc03` (synced with `origin/main`)

## Selected item
Add `Cache-Control: no-store` assertions for `POST /api/v1/transaction` and `GET /api/v1/transaction/:id` in a new `tests/transactions.cache.headers.test.ts`.

## Priority rationale
Transactions plugin has its own `onRequest` hook; write and read responses must not be cached. Production behavior is correct; missing tests leave §8.1 transaction paths undocumented and unguarded if the hook is removed.

## Skipped optional items
- Cache header tests for evidence or payments — next highest-value gap for cycle 0013
- ETag/Last-Modified on federation/nodes — deferred per cycle 0011
- GET-by-id loop cache tests — same loop hook already covered 15 times

## Implementation
1. Created `tests/transactions.cache.headers.test.ts` mirroring `transactions.routes.test.ts` setup
2. `it.each` asserts `cache-control: no-store` on POST (201) and GET (200) transaction routes
3. No production changes required

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/transactions.cache.headers.test.ts` — 2 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Transactions §8.1 plugin has its own `onRequest` no-store hook, separate from loop and federate plugins; cache regressions on one plugin are not caught by tests on another.
- After cycle 0012, cache header test coverage spans loop (15), federation registry (3), federate (2), transactions (2), signals (1), cities (1), interest (1), SSE streams (2), health/auth/metrics/utility — evidence and payments plugins remain uncovered.

## Gaps for next cycle
- Add cache header tests for evidence or payments plugins (each has its own `onRequest` hook; highest-value test gap after cycle 0012).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `28aa118` | implementation | yes |
| `localloop-backend` | `815981a` | plan close (HEAD) | yes (`origin/main`) |
