# Micro-sprint plan 0046 — federate 202 acceptance response schema

## Status
COMPLETED

## Cycle
46

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `8ca7e1f` matches `origin/main`
- Cycle 0045 closed audit docs refresh; P3 federate announce/offer response
  schema conformance was **BLOCKED** — inline `{status, id}` in
  `src/routes/federate.ts`; openapi 202 stubs had no schema
- Wire format: `{ "status": "accepted", "id": <integer> }` on both
  `POST /api/v1/federate/announce` and `POST /api/v1/federate/offer`

## Selected item
Publish minimal canonical `FederateAcceptedResponse` JSON Schema in
loop-protocol, wire into openapi.json, mirror to docs hub, add
`specResponses` regression for announce and offer.

## Priority rationale
Unblocks P3 blocked since cycle 0045 — smallest shippable schema that matches
the existing wire format without changing handler behavior or inventing JSON-LD.

## Implementation
1. `loop-protocol/schemas/federate-accepted.schema.json` — required
   `status` (const `accepted`) + `id` (integer ≥ 1)
2. `loop-protocol/openapi.json` — `FederateAcceptedResponse` component;
   202 content schema on announce/offer paths
3. `loop-protocol/schemas/README.md` — list new schema
4. `localloop-site/scripts/aggregate-docs.sh` — include `federate-accepted`
   in v0.2.0 versioned alias publish
5. `localloop-site` — run `./scripts/aggregate-docs.sh`; commit mirror sync
6. `localloop-backend/src/schemas/federate-accepted.schema.json` — canonical
   copy (handshake pattern; not in sync-schemas BASE list)
7. `localloop-backend/tests/specResponses.test.ts` — AJV-validate announce
   and offer 202 bodies

## Repositories
| Repo | Role |
|------|------|
| `loop-protocol` | Schema + openapi (provider) |
| `localloop-site` | Docs-hub mirror + aggregate-docs alias (consumer) |
| `localloop-backend` | Schema copy + specResponses + plan (control) |

## Verification
- `npm run test` in `loop-protocol` — pass (21 schemas)
- `./scripts/aggregate-docs.sh` in `localloop-site` — pass
- `bun test tests/specResponses.test.ts` — 8 pass
- `bun run test` + `bun run typecheck` + `bun run check:conformance` in backend — 247 pass

## Deploy order
1. `loop-protocol` (provider)
2. `localloop-site` (consumer mirror)
3. `localloop-backend` (tests + plan close)

## RSI learning
- Federate 202 responses are plain JSON (not JSON-LD); a standalone
  `federate-accepted.schema.json` is the right minimal contract — no `@type`
  inference path in validate-schemas.js needed.
- Openapi `$ref` to the versioned `$id` URL closes the spec/openapi gap that
  blocked specResponses without touching handler code.
- Handshake-style manual copy to `src/schemas/` remains the pattern for
  federation schemas outside sync-schemas BASE list; consider adding both to
  sync-schemas in a future hygiene cycle.
- aggregate-docs `publish_versioned_schema_aliases` must be updated when adding
  new root schemas or v0.2.0 mirror will miss the alias copy.

## Gaps for cycle 0047
- **P2** — ETag on federation/nodes; docs cache policy (skip unless clear win)
- **P2** — Tighten `federate.ts` inline `acceptedResponseSchema` to match
  canonical schema (const status, required fields) or import schema file
- **P2** — Add `federate-accepted` + `handshake` to sync-schemas BASE list
- **P3** — Update audit snapshot rows that still note "no canonical response
  schema" for federate endpoints
- **Skip** — org root docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan (4 cycles away)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `loop-protocol` | _(pending push)_ | implementation | |
| `localloop-site` | _(pending push)_ | mirror sync | |
| `localloop-backend` | _(pending push)_ | tests + plan close | |
