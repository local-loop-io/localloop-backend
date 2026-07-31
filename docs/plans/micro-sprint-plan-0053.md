# Micro-sprint plan 0053 — Signal governance lab boundary

## Status
COMPLETED

## Cycle
53

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `0615c37` matches `origin/main`
- Cycle 0052 closed LoopCoin settlement lab boundary; 254 tests pass
- SPEC-COMPLIANCE intentional lab boundaries listed signal governance as
  one-line prose only; no dedicated subsection or executable guard (unlike
  LoopCoin settlement pattern from cycle 0052)
- `GET /api/v1/signals` reads seeded `loop_signal_config` via
  `getLoopSignalConfig` (`src/routes/signals.ts`); no LoopVote or
  SignalProposal HTTP routes exist

## Selected item
Document signal governance lab boundary in `docs/SPEC-COMPLIANCE.md` and
add route-level regression guards asserting seeded read-only signal behavior.

## Priority rationale
First P1 gap from cycle 0052; testable behavior (signals route reads only,
hypothetical governance routes 404) matches the docs+tests pattern
established for LoopCoin settlement and §9.2 lab boundaries.

## Implementation
1. `docs/SPEC-COMPLIANCE.md` — add Signal governance lab boundary subsection
   with surface matrix; cross-reference from intentional lab boundaries list
2. `tests/signals.routes.test.ts` — describe block with three boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + tests + plan |

## Verification
- `bun test tests/signals.routes.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (docs + test changes)

## RSI learning
- Signal governance boundary spans four surfaces (read-only GET, seeded DB
  row, missing LoopVote/SignalProposal HTTP routes, omitted `approved_by`)
  — document each separately like LoopCoin settlement to avoid implying
  democratic voting runs when only migration-seeded values are published.
- Spy-on-deps read-count tests complement buildServer 404 guards for
  hypothetical governance routes without requiring Postgres.

## Gaps for cycle 0054
- **P2** — ETag on `GET /api/v1/federation/nodes` (skip unless clear win)
- **P3** — Docs route cache policy (`/openapi.json`, `/docs`)
- **Skip** — org root docs (not git-tracked); interest.ts cache refactor (done)
- **Cycle 0075** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `e7c1d26` | implementation | yes |
| `localloop-backend` | `9520778` | plan close (HEAD) | yes |
