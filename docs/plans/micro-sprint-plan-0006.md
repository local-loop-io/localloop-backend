# Micro-sprint plan 0006 — material-status cache header test

## Status
COMPLETED

## Cycle
6

## Control repository
`localloop-backend`

## Observation
- Cycle 0005 gaps: audit remaining loop routes (material-status, product writes, GET search/list) for cache policy tests
- `loop.cache.headers.test.ts` covers POST material/offer/match/transfer only
- `loop.ts` applies blanket `setNoStore` via `onRequest` hook; material-status POST inherits same policy
- Remote HEAD verified at `637af14` (synced with `origin/main`)

## Selected item
Extend `tests/loop.cache.headers.test.ts` to assert `Cache-Control: no-store` on POST `/api/v1/material-status`.

## Priority rationale
Material-status is a lab write route excluded from the original four-route batch in cycle 0003. Production behavior is correct via the plugin hook; missing test leaves this status-update path undocumented and unguarded against hook regressions. Smallest independently shippable diff from cycle 0005 gaps.

## Implementation
1. Added `materialStatusPayload` aligned with `loop.routes.test.ts`
2. Extended existing `it.each` write-route table with `/api/v1/material-status`

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts` — 5 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Lab extension routes (material-status) share the same plugin-wide no-store hook as core demo writes; extending the existing `it.each` table is the lowest-churn way to close coverage gaps one route at a time.
- `setPublicShortCache` is imported in `loop.ts` but unused — loop routes intentionally stay no-store; public short cache remains on signals/node-info only.

## Gaps for next cycle
- Add cache header tests for POST `/api/v1/product` and POST `/api/v1/relay` write routes.
- Add no-store assertions for GET list/search loop routes (`/api/v1/material`, `/api/v1/events`, material/product search).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `3118be8` | implementation | pending |
| `localloop-backend` | (plan close) | plan close | pending |
