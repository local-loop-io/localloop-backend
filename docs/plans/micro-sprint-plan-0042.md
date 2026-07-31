# Micro-sprint plan 0042 — federate announce/offer apiKey guard route tests

## Status
COMPLETED

## Cycle
42

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `2db5978` matches `origin/main`
- Cycle 0041 closed transaction POST apiKey guard; 242 tests pass
- `requireApiKey` protects `POST /api/v1/federate/announce` and
  `POST /api/v1/federate/offer` (`src/routes/federate.ts`) before §9.2 node
  header checks, but `apiKey.routes.test.ts` had no route-level coverage
- Federate routes already expose deps injection; `federate.routes.test.ts`
  covers §9.2 headers with apiKey disabled (default config)

## Selected item
Add route-level tests asserting federate announce/offer return 401 when API key
protection is enabled and no credentials are supplied, before handler/deps run.

## Priority rationale
Smallest shippable post-transaction item — test-only, follows established
`apiKey.routes.test.ts` pattern; closes last `requireApiKey` write routes without
route-level guard coverage in that file.

## Implementation
1. `tests/apiKey.routes.test.ts` — import `registerFederateRoutes`,
   `registerLoopProtocolParsers`, stub deps with throwing handlers, assert 401
   on POST without `x-api-key` (with valid §9.2 headers present)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/apiKey.routes.test.ts` — pass (2 new cases, 10 total)
- `bun run test` — full suite pass (244)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Federate apiKey guard runs before §9.2 node header checks; guard tests can
  supply valid node headers and omit only `x-api-key` to isolate the apiKey path.
- `it.each` keeps announce/offer guard cases DRY while throwing deps prove
  short-circuit before `insertLoopEvent` / `getLoopMaterial`.
- All `requireApiKey` write routes now have route-level coverage in
  `apiKey.routes.test.ts`; remaining gaps are non-guard (ETag, cache, envelope).

## Gaps for cycle 0043
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope body assertions (optional)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `cf6a264` | implementation | yes |
| `localloop-backend` | `147059b` | plan close (HEAD) | yes |
