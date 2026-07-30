# Micro-sprint plan 0037 — full docs mirror drift gate

## Status
COMPLETED

## Cycle
37

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: backend `31f4fbf`, site `9249ced`, loop-protocol `2f524ed`
  all match `origin/main`
- Cycle 0036 extended check B to `docs/audit/` only (6 files); aggregate-docs
  syncs the full `docs/` tree (21 files) — governance, compliance, and guide
  docs remain unguarded
- `diff -rq loop-protocol/docs` vs site mirror — currently in sync (no drift)
- Conformance gate green (22 files in check B); 238 backend tests pass
- Skip list unchanged: ETag federation/nodes, docs cache, route-level apiKey 401,
  org root docs

## Selected item
Extend check B from `docs/audit/` to full `docs/` in
`scripts/check-conformance.ts`; update SPEC-COMPLIANCE.md mirror list.

## Priority rationale
Smallest complete fix — one directory token change reuses existing walk/compare
machinery; closes the obvious post-0036 gap (audit-only vs full docs tree)
without touching aggregate-docs or CI; zero functional risk.

## Implementation
1. `localloop-backend/scripts/check-conformance.ts` — replace `docs/audit` with
   `docs` in check B directory loop; update file header comment
2. `localloop-backend/docs/SPEC-COMPLIANCE.md` — list `docs/` in conformance
   gate mirror coverage

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Conformance gate + plan + compliance doc |

## Verification
- `bun run check:conformance` — pass (37 files in check B, including 21 docs)
- `bun test tests/conformance.test.ts` — pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only

## RSI learning
- Incremental check B expansion (audit → full docs) is the right cadence: each
  cycle adds one aggregate-docs subtree without bloating the gate in one shot.
- SPEC-COMPLIANCE.md must track check B coverage; stale mirror lists invite
  false confidence about what the gate actually guards.
- Examples and rfcs remain unguarded mirror paths — candidates for 0038 if no
  higher-value functional gap appears.

## Gaps for cycle 0038
- **P2** — Extend check B to `examples/` (16 files; protocol-validated payloads)
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `7237ee7` | implementation + plan | yes |
