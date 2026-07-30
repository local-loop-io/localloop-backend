# Micro-sprint plan 0024 — Federate X-Node-Signature presence-only regression guard

## Status
COMPLETED

## Cycle
24

## Control repository
`localloop-backend`

## Observation
- Cycle 0023 documented §9.2 X-Node-Signature lab boundary in SPEC-COMPLIANCE; remote HEAD at `78e059c`
- `requireNodeHeaders` in `src/routes/federate.ts` enforces non-empty `X-Node-Signature` + `X-Timestamp` freshness only; no cryptographic verification
- `tests/federate.routes.test.ts` used `lab-signature-placeholder` in happy-path tests but had no explicit regression guard that garbage signatures are accepted
- Skipped per guidance: ETag on federation/nodes; docs cache policy; org root docs (not git)

## Selected item
Add route-level tests asserting `/api/v1/federate/announce` and `/api/v1/federate/offer` accept any non-empty `X-Node-Signature` value (presence-only lab behavior per SPEC-COMPLIANCE §9.2).

## Priority rationale
Cycle 0023 gap explicitly called for this regression guard. Prevents accidental introduction of crypto verification on federate routes while documenting intentional lab boundary in executable form.

## Implementation
1. `tests/federate.routes.test.ts` — add describe block with garbage signature tests on announce and offer endpoints

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/federate.routes.test.ts` — 10 pass, 0 fail (2 new tests)
- `bun run typecheck` — pass
- `bun run test` — 225 pass, 0 fail

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Executable regression guards complement SPEC-COMPLIANCE prose: a dedicated describe block with an obviously invalid signature value makes the lab boundary discoverable in CI and prevents silent crypto enforcement.
- Happy-path placeholders (`lab-signature-placeholder`) do not prove absence of verification; explicit garbage-value tests are required.
- Test-only cycles remain shippable when they close a documented gap without touching production code paths.

## Gaps for next cycle
- **Cycle 0025 = org-wide rescan** (scheduled next). Pre-rescan checklist:
  - [ ] `localloop-backend`: `bun run check:conformance` green
  - [ ] `localloop-backend`: `bun run test` green (225+ tests)
  - [ ] `loop-protocol`: `npm test` (schema validation)
  - [ ] `localloop-site` / `localloop.github.io`: `bun run test` smoke + build
  - [ ] Cross-repo domain consistency scripts if present
  - [ ] Review SPEC-COMPLIANCE intentional lab boundaries still match code
  - [ ] Scan micro-sprint plan backlog for stale skip items
- ETag/Last-Modified on federation/nodes — skip unless clearly required.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — skip unless clear win.
- Parent workspace docs (CLAUDE.md, AGENTS.md) still show bare `bun test` — blocked on org root not being a git repo.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `4c0a062` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | — |
