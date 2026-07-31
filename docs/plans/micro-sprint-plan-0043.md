# Micro-sprint plan 0043 — apiKey route §8.3 UNAUTHORIZED envelope assertion

## Status
COMPLETED

## Cycle
43

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `d92ee9e` matches `origin/main`
- Cycle 0042 closed federate apiKey guard route tests; 244 tests pass
- `bun run check:conformance` — all checks passed
- `requireApiKey` emits `sendSpecError('UNAUTHORIZED', 'Unauthorized')` on 401
  (`src/security/apiKey.ts`); unit test checks status only; route tests check
  status only across 10 cases
- apiKey guard route theme CLOSED; ETag/docs cache skipped per guidance

## Selected item
Add §8.3 UNAUTHORIZED envelope body assertions to ONE representative apiKey
route test (`blocks loop writes without api key`) — not all 10 cases.

## Priority rationale
Smallest shippable P3 polish — test-only, one test, documents that route-level
apiKey 401 responses carry the spec envelope without churning every guard case.

## Implementation
1. `tests/apiKey.routes.test.ts` — assert `error.code` and `error.message` on
   the loop material POST guard test

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/apiKey.routes.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Route-level apiKey 401 already emits the §8.3 envelope via `sendSpecError`; one
  representative route assertion locks the contract without duplicating across
  all 10 guard cases.
- Loop material POST is the canonical guard exemplar (first test, minimal deps,
  no §9.2 header noise).
- apiKey guard + envelope polish theme now closed; next cycles should pivot to
  behavioral/cache items or functional defects.

## Gaps for cycle 0044
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **Skip** — route-level apiKey 503 duplicate (unit test covers it); org root
  docs (not git-tracked); remaining apiKey 401 envelope cases (avoid churn)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | (pending) | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | yes |
