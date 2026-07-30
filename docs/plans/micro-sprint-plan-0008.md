# Micro-sprint plan 0008 — GET list/search cache header tests

## Status
COMPLETED

## Cycle
8

## Control repository
`localloop-backend`

## Observation
- Cycle 0007 gaps: no-store assertions for GET list/search loop routes deferred
- `loop.cache.headers.test.ts` covers seven write routes via shared `it.each` table
- `loop.ts` applies blanket `setNoStore` via `onRequest` hook (line 225); GET list and search routes inherit same policy
- Remote HEAD verified at `9964fac` (synced with `origin/main`)

## Selected item
Extend `tests/loop.cache.headers.test.ts` to assert `Cache-Control: no-store` on GET `/api/v1/material`, GET `/api/v1/events`, POST `/api/v1/material/search`, and POST `/api/v1/product/search`.

## Priority rationale
GET list and search routes are the highest-value remaining cache-policy gaps from cycle 0007. Production behavior is correct via the plugin hook; missing tests leave read paths undocumented and unguarded against hook regressions. All four routes share the same assertion pattern and fit cleanly in one `it.each` block.

## Implementation
1. Added `describe('loop read and search routes Cache-Control')` with shared `it.each`
2. Covered GET list routes (`/api/v1/material`, `/api/v1/events`) and Core-DP search POST routes (`material/search`, `product/search`)
3. Reused existing `buildApp` mocks — no production changes required
4. Used `as const` on `it.each` table for TypeScript HTTPMethods inference

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts` — 11 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- GET list and Core-DP search routes share the same plugin-wide no-store hook as write routes; a second `it.each` block with method/url/payload/status columns cleanly covers mixed GET/POST read paths without duplicating `buildApp`.
- Material search uses Core-DP contract (`{ limit: 10 }`) in cache tests to avoid protocol-contract mock complexity; protocol search cache policy is identical via the same hook.

## Gaps for next cycle
- Add no-store assertions for remaining GET list routes (`/api/v1/product`, `/api/v1/offer`, `/api/v1/match`, `/api/v1/transfer`) and GET-by-id routes if desired.
- Add protocol-contract material search cache assertion (optional; same hook).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `57f3531` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | — |
