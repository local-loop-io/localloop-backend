# Micro-sprint plan 0002 — handshake no-store cache test

## Status
COMPLETED

## Cycle
2

## Control repository
`localloop-backend`

## Observation
- Cycle 0001 gaps: missing POST handshake cache assertion; evaluate nodes list cache policy
- `federation.ts` already calls `setNoStore(reply)` on handshake handler (line 130)
- `node.cache.headers.test.ts` covered node/info (public short) and federation/nodes (no-store) only
- `GET /api/v1/federation/nodes` embeds dynamic `updated_at: new Date().toISOString()` per request

## Selected item
Add `Cache-Control: no-store` assertion for `POST /api/v1/federation/handshake` in `tests/node.cache.headers.test.ts`.

## Priority rationale
Missing test coverage for an existing, correct behavior. Smallest independently shippable diff; no production code change required.

## Federation nodes cache evaluation
**Decision: keep no-store (do not implement short public cache).**
- Response includes per-request `updated_at` timestamp; caching would serve stale freshness metadata.
- Node list mutates on handshake writes; 30s cache could hide newly registered peers in lab demos.
- Deferred unless spec adds ETag/last-modified semantics.

## Implementation
1. Extended `node.cache.headers.test.ts` with handshake POST test (schemas/parsers registered like `federation.routes.test.ts`)
2. Assert `cache-control: no-store` on successful 202 response

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/node.cache.headers.test.ts` — 3 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Federation cache header coverage is now complete for all three federation routes; per-route tests catch regressions if a blanket hook is reintroduced.
- Dynamic `updated_at` on nodes list is a concrete reason to reject short public cache without additional cache validators.

## Gaps for next cycle
- Explore highest-value defect from LEDGER backlog (prefer functional fixes over hygiene stamps).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- Audit other write routes for missing cache header test coverage (loop material/offer/match/transfer).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `6899f3c` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
