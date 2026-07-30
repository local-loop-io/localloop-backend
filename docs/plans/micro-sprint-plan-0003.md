# Micro-sprint plan 0003 — loop write route cache header tests

## Status
COMPLETED

## Cycle
3

## Control repository
`localloop-backend`

## Observation
- Cycle 0002 gaps: audit loop write routes (material/offer/match/transfer) for missing cache header test coverage
- LEDGER backlog: node/info short public cache closed in cycle 0001; no open functional defects
- `loop.ts` applies blanket `setNoStore` via `onRequest` hook (cycle 031 lineage) but no handler-level cache header tests exist
- Auth status and GET `/api/interest` already have dedicated cache header tests; interest stream tests cover CORS but not `Cache-Control`

## Selected item
Add `Cache-Control: no-store` assertions for loop lab write routes (`POST /api/v1/material`, `/offer`, `/match`, `/transfer`) in a new `tests/loop.cache.headers.test.ts`.

## Priority rationale
Security-sensitive write responses must not be cached by intermediaries. Production behavior is correct; missing tests leave regressions undetected if the blanket hook is removed or narrowed. Smallest independently shippable diff with meaningful coverage of the core lab demo flow.

## Implementation
1. Created `tests/loop.cache.headers.test.ts` mirroring `signals.cache.headers.test.ts` pattern
2. Minimal Fastify inject setup with mocked loop deps (payloads aligned with `loop.routes.test.ts`)
3. `it.each` asserts `cache-control: no-store` on 201 responses for all four write routes

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts` — 4 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Loop write routes rely on a plugin-wide `onRequest` no-store hook; per-route inject tests document the security posture and catch hook removal even when individual handlers omit explicit headers.
- LEDGER backlog had no open functional defects; test coverage for the lab demo write chain was the highest-value gap from cycle 0002.

## Gaps for next cycle
- Add `Cache-Control: no-cache` assertion for GET `/api/interest/stream` (SSE; distinct from REST no-store).
- Audit remaining loop routes (material-status, product writes, GET search/list) for cache policy tests.
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `09cf681` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
