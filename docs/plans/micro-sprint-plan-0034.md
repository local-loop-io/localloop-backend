# Micro-sprint plan 0034 — mock.module audit closure

## Status
COMPLETED

## Cycle
34

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `2b53661` matches `origin/main`
- Cycle 0033 replaced evidence cache-header `mock.module` with route deps
  injection; 238 tests pass
- Gap from 0033: audit remaining tests for `mock.module` leakage
- `grep -r 'mock\.module' tests/` returns zero matches
- `grep -r 'mock\.(module|restore|spyOn)' tests/` returns zero matches
- All nine `*.cache.headers.test.ts` files use route deps injection
- `CONTRIBUTING.md` still documented the old `mock.module` pattern and cited
  `evidence.cache.headers.test.ts` as canonical — stale after cycle 0033

## Selected item
Close the mock.module audit: update `CONTRIBUTING.md` to document route deps
injection as the preferred pattern and note zero remaining `mock.module` usage.

## Priority rationale
Smallest complete P1 deliverable — audit found no leaking mocks to refactor;
contributor docs were the only gap preventing audit closure.

## Implementation
1. `CONTRIBUTING.md` — replace `mock.module` canonical section with route deps
   injection guidance; mark `mock.module` as avoid for route tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + plan |

## Verification
- `bun run test` — full suite pass (238)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only

## RSI learning
- Post-0033 grep confirms zero `mock.module` in tests; deps injection is now
  universal for cache-header route tests — no further refactors needed.
- Contributor docs must track test-pattern migrations; stale `mock.module`
  guidance would invite regressions on the next cache-header test.
- Audit-only cycles are valid when observation + docs close the gap without
  production code changes.

## Gaps for cycle 0035
- **P2** — ETag on federation/nodes; docs cache policy
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `a729435` | implementation | yes |
