# Micro-sprint plan 0033 — evidence mock.module test isolation

## Status
COMPLETED

## Cycle
33

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `3e471cc` matches `origin/main`
- Cycle 0032 closed auth-disabled 503 envelope guard; 238 tests reported pass
- Full suite currently fails 3 tests in `evidence.test.ts` when run with all files
- Root cause: `evidence.cache.headers.test.ts` (cycle 0014) uses Bun `mock.module`
  on `../src/db/evidence` at file load; `evidence.test.ts` loads afterward and
  imports the mocked module — DB integration tests see stubbed getters/list
- `evidence.test.ts` passes in isolation; failure is test-order coupling, not DB logic
- Conformance gate green; 503 envelope sweep closed per guidance
- Transactions/signals cache header tests already use route deps injection — evidence
  is the outlier still on global module mock

## Selected item
Replace `mock.module` in evidence cache header tests with optional deps on
`registerEvidenceRoutes`, matching the transactions/signals pattern.

## Priority rationale
Smallest complete P1 deliverable — restores 3 failing integration tests in full
suite with minimal production surface (optional deps param, default unchanged).

## Implementation
1. `src/routes/evidence.ts` — add `EvidenceDeps` with optional injection
2. `tests/evidence.cache.headers.test.ts` — pass stub deps, remove `mock.module`

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Route deps + test fix + plan |

## Verification
- `bun test tests/evidence.test.ts` — pass
- `bun test tests/evidence.cache.headers.test.ts` — pass
- `bun run test` — full suite pass (238)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only

## RSI learning
- Bun `mock.module` at file scope leaks across test files loaded after the mock;
  `afterAll` restore is too late if sibling files already imported the stub.
- Route deps injection (transactions/signals pattern) is the durable fix for
  cache-header tests — no global module mutation, production default unchanged.
- Full-suite runs catch ordering bugs that isolated file runs miss; cycle 0032
  green count was file-order dependent.

## Gaps for cycle 0034
- **P2** — ETag on federation/nodes; docs cache policy
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan
- Audit other test files for `mock.module` leakage (only evidence had this pattern)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `07b75c1` | implementation | yes |
| `localloop-backend` | (pending close) | plan close (HEAD) | |
