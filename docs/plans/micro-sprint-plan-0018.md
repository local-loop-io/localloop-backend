# Micro-sprint plan 0018 — full-suite test isolation fixes

## Status
COMPLETED

## Cycle
18

## Control repository
`localloop-backend`

## Observation
- Cycle 0017 closed the cache-header theme; guidance pivots to functional defects / broken tests
- Remote HEAD verified at `922aed3` (synced with `origin/main`)
- `bun test` full suite: **4 deterministic failures**, all pass in isolation
  1. `utility.routes.test.ts` — expects `loop_material_created === 0` but `metrics.keys.test.ts` runs first (alphabetically) and calls `incrementMetric('loop_material_created')`, polluting the module-level counter Map
  2. `evidence.test.ts` (3 cases) — `evidence.cache.headers.test.ts` registers a top-level `mock.module('../src/db/evidence', …)` that leaks to later files; DB integration tests receive stubbed functions instead of real implementations
- Conformance gate passes; no open TODO/FIXME in backend
- Skipped per guidance: GET-by-id loop cache tests, ETag on federation/nodes, docs cache policy

## Selected item
Fix full-suite test isolation: baseline-aware metrics assertion, evidence mock cleanup, and `bun test --isolate` for per-file module scoping.

## Priority rationale
Broken tests block CI signal. Four failures are deterministic cross-file pollution, not product bugs. Smallest fix restores green `bun test` without production code changes.

## Implementation
1. `tests/utility.routes.test.ts` — compare metric values against `getMetricsSnapshot()` baseline instead of hardcoded zero
2. `tests/evidence.cache.headers.test.ts` — capture real evidence module before mock; restore via `mock.module` in `afterAll`
3. `package.json` — `"test": "bun test --isolate"` scopes `mock.module` to registering file (Bun 1.3.14)
4. `.github/workflows/ci.yml` — use `bun run test` so CI picks up isolated runner

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test fixes + plan |

## Verification
- `bun run typecheck` — pass
- `bun run test` — 217 pass, 0 fail (full suite with `--isolate`)
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Module-level metrics counters and Bun `mock.module` both leak across test files in the default runner; failures look like product bugs but are order-dependent pollution.
- `bun test --isolate` (Bun 1.3.14) is the correct fix for `mock.module` cross-file leaks; `afterAll` restore alone is insufficient when files are preloaded.
- Metrics route tests should assert against a baseline snapshot, not assume process-global counters start at zero.

## Gaps for next cycle
- Explore functional defects or docs/conformance drift (cache theme closed; pivot complete).
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — functional item if spec UI caching is desired.
- Consider documenting `bun test --isolate` requirement in CONTRIBUTING.md when adding new `mock.module` tests.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `8294d4e` | implementation | yes |
| `localloop-backend` | `117b179` | plan close (HEAD) | pending |
