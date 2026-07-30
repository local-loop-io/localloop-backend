# Micro-sprint plan 0019 — document test isolation guidance

## Status
IN_PROGRESS

## Cycle
19

## Control repository
`localloop-backend`

## Observation
- Cycle 0018 fixed cross-file test pollution and enabled `bun test --isolate` in `package.json`; 217 tests pass
- Gap from 0018: document `--isolate` requirement in CONTRIBUTING.md when adding `mock.module` tests
- Remote HEAD verified at `25f6164` (synced with `origin/main`)
- `CONTRIBUTING.md` exists but has no testing guidance beyond `bun test` in setup
- Skipped per guidance: docs routes cache policy (no clear win)

## Selected item
Add a Testing section to `CONTRIBUTING.md` covering `bun test --isolate`, `mock.module` cleanup, and baseline metrics assertions.

## Priority rationale
Direct follow-up from cycle 0018. Prevents future contributors from reintroducing order-dependent failures. Docs-only; smallest complete change.

## Implementation
1. `CONTRIBUTING.md` — add Testing section:
   - Run tests via `bun run test` (`bun test --isolate`)
   - Why per-file isolation matters for `mock.module`
   - `afterAll` restore pattern for mocked modules
   - Baseline snapshot pattern for module-level metrics counters

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + plan |

## Verification
- No broken internal links in edited files
- `bun run test` — pass (optional sanity check)

## Deploy order
1. `localloop-backend` only (docs-only changes)

## RSI learning
(pending cycle close)

## Gaps for next cycle
(pending cycle close)

## Commit SHAs
(pending)
