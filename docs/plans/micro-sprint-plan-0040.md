# Micro-sprint plan 0040 — evidence apiKey guard route tests

## Status
COMPLETED

## Cycle
40

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `8403a93` matches `origin/main`
- Mirror drift detection theme closed (cycles 0035–0039); check B covers 60 files
- `bun run check:conformance` — pass; `bun test` — 238 pass
- `requireApiKey` protects evidence GET-by-id, GET list, and POST search
  (`src/routes/evidence.ts`) but `apiKey.routes.test.ts` covers only loop
  writes, federation handshake, and payments — evidence has zero route-level
  auth guard tests
- Skip list unchanged: ETag federation/nodes, docs cache, route-level apiKey
  401 envelope shape assertions, org root docs

## Selected item
Add route-level tests asserting all three evidence routes return 401 when API
key protection is enabled and no credentials are supplied.

## Priority rationale
Smallest shippable post-mirror item — test-only, follows established
`apiKey.routes.test.ts` + route deps injection patterns (cycle 0033/0034);
closes the only `requireApiKey` route group with no route-level guard coverage
outside interest (separate file) and federate (§9.2 headers tested first).

## Implementation
1. `tests/apiKey.routes.test.ts` — import `registerEvidenceRoutes`, stub deps,
   `it.each` over the three protected evidence routes

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/apiKey.routes.test.ts` — pass (3 new cases)
- `bun run test` — full suite pass
- `bun run check:conformance` — pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Post-mirror pivot: auth guard route tests are the next highest-value gap when
  conformance and cache-header themes are closed.
- Evidence routes already expose deps injection — auth tests reuse the same
  stubs as cache-header tests without `mock.module`.
- Remaining `requireApiKey` surfaces without `apiKey.routes.test.ts` coverage:
  `POST /api/v1/transaction`, federate announce/offer (when apiKey enabled).

## Gaps for cycle 0041
- **P2** — transaction POST apiKey guard route test; federate apiKey+§9.2 combo
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope body assertions (optional)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `884227f` | implementation + plan | yes |
