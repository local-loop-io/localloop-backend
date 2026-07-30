# Micro-sprint plan 0022 — Core-DP bearer search auth rejection

## Status
IN_PROGRESS

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
- `bun run test` — pass (2 new tests)
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
(TBD on close)

## Gaps for next cycle
(TBD on close)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| | | | |
