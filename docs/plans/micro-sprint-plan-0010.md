# Micro-sprint plan 0010 — federate write route cache header tests

## Status
COMPLETED

## Cycle
10

## Control repository
`localloop-backend`

## Observation
- Cycle 0009 gaps: GET-by-id and protocol-contract material search cache assertions marked OPTIONAL (same loop plugin `onRequest` hook already exercised 15 times)
- LEDGER backlog: node/info short public cache closed in cycle 0001; federation registry cache covered in cycles 0001–0002 (`node.cache.headers.test.ts`)
- `federate.ts` (spec §8.2 node-to-node) applies its own `onRequest` `setNoStore` hook — distinct from `loop.ts` and `federation.ts`
- `federate.routes.test.ts` covers §9.2 headers and payloads but not `Cache-Control`
- Remote HEAD verified at `f8cff53` (synced with `origin/main`)

## Selected item
Add `Cache-Control: no-store` assertions for `POST /api/v1/federate/announce` and `POST /api/v1/federate/offer` in a new `tests/federate.cache.headers.test.ts`.

## Priority rationale
Federate routes use a separate plugin hook from loop/federation cache tests. Node-to-node write responses must not be cached. Production behavior is correct (cycle 029 lineage); missing tests leave §8.2 paths undocumented and unguarded if the federate hook is removed. Distinct behavior vs redundant GET-by-id loop assertions.

## Skipped optional items
- GET-by-id loop cache tests — same `loop.ts` hook already covered 15 times; low marginal value per cycle 0010 guidance
- Protocol-contract material search cache — same loop hook; optional

## Implementation
1. Created `tests/federate.cache.headers.test.ts` mirroring `federate.routes.test.ts` setup
2. `it.each` asserts `cache-control: no-store` on 202 responses for announce and offer
3. No production changes required

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/federate.cache.headers.test.ts` — 2 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Federate §8.2 routes have their own plugin-wide `onRequest` no-store hook, separate from loop and federation registry plugins; cache regressions on one plugin are not caught by tests on another.
- After cycle 0010, cache header test coverage spans loop (15), federation registry (3), federate (2), signals (1), cities (1), interest (1), SSE streams (2), health/auth/metrics/utility — GET-by-id loop routes remain optional same-hook assertions.

## Gaps for next cycle
- Remove unused `setPublicShortCache` import from `loop.ts` (maintainability; flagged since cycle 0006).
- Add cache header tests for transactions, evidence, or payments plugins (each has its own `onRequest` hook).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `d73f680` | implementation | yes |
| `localloop-backend` | `0c72b3c` | plan close (HEAD) | yes (`origin/main`) |
