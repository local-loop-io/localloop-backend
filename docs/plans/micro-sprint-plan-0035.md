# Micro-sprint plan 0035 — docs-hub audit mirror sync

## Status
COMPLETED

## Cycle
35

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `065759c` matches `origin/main`
- Cycle 0034 closed mock.module audit; 238 tests pass; conformance gate green
- Cycle 0030 fixed `localloop.github.io` → `localloop-site` path refs in
  `loop-protocol/docs/audit/` (4 files); provider commit `2f524ed`
- Docs-hub mirror at `localloop-site/public/projects/loop-protocol/docs/audit/`
  still carried pre-0030 stale refs — `diff -rq` reported 4 differing files
- Conformance gate (check B) only byte-compares schemas, contexts, openapi.json,
  and SPECIFICATION.md — audit doc drift is unchecked
- Skip list unchanged: ETag federation/nodes, docs cache, route-level apiKey 401,
  org root docs

## Selected item
Re-sync loop-protocol audit docs into the localloop-site docs-hub mirror via
`scripts/aggregate-docs.sh` (local sibling checkout).

## Priority rationale
Smallest complete P1 deliverable — closes docs-hub mirror drift introduced when
cycle 0030 updated the provider without running aggregate-docs on the consumer;
zero functional risk; aligns published audit snapshots with canonical source.

## Implementation
1. `localloop-site` — run `./scripts/aggregate-docs.sh`; commit synced audit files

## Repositories
| Repo | Role |
|------|------|
| `localloop-site` | Docs-hub mirror sync (consumer) |
| `localloop-backend` | Plan (control repo) |

## Verification
- `diff -rq loop-protocol/docs/audit localloop-site/public/projects/loop-protocol/docs/audit` — no differences
- `bun run test` in `localloop-site` — 28 pass
- `bun run test` + `bun run typecheck` in `localloop-backend` — pass

## Deploy order
1. `localloop-site` (consumer mirror)
2. `localloop-backend` (plan close)

## RSI learning
- Provider-only fixes (cycle 0030 loop-protocol audit paths) do not propagate to
  the docs-hub mirror until aggregate-docs runs on localloop-site; conformance
  gate check B does not cover audit docs.
- `aggregate-docs.sh` syncs the full `docs/` tree including audit snapshots — one
  command closes multi-file drift without hand-editing mirror copies.
- CHANGELOG.md also drifted and was picked up by aggregate-docs alongside the four
  audit files.

## Gaps for cycle 0036
- **P2** — Extend conformance gate or aggregate-docs CI to detect audit-doc drift
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P3** — route-level apiKey 401 §8.3 envelope (optional; skip unless clear gap)
- **Skip** — route-level apiKey 503 duplicate; org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-site` | `9249ced` | mirror sync | yes |
| `localloop-backend` | `f577709` | plan close | yes |
