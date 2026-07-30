# Micro-sprint plan 0023 — Federation X-Node-Signature lab boundary docs

## Status
COMPLETED

## Cycle
23

## Control repository
`localloop-backend`

## Observation
- Cycle 0022 closed Core-DP bearer search auth guard tests (6 total in `loop.search.auth.test.ts`); remote HEAD at `0030b40`
- SPEC-COMPLIANCE §9.2 already flagged `X-Node-Signature` as presence-only with a one-line note; intentional lab boundaries list referenced it but did not explain the three related surfaces
- `requireNodeHeaders` in `src/routes/federate.ts` checks non-empty `X-Node-Signature` + `X-Timestamp` freshness; no cryptographic verification
- Core-DP `src/envelope.ts` implements full Ed25519 detached-signature verification — separate profile, not wired to §9.2 HTTP headers
- `handleLoopSearch` rejects `auth.mode: node-signature` fail-closed (tested in cycle 0021)
- `POST /api/v1/federation/handshake` is lab-only registry; does not require §9.2 headers
- Skipped per guidance: ETag/Last-Modified on federation/nodes; docs cache policy; org root docs (not git)

## Selected item
Document federation `X-Node-Signature` lab boundary in `docs/SPEC-COMPLIANCE.md` — presence-only vs cryptographic verification, aligned with existing compliance matrix format.

## Priority rationale
Cycle 0021–0022 established test coverage for search auth guards; cycle 0022 gap explicitly calls for accurate lab-boundary documentation so readers do not confuse §9.2 header presence with Core-DP envelope verification or assume production-grade node authentication.

## Implementation
1. `docs/SPEC-COMPLIANCE.md` — add §9.2 subsection with surface matrix:
   - `/api/v1/federate/*`: presence + timestamp only
   - Core-DP envelope: full Ed25519 verification (separate surface)
   - Search `auth.mode: node-signature`: fail-closed rejection
   - `/api/v1/federation/handshake`: lab-only; no §9.2 headers
2. Update intentional lab boundaries cross-reference

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + plan |

## Verification
- Review diff for accuracy against `federate.ts`, `envelope.ts`, `loop.ts` — pass
- `bun run check:conformance` — pass (docs-only)

## Deploy order
1. `localloop-backend` only (docs-only changes)

## RSI learning
- Three distinct signature-related surfaces (§9.2 HTTP headers, Core-DP envelope, search auth mode) must be documented separately; conflating them misleads readers about lab security posture.
- The compliance matrix subsection format (surface / verification / status) scales well for lab-boundary clarifications without touching code.
- Docs-only cycles still benefit from code cross-check (`requireNodeHeaders`, test placeholders) before claiming behavior.

## Gaps for next cycle
- ETag/Last-Modified on federation/nodes — skip unless clearly required.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — skip unless clear win.
- Parent workspace docs (CLAUDE.md, AGENTS.md) still show bare `bun test` — blocked on org root not being a git repo.
- Cycle 0025 triggers org-wide rescan; conformance green pre-rescan.
- Optional: route-level test asserting federate routes accept any non-empty signature (regression guard for presence-only behavior).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `f02cd86` | implementation | yes |
| `localloop-backend` | `b622837` | plan close (HEAD) | yes (`origin/main`) |
