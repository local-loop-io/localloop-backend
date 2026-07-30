# Micro-sprint plan 0028 — Federate empty X-Node-ID regression guard

## Status
COMPLETED

## Cycle
28

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `0305986` matches `origin/main`
- Cycle 0027 closed empty/whitespace `X-Node-Signature` boundary tests; 231 tests pass
- `requireNodeHeaders` in `src/routes/federate.ts` rejects empty/whitespace
  `X-Node-ID` via `nodeId.trim() === ''` (same guard as signature)
- `tests/federate.routes.test.ts` covers signature empty/whitespace but had no
  explicit empty/whitespace `X-Node-ID` regression guard
- P1 alt (429/503 §8.3 envelope) deferred — no clear lab route surface
- P3 loop-protocol audit path refs remain low urgency

## Selected item
Add route-level regression tests asserting `/api/v1/federate/announce` and
`/api/v1/federate/offer` reject empty and whitespace-only `X-Node-ID` with
§8.3 `UNAUTHORIZED` envelope.

## Priority rationale
Natural complement to cycle 0027 — same `trim() === ''` guard in
`requireNodeHeaders` but untested sibling header; prevents accidental loosening
of the presence check.

## Implementation
1. `tests/federate.routes.test.ts` — add describe block with four boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/federate.routes.test.ts` — 18 pass, 0 fail (4 new tests)
- `bun run typecheck` — pass
- `bun run test` — 235 pass, 0 fail

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Empty/whitespace `X-Node-ID` rejection shares the same combined guard as
  signature in `requireNodeHeaders`; cycle 0027 signature tests did not cover
  the sibling header path.
- Federate §9.2 empty-header matrix is now complete for both required identity
  headers (ID + signature) on announce and offer routes.
- §8.3 envelope assertions (`error.code` + `typeof error.message`) remain the
  right regression depth for header boundary tests without duplicating full
  schema validation.

## Gaps for cycle 0029
- **P1** — §8.3 envelope on non-canonical HTTP statuses at route level (429/503
  on lab routes if any emit spec envelope)
- **P3** — loop-protocol audit docs: historical `localloop.github.io` path refs
  (low urgency)
- **Skip** — ETag on federation/nodes; docs cache policy; org root docs
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `f50c566` | implementation | yes |
| `localloop-backend` | `5026f67` | plan close (HEAD) | pending |
