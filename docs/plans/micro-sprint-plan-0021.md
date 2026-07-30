# Micro-sprint plan 0021 — Core-DP search auth guard tests

## Status
COMPLETED

## Cycle
21

## Control repository
`localloop-backend`

## Observation
- Cycle 0020 closed README test-command docs; conformance green; 217 tests pass
- Remote HEAD verified at `8e1588b` (synced with `origin/main`)
- `bun run check:conformance` — all checks passed
- Org workspace root is not a git repo — CLAUDE.md/AGENTS.md `bun test` → `bun run test` sync skipped per guidance
- SPEC-COMPLIANCE §9.2: federation `X-Node-Signature` presence-only (intentional lab boundary); Core-DP signed-envelope verification exists separately in `envelope.ts`
- `handleLoopSearch` in `loop.ts` explicitly rejects `scope: cross-node` and `auth.mode: node-signature` — security-relevant fail-closed guards with **zero route-level test coverage**
- Skipped per guidance: ETag/Last-Modified on federation/nodes; docs routes cache policy; full cryptographic federation signature verification (lab boundary)

## Selected item
Add route-level tests asserting Core-DP search rejects `cross-node` scope and `node-signature` auth mode on both material and product search endpoints.

## Priority rationale
Fail-closed auth guards prevent unverified trust claims from being honored accidentally. Production behavior exists but is untested; smallest independently shippable functional item from cycle 0020 gaps without implementing full signature verification.

## Implementation
1. `tests/loop.search.auth.test.ts` — new file with mocked deps:
   - `POST /api/v1/material/search` rejects `scope: cross-node` with Core-DP `invalid_request`
   - `POST /api/v1/material/search` rejects `auth.mode: node-signature` with Core-DP `invalid_request`
   - Same two cases for `POST /api/v1/product/search`

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun run test` — 221 pass, 0 fail (4 new tests)
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Security fail-closed guards (cross-node scope, node-signature auth) are only trustworthy when route-level tests prove the handler rejects before DB/search runs; mocking search to throw makes regressions obvious.
- Org workspace root lacks git — parent CLAUDE.md/AGENTS.md test-command drift remains out of scope until a versioned org repo exists.
- Federation §9.2 signature verification and Core-DP search auth are separate surfaces; test coverage should track each independently.

## Gaps for next cycle
- Explore federation signature verification lab notes or bearer-mode search auth test (requires API key toggle setup).
- ETag/Last-Modified on federation/nodes — skip unless clearly required.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — skip unless clear win.
- Parent workspace docs (CLAUDE.md, AGENTS.md) still show bare `bun test` — blocked on org root not being a git repo.
- Cycle 0025 triggers org-wide rescan; conformance green pre-rescan.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `945a446` | implementation | yes |
| `localloop-backend` | (this commit) | plan close (HEAD) | yes (`origin/main`) |
