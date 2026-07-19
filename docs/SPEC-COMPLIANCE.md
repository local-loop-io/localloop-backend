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
| `GET /api/v1/material/{id}` | MUST (§8.1) | ✅ Implemented | |
| `POST /api/v1/material/search` | MUST (§8.1) | ✅ Implemented | Dual contract: protocol shape `{category, radius_km, min_quantity, max_loop_cost}` → `{results, total}` and additive Core-DP shape (`limit` + filters + cursor). `max_loop_cost` rejected with `400 INVALID_REQUEST` (LoopCost needs offer pricing; MaterialDNA carries none). `radius_km` measured from the node's published location (PostGIS). |
| `POST /api/v1/product` | MUST (§8.1, v0.2.0) | ✅ Implemented | Canonical product-dna schema validation |
| `GET /api/v1/product/{id}` | MUST (§8.1, v0.2.0) | ✅ Implemented | |
| `POST /api/v1/product/search` | Core-DP (openapi tag) | ✅ Implemented | Additive lab profile endpoint |
| `GET /api/v1/node/info` | MUST (§8.1) | ✅ Implemented | Validates against canonical node-info schema (location, capability enum enforced via config warning) |
| `GET /api/v1/signals` | MUST (§8.1) | ✅ Implemented (v0.4.0) | LoopSignalConfig from `loop_signal_config` table; seeded per §6.1 example |
| `POST /api/v1/transaction` | MUST (§8.1) | ✅ Implemented (v0.4.0) | Canonical transaction schema (oneOf MaterialTransaction / Settlement / TransactionStatus); responds TransactionStatus with resolvable `settlement_url`; §3.6 status values enforced by DB CHECK |
| `POST /api/v1/federate/announce` | MUST (§8.2) | ✅ Implemented (v0.4.0) | §9.2 headers enforced (see below) |
| `POST /api/v1/federate/offer` | MUST (§8.2) | ✅ Implemented (v0.4.0) | §9.2 headers enforced; material must be hosted locally; expired offers rejected |
| `POST /api/v1/material-status` | Optional (lab ext) | ✅ Implemented | Lab-only extension, excluded from protocol openapi.json |
| `GET /api/v1/transaction/{id}` | — (additive) | ✅ Implemented (v0.4.0) | Makes `settlement_url` resolvable; not in openapi.json |

## §9.2 node-to-node headers

| Header | Requirement | Status |
| --- | --- | --- |
| `X-Node-ID` | MUST | ✅ Required on `/api/v1/federate/*` |
| `X-Node-Signature` | MUST | ⚠️ Presence required; cryptographic verification NOT implemented in the lab (Core-DP signed-envelope profile covers verification separately) |
| `X-Timestamp` | MUST (±5 min) | ✅ Required; stale/invalid timestamps rejected |

## §8.3 error envelope

| Surface | Status |
| --- | --- |
| New protocol endpoints (signals, transaction, federate/*, protocol-mode search) | ✅ `{error: {code, message, details?}}` with canonical codes |
| Pre-existing lab routes (loop CRUD, interest, cities, payments, evidence) | ⚠️ Legacy flat `{error: "message"}` shape — migration to the §8.3 envelope is follow-up work |
| Fastify schema-validation rejections (400) | ⚠️ Fastify's default validation error shape |

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
   from canonical schemas, contexts, `openapi.json`, or `SPECIFICATION.md`.
3. Any `openapi.json` path+method missing from the built Fastify route table.

`tests/specResponses.test.ts` additionally validates live route responses
(node/info, signals, transaction) against the canonical JSON schemas.

## Intentional lab boundaries (not compliance gaps)

- No cross-node search (Core-DP `scope: "cross-node"` rejected).
- No LoopCoin wallet/settlement engine; transactions are recorded, not executed.
- Signal governance (LoopVote) is out of scope; signals are seeded, not voted.
- Federation signature verification (see §9.2 table above).
