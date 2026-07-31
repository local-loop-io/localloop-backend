# Micro-sprint plan 0052 — LoopCoin settlement lab boundary

## Status
COMPLETED

## Cycle
52

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `4793956` matches `origin/main`
- Cycle 0051 closed federate empty X-Timestamp regression guard; 251 tests pass
- SPEC-COMPLIANCE intentional lab boundaries listed LoopCoin settlement as
  one-line prose only; no dedicated subsection or executable guard (unlike
  §9.2 X-Node-Signature pattern from cycle 0023–0024)
- `POST /api/v1/transaction` persists JSON-LD via `createLoopTransaction`
  (`src/db/loop.ts`); no LoopCoin wallet/transfer HTTP routes exist

## Selected item
Document LoopCoin settlement lab boundary in `docs/SPEC-COMPLIANCE.md` and
add route-level regression guards asserting record-only transaction behavior.

## Priority rationale
First P1 gap from cycle 0051; testable behavior (transaction routes persist
payloads, hypothetical loopcoin routes 404) matches the docs+tests pattern
established for §9.2 lab boundaries.

## Implementation
1. `docs/SPEC-COMPLIANCE.md` — add LoopCoin settlement lab boundary subsection
   with surface matrix; cross-reference from intentional lab boundaries list
2. `tests/transactions.routes.test.ts` — describe block with three boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + tests + plan |

## Verification
- `bun test tests/transactions.routes.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (docs + test changes)

## RSI learning
- LoopCoin settlement boundary spans three surfaces (transaction record-only,
  missing wallet HTTP routes, node-info capability advertisement) — document
  each separately like §9.2 signature surfaces to avoid implying a currency
  engine runs when only JSON-LD persistence exists.
- Spy-on-deps tests in isolated Fastify apps complement buildServer 404 guards
  for “not implemented” routes without requiring Postgres.

## Gaps for cycle 0053
- **P1** — Signal governance lab boundary (LoopVote out of scope; signals seeded)
- **P2** — ETag on `GET /api/v1/federation/nodes` (skip unless clear win)
- **P3** — Docs route cache policy (`/openapi.json`, `/docs`)
- **Skip** — org root docs (not git-tracked); interest.ts cache refactor (done)
- **Cycle 0075** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `c992c33` | implementation | yes |
| `localloop-backend` | `9c4fc7d` | plan close (HEAD) | pending |
