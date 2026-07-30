# Micro-sprint plan 0020 — align README test command with CONTRIBUTING

## Status
COMPLETED

## Cycle
20

## Control repository
`localloop-backend`

## Observation
- Cycle 0019 added Testing section to `CONTRIBUTING.md` documenting `bun run test` (`bun test --isolate`), `mock.module` cleanup, and metrics baselines
- Gap from 0019: README quickstart still shows bare `bun test`, which bypasses `--isolate` and can reintroduce order-dependent failures
- Remote HEAD verified at `a1fd2cd` (synced with `origin/main`)
- `bun run check:conformance` — all checks passed (schemas, docs-hub mirror, openapi routes)
- `bun run test` — 217 pass; no functional defects surfaced
- Skipped per guidance: docs routes cache policy (no clear win); node/info short cache already implemented in `federation.ts`

## Selected item
Replace bare `bun test` in README quickstart with `bun run test` and add a one-line pointer to `CONTRIBUTING.md` Testing section.

## Priority rationale
Direct follow-up from cycle 0019 closes the test-isolation docs loop. Docs-only; smallest complete change prevents contributors from bypassing `--isolate`.

## Implementation
1. `README.md` — quickstart: `bun run test` instead of `bun test`
2. `README.md` — inline comment points to CONTRIBUTING.md Testing section

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + plan |

## Verification
- No broken internal links in edited files
- `bun run test` — 217 pass

## Deploy order
1. `localloop-backend` only (docs-only changes)

## RSI learning
- Test-isolation documentation is only complete when every contributor entry point (README quickstart, CONTRIBUTING, package.json script) agrees on `bun run test`; bare `bun test` in README was the last mismatch.
- Conformance gate green at cycle 0020; cycle 0025 org-wide rescan is the next scheduled drift checkpoint — no action needed until then unless functional defects surface.

## Gaps for next cycle
- Explore functional defects or higher-value items (ETag/Last-Modified on federation/nodes, federation signature verification lab notes).
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — skip unless clear win.
- Parent workspace docs (CLAUDE.md, AGENTS.md) still show bare `bun test` in backend dev commands — out of localloop-backend scope unless org-wide docs sync is requested.
- Cycle 0025 triggers org-wide rescan; note conformance status is green pre-rescan.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `b419a61` | implementation | yes |
| `localloop-backend` | `d5ce186` | plan close (HEAD) | yes (`origin/main`) |
