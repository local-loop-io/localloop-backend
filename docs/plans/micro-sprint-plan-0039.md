# Micro-sprint plan 0039 — rfcs mirror drift gate

## Status
COMPLETED

## Cycle
39

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: backend `13774f7` matches `origin/main`
- Cycle 0038 extended check B to `examples/` (53 mirror files); `rfcs/` (7 files)
  remains unguarded despite aggregate-docs syncing it
- `diff -rq loop-protocol/rfcs` vs site mirror — currently in sync (no drift)
- Conformance gate green (53 files in check B pre-change); backend tests pass
- Skip list unchanged: ETag federation/nodes, docs cache, route-level apiKey 401,
  org root docs

## Selected item
Extend check B to `rfcs/` in `scripts/check-conformance.ts`; update
SPEC-COMPLIANCE.md mirror list.

## Priority rationale
Smallest complete fix — one directory token change reuses existing walk/compare
machinery; closes the obvious post-0038 gap (examples guarded, rfcs not)
without touching aggregate-docs or CI; zero functional risk.

## Implementation
1. `localloop-backend/scripts/check-conformance.ts` — add `rfcs` to check B
   directory loop; update file header comment
2. `localloop-backend/docs/SPEC-COMPLIANCE.md` — list `rfcs/` in conformance
   gate mirror coverage

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Conformance gate + plan + compliance doc |

## Verification
- `bun run check:conformance` — pass (60 files in check B, including 7 rfcs)
- `bun test tests/conformance.test.ts` — pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (no mirror sync needed — rfcs already in sync)

## RSI learning
- Incremental check B expansion (examples → rfcs) completes aggregate-docs
  subtree coverage for all currently synced protocol directories.
- RFC drafts are governance artifacts; guarding them prevents silent mirror drift
  on process/policy docs referenced from the site.
- With schemas, contexts, docs, examples, and rfcs all gated, remaining skip
  items are behavioral (ETag, cache) or optional envelope polish — not mirror
  drift.

## Gaps for cycle 0040
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `aaeb85f` | implementation + plan | yes |
