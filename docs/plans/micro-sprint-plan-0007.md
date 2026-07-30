# Micro-sprint plan 0007 — product and relay cache header tests

## Status
COMPLETED

## Cycle
7

## Control repository
`localloop-backend`

## Observation
- Cycle 0006 gaps: cache header tests for POST `/api/v1/product` and POST `/api/v1/relay`; GET list/search no-store assertions deferred
- `loop.cache.headers.test.ts` covers five write routes via shared `it.each` table
- `loop.ts` applies blanket `setNoStore` via `onRequest` hook; product and relay inherit same policy
- Remote HEAD verified at `ee82f80` (synced with `origin/main`)

## Selected item
Extend `tests/loop.cache.headers.test.ts` to assert `Cache-Control: no-store` on POST `/api/v1/product` and POST `/api/v1/relay`.

## Priority rationale
Product and relay are the remaining lab write routes excluded from cycles 0003–0006. Production behavior is correct via the plugin hook; missing tests leave these paths undocumented and unguarded against hook regressions. Both routes fit cleanly in one `it.each` extension (relay returns 202, not 201).

## Implementation
1. Add `productPayload` aligned with `loop.routes.test.ts`
2. Add `relayPayload` aligned with relay test in `loop.routes.test.ts`
3. Fix `createLoopProduct` mock to return payload id (matches other create mocks)
4. Extend `it.each` table with product and relay; add expected status column (201 vs 202)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts` — 7 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Product and relay complete the write-route cache header table; relay's 202 response required adding an expected-status column to the shared `it.each` without splitting tests.
- `createLoopProduct` mock in cache header tests needed the same payload-id pattern as other create mocks for product POST to succeed.

## Gaps for next cycle
- Add no-store assertions for GET list/search loop routes (`/api/v1/material`, `/api/v1/events`, material/product search).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `dbe0fcc` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | — |
