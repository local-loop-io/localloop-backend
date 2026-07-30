# Micro-sprint plan 0030 — loop-protocol audit repo path refs

## Status
COMPLETED

## Cycle
30

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: backend `11af1c5`, loop-protocol `3dd2d05` match `origin/main`
- Cycle 0029 closed payment 503 §8.3 envelope regression tests (236 tests)
- P3 backlog: 11 historical `localloop.github.io` path refs across 4 loop-protocol
  audit files (cycle 0029 counted 12 including CHANGELOG historical note)
- On-disk canonical docs hub checkout: `localloop-site` (not `localloop.github.io`)
- Live URLs (`localloop.urbnia.com`) unchanged — path refs only

## Selected item
Replace retired `localloop.github.io` repo path prefixes with `localloop-site` in
loop-protocol audit snapshots.

## Priority rationale
Docs-only alignment with org naming (`localloop-site`); zero functional risk;
closes deferred P3 from cycles 0025–0029.

## Implementation
1. `loop-protocol/docs/audit/discovery.md` — 4 repo/path refs
2. `loop-protocol/docs/audit/technical-debt.md` — 3 path refs (+ qualify
   relative `app/docs/api/page.jsx` with repo prefix)
3. `loop-protocol/docs/audit/state-of-development.md` — 3 path refs
4. `loop-protocol/docs/audit/spec-implementation-divergence.md` — reword stale-ref
   note to cite `localloop-site` without implying a live github.io domain

## Repositories
| Repo | Role |
|------|------|
| `loop-protocol` | Audit doc path ref fixes |
| `localloop-backend` | Plan (control repo) |

## Verification
- `npm test` in `loop-protocol` — pass
- Grep `loop-protocol/docs/audit` for `localloop.github.io` — 0 hits

## Deploy order
1. `loop-protocol` (provider / docs source)
2. `localloop-backend` (plan close)

## RSI learning
- Audit snapshots are historical; path ref fixes do not require mirroring to
  `localloop-site/public/projects/loop-protocol/` unless content is republished.
- `CHANGELOG.md` retains one past-tense mention of the correction — intentional.
- Relative paths in audit tables (e.g. `app/docs/api/page.jsx`) should include
  repo prefix when sibling refs use full paths.

## Gaps for cycle 0031
- **P1** — apiKey 503 unit test when enabled but no key configured
- **P2** — ETag on federation/nodes; docs cache policy
- **Skip** — org root `AGENTS.md` / parent workspace docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `loop-protocol` | `2f524ed` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
