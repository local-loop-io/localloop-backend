# Micro-sprint plan 0020 — align README test command with CONTRIBUTING

## Status
IN_PROGRESS

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
2. `README.md` — one-line note: see CONTRIBUTING.md Testing for isolation guidance

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + plan |

## Verification
- No broken internal links in edited files
- `bun run test` — pass (sanity check)

## Deploy order
1. `localloop-backend` only (docs-only changes)

## RSI learning
(pending)

## Gaps for next cycle
(pending)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | — | implementation | — |
| `localloop-backend` | — | plan close (HEAD) | — |
