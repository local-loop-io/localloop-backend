# Micro-sprint plan 0022 — Core-DP bearer search auth rejection

## Status
COMPLETED

## Cycle
22

## Control repository
`localloop-backend`

## Observation
- Cycle 0021 closed cross-node scope and node-signature auth guard tests (4 tests); remote HEAD at `2f24498`
- `handleLoopSearch` rejects `auth.mode: bearer` via `requireApiKey` when API key protection is enabled — no route-level test coverage
- `requireApiKey` unit tests exist in `apiKey.test.ts`; write-route guards in `apiKey.routes.test.ts` — search bearer path untested
- Skipped per guidance: ETag/Last-Modified; docs cache policy; org root CLAUDE.md sync (not git)

## Selected item
Add route-level tests asserting Core-DP material and product search reject `auth.mode: bearer` without credentials when API key protection is enabled.

## Priority rationale
Complements cycle 0021 fail-closed guards. Bearer mode is the only remaining auth gate in `handleLoopSearch` without route coverage; smallest shippable functional item from cycle 0021 gaps.

## Implementation
1. `tests/loop.search.auth.test.ts` — extend with config toggle + mocked search throw:
   - `POST /api/v1/material/search` rejects bearer mode without API key (401 UNAUTHORIZED)
   - `POST /api/v1/product/search` rejects bearer mode without API key (401 UNAUTHORIZED)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun run test` — 223 pass, 0 fail (2 new tests)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Core-DP search auth has three independent gates (cross-node scope, node-signature mode, bearer credentials); each needs route-level tests because unit tests on `requireApiKey` do not prove the handler invokes it before search.
- Bearer rejection uses the §8.3 spec envelope (`error.code: UNAUTHORIZED`), unlike cross-node/node-signature which use Core-DP `invalid_request` — test assertions must match the envelope shape per gate.
- Config mutation with `afterEach` restore is the established pattern for API-key toggle tests (`interest.auth.test.ts`, `apiKey.routes.test.ts`).

## Gaps for next cycle
- Document federation `X-Node-Signature` lab boundary in SPEC-COMPLIANCE (presence-only vs cryptographic verification).
- ETag/Last-Modified on federation/nodes — skip unless clearly required.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — skip unless clear win.
- Parent workspace docs (CLAUDE.md, AGENTS.md) still show bare `bun test` — blocked on org root not being a git repo.
- Cycle 0025 triggers org-wide rescan; conformance green pre-rescan.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `b836bb9` | implementation | yes |
| `localloop-backend` | `3353b12` | plan close (HEAD) | yes (`origin/main`) |
