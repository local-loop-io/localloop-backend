# Micro-sprint plan 0041 — transaction POST apiKey guard route test

## Status
COMPLETED

## Cycle
41

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `77e7c1e` matches `origin/main`
- Cycle 0040 closed evidence apiKey guard route tests; 241 tests pass
- `requireApiKey` protects `POST /api/v1/transaction` (`src/routes/transactions.ts`)
  but `apiKey.routes.test.ts` had no route-level coverage for transaction writes
- Transactions routes already expose deps injection (cycles 0033+); cache-header
  and route tests reuse stub deps without `mock.module`
- Skip list unchanged: federate+apiKey combo, ETag, docs cache, envelope body
  assertions, org root docs

## Selected item
Add route-level test asserting `POST /api/v1/transaction` returns 401 when API
key protection is enabled and no credentials are supplied, before the transaction
handler runs.

## Priority rationale
Smallest shippable post-evidence item — test-only, follows established
`apiKey.routes.test.ts` + transaction deps injection patterns; closes the last
`requireApiKey` write route without route-level guard coverage outside federate
(§9.2 headers tested first) and interest (separate file).

## Implementation
1. `tests/apiKey.routes.test.ts` — import `registerTransactionRoutes`,
   `registerLoopProtocolParsers`, stub deps with throwing `createLoopTransaction`,
   assert 401 on POST without `x-api-key`

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/apiKey.routes.test.ts` — pass (1 new case)
- `bun run test` — full suite pass (242)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Transaction POST auth guard test mirrors loop.search.auth pattern: throwing
  deps prove the guard short-circuits before handler/idempotency logic runs.
- `registerLoopProtocolParsers` + `registerLoopSchemas` required for transaction
  route registration in isolated Fastify apps (same as transactions.routes.test).
- Remaining `requireApiKey` surfaces without `apiKey.routes.test.ts` coverage:
  federate announce/offer (when apiKey enabled).

## Gaps for cycle 0042
- **P2** — federate announce/offer apiKey guard route tests (when apiKey enabled)
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope body assertions (optional)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `747b167` | implementation | yes |
| `localloop-backend` | `c9a94fc` | plan close (HEAD) | yes |
