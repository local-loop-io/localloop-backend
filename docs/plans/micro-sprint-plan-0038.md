# Micro-sprint plan 0038 — examples mirror drift gate

## Status
COMPLETED

## Cycle
38

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: backend `6c0f3db` matches `origin/main`
- Cycle 0037 extended check B to full `docs/` (37 mirror files); `examples/`
  (16 files) remains unguarded despite aggregate-docs syncing it
- `diff -rq loop-protocol/examples` vs site mirror — currently in sync (no drift)
- Conformance gate green (37 files in check B pre-change); 238 backend tests pass
- Skip list unchanged: rfcs/ mirror, ETag federation/nodes, docs cache,
  route-level apiKey 401, org root docs

## Selected item
Extend check B to `examples/` in `scripts/check-conformance.ts`; update
SPEC-COMPLIANCE.md mirror list.

## Priority rationale
Smallest complete fix — one directory token change reuses existing walk/compare
machinery; closes the obvious post-0037 gap (docs guarded, examples not)
without touching aggregate-docs or CI; zero functional risk.

## Implementation
1. `localloop-backend/scripts/check-conformance.ts` — add `examples` to check B
   directory loop; update file header comment
2. `localloop-backend/docs/SPEC-COMPLIANCE.md` — list `examples/` in conformance
   gate mirror coverage

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Conformance gate + plan + compliance doc |

## Verification
- `bun run check:conformance` — pass (53 files in check B, including 16 examples)
- `bun test tests/conformance.test.ts` — pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (no mirror sync needed — examples already in sync)

## RSI learning
- Incremental check B expansion (docs → examples) continues the right cadence:
  each cycle adds one aggregate-docs subtree without bloating the gate in one shot.
- Examples are protocol-validated payloads; guarding them prevents silent mirror
  drift on high-value demo/reference artifacts.
- rfcs/ remains the next unguarded aggregate-docs subtree — candidate for 0039.

## Gaps for cycle 0039
- **P2** — Extend check B to `rfcs/` (aggregate-docs syncs RFC drafts)
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | (pending) | implementation + plan | pending |
