# Micro-sprint plan 0036 — audit docs drift gate

## Status
COMPLETED

## Cycle
36

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: backend `4d68e3e`, site `9249ced`, loop-protocol `2f524ed`
  all match `origin/main`
- Cycle 0035 re-synced audit docs via aggregate-docs; mirror currently in sync
  (`diff -rq loop-protocol/docs/audit` vs site mirror — no differences)
- Conformance gate check B byte-compares schemas/, contexts/, openapi.json, and
  SPECIFICATION.md only — audit doc drift is unchecked (gap from 0035)
- `aggregate-docs.sh` syncs full `docs/` including audit snapshots but is not
  run automatically on provider changes
- Skip list unchanged: ETag federation/nodes, docs cache, route-level apiKey 401,
  org root docs

## Selected item
Extend check B in `scripts/check-conformance.ts` to byte-compare
`loop-protocol/docs/audit/` against the docs-hub mirror.

## Priority rationale
Smallest complete fix (Option A) — reuses existing walk/compareFile machinery;
one directory addition prevents recurrence of cycle 0035 drift without CI or
aggregate-docs changes; zero functional risk.

## Implementation
1. `localloop-backend/scripts/check-conformance.ts` — add `docs/audit` to check
   B directory loop; update file header comment

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Conformance gate + plan |

## Verification
- `bun run check:conformance` — pass (22 files in check B, including 6 audit)
- `bun test tests/conformance.test.ts` — pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only

## RSI learning
- Check B extension is the right layer: aggregate-docs is the sync mechanism,
  conformance gate is the drift detector — keep them separate.
- Adding a directory to the existing loop is cheaper than a new script or CI hook
  and runs in both local tests and `protocol-parity.yml`.
- Audit docs are historical snapshots but still published via the docs hub; they
  belong in the same byte-parity gate as schemas and spec artifacts.

## Gaps for cycle 0037
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | (pending) | implementation + plan | pending |
