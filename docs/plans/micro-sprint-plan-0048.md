# Micro-sprint plan 0048 — federate audit snapshot schema rows

## Status
COMPLETED

## Cycle
48

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `b5d6056` matches `origin/main`
- Cycle 0047 added handshake + federate-accepted to sync-schemas BASE list;
  247 tests pass
- Cycle 0046 published `FederateAcceptedResponse` in loop-protocol; audit
  snapshot rows for `POST /api/v1/federate/announce` still say "no canonical
  JSON-LD response schema"

## Selected item
Update audit snapshot rows in loop-protocol that still note "no canonical
response schema" for federate announce — reflect `FederateAcceptedResponse` from
cycle 0046; mirror via aggregate-docs.

## Priority rationale
Smallest complete docs-only item from cycle 0047 gaps — closes stale audit
text without handler or schema changes; unblocks accurate contributor reading
of historical snapshots.

## Implementation
1. `loop-protocol/docs/audit/spec-implementation-divergence.md` — federate
   announce row + partial refresh note (cycle 0048)
2. `loop-protocol/docs/audit/requirements-matrix.md` — API contract announce
   row + partial refresh note (cycle 0048)
3. `localloop-site` — run `./scripts/aggregate-docs.sh`; commit mirror sync
4. `localloop-backend` — plan close (this file)

## Repositories
| Repo | Role |
|------|------|
| `loop-protocol` | Audit doc refresh (provider) |
| `localloop-site` | Docs-hub mirror sync (consumer) |
| `localloop-backend` | Plan (control) |

## Verification
- `npm run test` in `loop-protocol` — pass (15 examples, 47 artifacts, 21 schemas; `npm test` alias invokes `bun test` and fails in this shell — use `npm run test`)
- `./scripts/aggregate-docs.sh` in `localloop-site` — pass
- `bun run test` in `localloop-site` — pass (28/28)
- `bun run test` + `bun run check:conformance` in backend — pass (247/247)
- `diff -rq loop-protocol/docs/audit localloop-site/public/projects/loop-protocol/docs/audit` — no differences

## Deploy order
1. `loop-protocol` (provider)
2. `localloop-site` (consumer mirror)
3. `localloop-backend` (plan close)

## RSI learning
- Publishing a canonical schema in loop-protocol (cycle 0046
  `FederateAcceptedResponse`) does not update historical audit snapshots
  automatically — schedule a docs-only partial refresh in the next cycle so
  matrix/divergence rows and partial-refresh banners stay truthful for
  contributors reading mirrored audit docs.
- Run `aggregate-docs.sh` and `diff -rq` on `docs/audit` before closing;
  conformance gate already checks the wider mirror (61 files).
- Shell `npm` alias to Bun breaks bare `npm test` in loop-protocol; the
  package script chain is `npm run test` (`validate:schemas` + readme +
  markers checks).

## Gaps for cycle 0049
- **P2** — Tighten `federate.ts` inline `acceptedResponseSchema` to match
  canonical `federate-accepted.schema.json` (const status, required fields)
  or import the schema file
- **P2** — ETag on `GET /api/v1/federation/nodes`
- **P2** — Docs cache policy (skip unless clear win)
- **Skip** — org root docs (not git-tracked)
- **Cycle 0050** — next mandatory org rescan (2 cycles away)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `loop-protocol` | `f23d17b` | audit partial refresh | `HEAD == origin/main` (2026-07-31) |
| `localloop-site` | `c05827b` | docs-hub mirror sync | `HEAD == origin/main` (2026-07-31) |
| `localloop-backend` | `324b06f` | plan close (HEAD) | `HEAD == origin/main` (2026-07-31) |
