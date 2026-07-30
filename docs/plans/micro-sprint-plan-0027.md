# Micro-sprint plan 0027 — Federate empty X-Node-Signature regression guard

## Status
COMPLETED

## Cycle
27

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `9c6148a` matches `origin/main`
- Cycle 0026 closed federation handshake §9.2 boundary tests; 227 tests pass
- `requireNodeHeaders` in `src/routes/federate.ts` rejects empty/whitespace
  `X-Node-Signature` via `signature.trim() === ''` (same for `X-Node-ID`)
- `tests/federate.routes.test.ts` covers missing headers and presence-only
  boundary but has no explicit empty/whitespace signature regression guard
- P3 loop-protocol audit path refs remain low urgency; §8.3 429/503 envelope
  checks deferred (no clear lab route surface identified)

## Selected item
Add route-level regression tests asserting `/api/v1/federate/announce` and
`/api/v1/federate/offer` reject empty and whitespace-only `X-Node-Signature`
with §8.3 `UNAUTHORIZED` envelope.

## Priority rationale
Smallest executable P1 gap from cycle 0026 — behavior exists in
`requireNodeHeaders` but is untested; prevents accidental loosening of the
presence check.

## Implementation
1. `tests/federate.routes.test.ts` — add describe block with four boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/federate.routes.test.ts` — 14 pass, 0 fail (4 new tests)
- `bun run typecheck` — pass
- `bun run test` — 231 pass, 0 fail

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Empty/whitespace signature rejection was already implemented via shared
  `trim() === ''` guard in `requireNodeHeaders`; missing-header tests do not
  prove whitespace-only values are rejected.
- §8.3 envelope assertions (`error.code` + `typeof error.message`) add
  regression value beyond status-code-only checks without duplicating full schema
  validation (covered elsewhere in `specResponses.test.ts`).
- Federate §9.2 boundary test matrix is now complete: missing headers, empty/
  whitespace, stale/malformed timestamp, presence-only (no crypto), handshake
  no-headers.

## Gaps for cycle 0028
- **P1** — §8.3 envelope on non-canonical HTTP statuses at route level (429/503
  on lab routes if any emit spec envelope); empty/whitespace `X-Node-ID` on
  federate (same guard, untested sibling)
- **P3** — loop-protocol audit docs: historical `localloop.github.io` path refs
  (low urgency)
- **Skip** — ETag on federation/nodes; docs cache policy; org root docs
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `55d67dd` | implementation | yes |
| `localloop-backend` | `a92a477` | plan close (HEAD) | yes |
