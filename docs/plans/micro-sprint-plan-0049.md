# Micro-sprint plan 0049 — federate accepted response schema alignment

## Status
COMPLETED

## Cycle
49

## Control repository
`localloop-backend`

## Observation
- Cycle 0048 push gap closed: all three repos verified `HEAD == origin/main`
- Cycle 0046 published `FederateAcceptedResponse`; cycle 0047 drift-guarded
  sync; cycle 0048 refreshed audit snapshots
- `federate.ts` still used a loose inline `acceptedResponseSchema` (optional
  fields, no const status) while canonical `federate-accepted.schema.json`
  requires `status: "accepted"`, `id` integer ≥ 1, `additionalProperties: false`

## Selected item
Replace inline `acceptedResponseSchema` in `federate.ts` with a `$ref` to the
canonical `federate-accepted.schema.json` registered via `federationSchemas.ts`.

## Priority rationale
Smallest complete handler-side item from cycle 0048 gaps — closes OpenAPI
response validation drift without provider or mirror changes; aligns Fastify
route schema with specResponses regression target.

## Implementation
1. `src/schemas/federationSchemas.ts` — register `federate-accepted.schema.json`,
   export `federationSchemaIds.federateAccepted`
2. `src/routes/federate.ts` — call `registerFederationSchemas`, use
   `{ $ref: federationSchemaIds.federateAccepted }` for 202 responses

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Handler schema alignment + plan (control) |

## Verification
- `bun test tests/federate.routes.test.ts` — pass
- `bun test tests/specResponses.test.ts` — pass
- `bun run test` — pass
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
Backend only — no cross-repo provider order.

## RSI learning
- Register federation response schemas in `federationSchemas.ts` and reference
  via `$ref` in route handlers — same pattern as handshake; avoids duplicating
  canonical constraints (const status, required fields, additionalProperties)
  inline and keeps Fastify response validation aligned with specResponses tests.

## Gaps for cycle 0050
- **P2** — ETag on `GET /api/v1/federation/nodes`
- **P2** — Docs cache policy (skip unless clear win)
- **Skip** — org root docs (not git-tracked)
- **Cycle 0050** — mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `b84b5ed` | federate schema alignment + plan close | pending push |
