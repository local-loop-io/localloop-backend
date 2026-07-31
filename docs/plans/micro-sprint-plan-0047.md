# Micro-sprint plan 0047 — sync-schemas federation schema hygiene

## Status
COMPLETED

## Cycle
47

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `e63240d` matches `origin/main`
- Cycle 0046 published `FederateAcceptedResponse` schema and specResponses
  regression; 247 tests pass
- `handshake.schema.json` and `federate-accepted.schema.json` exist in
  `src/schemas/` as manual copies (handshake pattern from cycle 0044/0046)
  but are **not** in `scripts/sync-schemas.ts` BASE list — drift risk on
  future protocol updates

## Selected item
Add `handshake.schema.json` and `federate-accepted.schema.json` to the
sync-schemas BASE list so federation response schemas are drift-guarded like
the core protocol schemas.

## Priority rationale
Smallest complete maintainability item from cycle 0046 gaps — no provider
changes, no handler changes, no mirror sync; closes manual-copy drift path
identified in cycle 0046 RSI learning.

## Implementation
1. `localloop-backend/scripts/sync-schemas.ts` — append handshake and
   federate-accepted to `BASE_SCHEMAS`
2. Verified existing copies already match loop-protocol canonical source
   (no content change required)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | sync-schemas BASE list + plan (control) |

## Verification
- `bun run scripts/sync-schemas.ts --check` — pass (no drift)
- `bun run test` — 247 pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
Backend only — no cross-repo provider order.

## RSI learning
- Federation schemas can join BASE_SCHEMAS without touching provider or mirror
  when copies already match loop-protocol — pure hygiene, zero wire-format
  change.
- `schemas.sync.test.ts` and `check:conformance` now cover handshake and
  federate-accepted drift; manual copy comments in cycle 0046 plan are
  obsolete.
- First test run hit flaky Bun `EEXIST epoll_ctl` in interest.routes; rerun
  passed 247/247 — unrelated to this change.

## Gaps for cycle 0048
- **P2** — Tighten `federate.ts` inline `acceptedResponseSchema` to match
  canonical schema (const status, required fields) or import schema file
- **P2** — Update audit snapshot rows that still note "no canonical response
  schema" for federate endpoints
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **Skip** — org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan (3 cycles away)

## Commit SHAs
(TBD after commit)
