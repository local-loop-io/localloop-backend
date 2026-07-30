# Micro-sprint plan 0026 — Federation handshake §9.2 boundary regression guard

## Status
COMPLETED

## Cycle
26

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `147c635` matches `origin/main`
- Cycle 0025 org rescan: all health gates green (225 backend tests, 28 site, conformance, domain checks)
- Cycle 0024 closed federate X-Node-Signature presence-only guard; cycle 0023 documented §9.2 boundary matrix in SPEC-COMPLIANCE
- Remaining P1 gap: `POST /api/v1/federation/handshake` is lab-only registry; §9.2 headers not required (API key only when enabled) — no explicit regression guard
- `tests/federation.routes.test.ts` accepts handshake without node headers in happy path but does not document the intentional boundary
- P2 (`interest.ts` cache refactor): **DONE** — uses `setNoStoreIfUnset` from `src/httpCache.ts`; covered by `tests/httpCache.test.ts` and `tests/interest.cache.headers.test.ts`
- Skipped: ETag on federation/nodes; docs cache policy; org root docs; loop-protocol audit path refs (P3, low urgency)

## Selected item
Add route-level regression guard asserting `/api/v1/federation/handshake` does not enforce §9.2 node headers (accepts requests without headers; ignores invalid/stale §9.2 headers if present).

## Priority rationale
Completes the §9.2 lab-boundary test trilogy started in cycles 0023–0024. Prevents accidental wiring of `requireNodeHeaders` to the lab-only handshake route while making the boundary discoverable in CI.

## Implementation
1. `tests/federation.routes.test.ts` — add describe block with two boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/federation.routes.test.ts` — 6 pass, 0 fail (2 new tests)
- `bun run typecheck` — pass
- `bun run test` — 227 pass, 0 fail

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- The §9.2 lab-boundary trilogy (docs → federate presence-only → handshake no-headers) is now complete; each surface has an explicit describe block in CI.
- Happy-path tests that omit headers do not prove absence of enforcement — a dedicated boundary describe with invalid header values catches accidental `requireNodeHeaders` wiring.
- P2 interest cache refactor was already done in cycle 0017; verify-before-attempt saved unnecessary churn.

## Gaps for cycle 0027
- **P1** — Remaining SPEC-COMPLIANCE boundaries without explicit guards: empty/whitespace `X-Node-Signature` rejection on federate (partially covered by "without headers" test); §8.3 envelope on non-canonical HTTP statuses at route level (429/503 on lab routes if any emit spec envelope)
- **P3** — loop-protocol audit docs: historical `localloop.github.io` path refs (low urgency)
- **Skip** — ETag on federation/nodes; docs cache policy; org root docs (not git)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `b365f57` | implementation | yes |
| `localloop-backend` | `e107573` | plan close (HEAD) | yes |
