# Micro-sprint plan 0003 — loop write route cache header tests

## Status
IN_PROGRESS

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
1. Create `tests/loop.cache.headers.test.ts` mirroring `signals.cache.headers.test.ts` pattern
2. Use minimal Fastify inject setup with mocked loop deps (reuse payloads from `loop.routes.test.ts`)
3. Assert `cache-control: no-store` on 201 responses for all four write routes

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/loop.cache.headers.test.ts`
- `bun run typecheck`

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
(pending cycle close)

## Gaps for next cycle
(pending cycle close)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| (pending) | | | |
