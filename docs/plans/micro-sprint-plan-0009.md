# Micro-sprint plan 0009 — remaining GET list cache header tests

## Status
COMPLETED

## Cycle
9

## Control repository
`localloop-backend`

## Observation
- Cycle 0008 gaps: no-store assertions for GET list routes `/api/v1/product`, `/api/v1/offer`, `/api/v1/match`, `/api/v1/transfer` deferred
- `loop.cache.headers.test.ts` has 11 tests (7 write + 4 read/search: material list, events, material/product search)
- `loop.ts` applies blanket `setNoStore` via `onRequest` hook (line 225); remaining GET list routes inherit same policy
- Remote HEAD verified at `af9fb6f` (synced with `origin/main`)

## Selected item
Extend `tests/loop.cache.headers.test.ts` read/search `it.each` with GET `/api/v1/product`, `/api/v1/offer`, `/api/v1/match`, and `/api/v1/transfer`.

## Priority rationale
These four GET list routes complete the lab demo entity read surface for cache-policy coverage. Production behavior is correct via the plugin hook; missing tests leave the offer/match/transfer/product list paths undocumented and unguarded against hook regressions. All four routes share the same assertion pattern as cycle 0008 material/events list tests.

## Implementation
1. Add four GET list entries to existing `describe('loop read and search routes Cache-Control')` `it.each` table
2. Reuse existing `buildApp` mocks (`listLoopProducts`, `listLoopOffers`, `listLoopMatches`, `listLoopTransfers`) — no production changes required
3. Confirm `onRequest` hook still applies `setNoStore` plugin-wide

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts` — 15 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Product, offer, match, and transfer GET list routes use the same plugin-wide `onRequest` no-store hook as material/events; extending the existing read/search `it.each` table is sufficient with no mock changes because `listLoopProducts`, `listLoopOffers`, `listLoopMatches`, and `listLoopTransfers` already return empty arrays in `buildApp`.
- All lab demo entity list routes are now covered (8 read/search assertions + 7 write = 15 total cache header tests).

## Gaps for next cycle
- Add no-store assertions for GET-by-id routes (`/api/v1/material/:id`, `/api/v1/product/:id`, `/api/v1/offer/:id`, `/api/v1/match/:id`, `/api/v1/transfer/:id`) if desired.
- Add protocol-contract material search cache assertion (optional; same hook).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `aa4cc97` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
