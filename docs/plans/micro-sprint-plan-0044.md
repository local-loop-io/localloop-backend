# Micro-sprint plan 0044 — federation handshake response schema conformance

## Status
COMPLETED

## Cycle
44

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `3f51fe6` matches `origin/main`
- Cycle 0043 closed apiKey guard + envelope theme; 244 tests pass
- `bun run check:conformance` — all checks passed
- `tests/specResponses.test.ts` validates node/info, signals, transaction,
  material GET, and product GET against canonical schemas — federation
  handshake 202 response is uncovered despite `handshake.schema.json` in sync
- Closed themes: cache headers, federate lab boundaries, 503 envelopes,
  mock.module, mirror drift, apiKey route guards
- Site smoke tests green (28 pass); loop-protocol audit docs stale but org-root
  / mirror work skipped per guidance

## Selected item
Add `specResponses` regression asserting `POST /api/v1/federation/handshake`
202 body validates against `HandshakeResponse` in the canonical handshake schema.

## Priority rationale
Smallest shippable post-apiKey pivot — test-only, extends the existing
response-side conformance pattern to the last lab federation write response without
production churn or closed-theme extension.

## Implementation
1. `tests/specResponses.test.ts` — compile `HandshakeResponse` from
   `handshake.schema.json`, POST handshake, AJV-validate 202 body

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Tests + plan |

## Verification
- `bun test tests/specResponses.test.ts` — pass
- `bun run test` — full suite pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Federation handshake 202 already emits schema-conformant JSON-LD; one
  `specResponses` case locks the wire contract without duplicating
  `federation.routes.test.ts` behavioral checks.
- Compile `HandshakeResponse` from `handshake.schema.json` definitions directly —
  same AJV pattern as other canonical schemas; no separate response schema file.
- Response-side conformance now covers all openapi.json write responses that
  return canonical JSON-LD (transaction, handshake); read paths covered for
  node/info, signals, material, product.

## Gaps for cycle 0045
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P2** — loop-protocol audit docs stale (requirements-matrix, state-of-development)
  — needs loop-protocol + mirror sync if pursued
- **P3** — interest.auth §8.3 envelope assertion (skip — apiKey theme closed)
- **P3** — federate announce/offer response schema conformance (if canonical
  response schemas exist)
- **Skip** — org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan (6 cycles away)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `8f2f45b` | implementation | yes |
| `localloop-backend` | — | plan close (HEAD) | — |
