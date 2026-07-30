# LOOP Spec Compliance Matrix

Tracks `localloop-backend` against the normative
[loop-protocol](https://github.com/local-loop-io/loop-protocol) surface:
SPECIFICATION.md §8 (API endpoints) plus `openapi.json` (the reference
contract), §9.2 (node-to-node headers), and §8.3 (error envelope).

Lab demo only — compliance here means "the protocol's required surface works
end-to-end against the running lab node", not production readiness.

## Endpoint matrix (v0.4.0)

| Spec endpoint | Requirement | Status | Notes |
| --- | --- | --- | --- |
| `POST /api/v1/material` | MUST (§8.1) | ✅ Implemented | Canonical material-dna schema validation |
| `GET /api/v1/material/{id}` | MUST (§8.1) | ✅ Implemented | Returns the stored canonical MaterialDNA document over `application/ld+json` (fixed v0.4.4: previously leaked the internal DB row); response validated against the canonical schema in `tests/specResponses.test.ts` |
| `POST /api/v1/material/search` | MUST (§8.1) | ✅ Implemented | Dual contract: protocol shape `{category, radius_km, min_quantity, max_loop_cost}` → `{results, total}` and additive Core-DP shape (`limit` + filters + cursor). `max_loop_cost` rejected with `400 INVALID_REQUEST` (LoopCost needs offer pricing; MaterialDNA carries none). `radius_km` measured from the node's published location (PostGIS). |
| `POST /api/v1/product` | MUST (§8.1, v0.2.0) | ✅ Implemented | Canonical product-dna schema validation |
| `GET /api/v1/product/{id}` | MUST (§8.1, v0.2.0) | ✅ Implemented | Returns the stored canonical ProductDNA document over `application/ld+json` (fixed v0.4.4); canonical-schema validated in `tests/specResponses.test.ts` |
| `POST /api/v1/product/search` | Core-DP (openapi tag) | ✅ Implemented | Additive lab profile endpoint |
| `GET /api/v1/node/info` | MUST (§8.1) | ✅ Implemented | Validates against canonical node-info schema (location, capability enum enforced via config warning) |
| `GET /api/v1/signals` | MUST (§8.1) | ✅ Implemented (v0.4.0) | LoopSignalConfig from `loop_signal_config` table; seeded per §6.1 example |
| `POST /api/v1/transaction` | MUST (§8.1) | ✅ Implemented (v0.4.0) | Canonical transaction schema (oneOf MaterialTransaction / Settlement / TransactionStatus); responds TransactionStatus with resolvable `settlement_url`; §3.6 status values enforced by DB CHECK; Idempotency-Key conflicts answered with the Core-DP `conflict` body (fixed v0.4.3) |
| `POST /api/v1/federate/announce` | MUST (§8.2) | ✅ Implemented (v0.4.0) | §9.2 headers enforced (see below) |
| `POST /api/v1/federate/offer` | MUST (§8.2) | ✅ Implemented (v0.4.0) | §9.2 headers enforced; material must be hosted locally; expired offers rejected |
| `POST /api/v1/material-status` | Optional (lab ext) | ✅ Implemented | Lab-only extension, excluded from protocol openapi.json |
| `GET /api/v1/transaction/{id}` | — (additive) | ✅ Implemented (v0.4.0) | Makes `settlement_url` resolvable; not in openapi.json |

## §9.2 node-to-node headers

| Header | Requirement | Status |
| --- | --- | --- |
| `X-Node-ID` | MUST | ✅ Required on `/api/v1/federate/*` |
| `X-Node-Signature` | MUST | ⚠️ Presence required; cryptographic verification NOT implemented in the lab (see boundary table below) |
| `X-Timestamp` | MUST (±5 min) | ✅ Required; stale/invalid timestamps rejected |

### X-Node-Signature lab boundary

SPEC §9.2 requires `X-Node-Signature` on node-to-node requests. This lab
preview enforces header **presence** (non-empty string) and `X-Timestamp`
freshness (±5 minutes) on `/api/v1/federate/*`, but does **not**
cryptographically verify the signature value. Any non-empty string is
accepted (tests use `lab-signature-placeholder`; see `requireNodeHeaders`
in `src/routes/federate.ts`).

| Surface | Verification | Status |
| --- | --- | --- |
| `POST /api/v1/federate/announce`, `POST /api/v1/federate/offer` | Presence + timestamp only; no Ed25519/HMAC check on header value | ⚠️ Intentional lab boundary |
| Core-DP signed envelope (`src/envelope.ts`) | Full detached Ed25519 verification against trust store | ✅ Implemented (separate profile; not wired to §9.2 headers) |
| Core-DP search `auth.mode: node-signature` | Rejected before search runs (`invalid_request`; no verification attempted) | ✅ Fail-closed |
| `POST /api/v1/federation/handshake` | Lab-only registry route; §9.2 headers not required (API key only) | ✅ Lab-only extension |

This is not a compliance gap for the lab demo: conformance checks route
presence and timestamp behavior, not production-grade node authentication.

## §8.3 error envelope

| Surface | Status |
| --- | --- |
| New protocol endpoints (signals, transaction, federate/*, protocol-mode search) | ✅ `{error: {code, message, details?}}` with canonical codes |
| Pre-existing lab routes (loop CRUD, interest, cities, payments, evidence) | ✅ Migrated to the §8.3 envelope. HTTP statuses unchanged; statuses outside the canonical six map to the nearest canonical code (429 → `INVALID_REQUEST`, 503 → `INTERNAL_ERROR`) via `specErrorCodeForStatus`. Mixed write-route 409s can still carry the Core-DP error body (Idempotency-Key conflicts) |
| Fastify schema-validation rejections (400) | ✅ Global error handler emits `INVALID_REQUEST` envelope with `details.validation`; global 404 handler emits `NOT_FOUND` envelope |

## §3.6 lifecycle invariants

| Invariant | Status |
| --- | --- |
| Match requires open Offer; matching reserves the Offer | ✅ DB-enforced (state machine + partial unique indexes, migration 011) |
| One active Match per Offer | ✅ DB-enforced |
| Transfer requires accepted Match | ✅ DB-enforced |
| One live Transfer per Match | ✅ DB-enforced |
| Offer quantity bounded by subject material | ✅ DB-enforced |
| Transaction status values | ✅ DB CHECK constraint (migration 015); transition enforcement is lab-scope (create/read only) |

## Conformance gate

`bun run check:conformance` (tests/conformance.test.ts,
.github/workflows/protocol-parity.yml) fails on:

1. Backend schema copies drifting from `loop-protocol/schemas` (byte-compare).
2. Docs-hub mirror (`localloop-site/public/projects/loop-protocol/`) drifting
   from canonical schemas, contexts, `docs/`, `examples/`, `rfcs/`, `openapi.json`,
   or `SPECIFICATION.md`.
3. Any `openapi.json` path+method missing from the built Fastify route table.

`tests/specResponses.test.ts` additionally validates live route responses
(node/info, signals, transaction) against the canonical JSON schemas.

## Intentional lab boundaries (not compliance gaps)

- No cross-node search (Core-DP `scope: "cross-node"` rejected).
- No LoopCoin wallet/settlement engine; transactions are recorded, not executed.
- Signal governance (LoopVote) is out of scope; signals are seeded, not voted.
- Federation `X-Node-Signature` verification (see §9.2 boundary table above).
