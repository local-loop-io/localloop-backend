# Micro-sprint plan 0051 — Federate empty X-Timestamp regression guard

## Status
COMPLETED

## Cycle
51

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `155326d` matches `origin/main`
- Cycle 0050 org rescan: all green (247 tests, 61 mirror files, 59 site pages)
- Cycles 0027–0028 closed empty/whitespace regression guards for
  `X-Node-Signature` and `X-Node-ID` on `/api/v1/federate/*`
- `requireNodeHeaders` in `src/routes/federate.ts` rejects empty/whitespace
  `X-Timestamp` via `timestamp.trim() === ''` (lines 87–89) with message
  "Node-to-node requests require an X-Timestamp header"
- Stale/malformed timestamp tests exist; empty/whitespace `X-Timestamp` had no
  explicit regression guard — last untested sibling of the §9.2 presence trio

## Selected item
Add route-level regression tests asserting `/api/v1/federate/announce` and
`/api/v1/federate/offer` reject empty and whitespace-only `X-Timestamp` with
§8.3 `UNAUTHORIZED` envelope.

## Priority rationale
Natural complement to cycles 0027–0028 — same `trim() === ''` guard in
`requireNodeHeaders` but untested third header; completes the §9.2 presence
regression suite without production churn.

## Implementation
1. `tests/federate.routes.test.ts` — add describe block with four boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/federate.routes.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- The §9.2 presence trio (`X-Node-ID`, `X-Node-Signature`, `X-Timestamp`) each
  share `trim() === ''` guards in `requireNodeHeaders`; regression guards were
  added incrementally (signature → node-id → timestamp) — audit sibling headers
  when closing one boundary test theme.
- Asserting the specific error message for timestamp absence distinguishes the
  timestamp guard from the combined node-id/signature guard message.

## Gaps for cycle 0052
- **P1** — LoopCoin settlement lab boundary (transactions recorded, not executed)
- **P1** — Signal governance lab boundary (LoopVote out of scope; signals seeded)
- **P2** — ETag on `GET /api/v1/federation/nodes` (skip unless clear win)
- **P3** — Docs route cache policy (`/openapi.json`, `/docs`)
- **Skip** — org root docs (not git-tracked); interest.ts cache refactor (done)
- **Cycle 0075** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `8e2293d` | implementation | pending |
| `localloop-backend` | `54a6358` | plan close (HEAD) | pending |
