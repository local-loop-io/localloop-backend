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

### LoopCoin settlement lab boundary

SPEC §5 defines LoopCoin issuance, transfers, and inter-node clearing.
This lab preview implements the §8.1 transaction surface
(`POST /api/v1/transaction`, `GET /api/v1/transaction/{id}`) as
**record-only persistence** — validated JSON-LD payloads stored in
`loop_transactions` with derived status — but does **not** run a
LoopCoin wallet, currency engine, or settlement execution.

| Surface | Behavior | Status |
| --- | --- | --- |
| `POST /api/v1/transaction` | Persists MaterialTransaction / Settlement / TransactionStatus; returns TransactionStatus with resolvable `settlement_url` | ✅ Record-only |
| `GET /api/v1/transaction/:id` | Returns stored TransactionStatus; no wallet lookup or clearing | ✅ Record-only |
| LoopCoin transfer / config HTTP routes | Not implemented (spec §5 schema types exist; no wallet engine) | ⚠️ Intentional lab boundary |
| `GET /api/v1/node/info` `capabilities` | May include `loopcoin`; advertises intent only — no currency engine behind it | ⚠️ Intentional lab boundary |

Status transitions and LoopCoin debits/credits are not enforced at
runtime; `createLoopTransaction` in `src/db/loop.ts` inserts the payload
and derives id/status per `@type` only. This is not a compliance gap
for the lab demo: conformance validates the §8.1 transaction schema
surface, not production-grade LoopCoin settlement.

### Signal governance lab boundary

SPEC §6 defines democratic LoopSignal governance: SignalProposal drafts,
LoopVote tallies, and published LoopSignalConfig with optional
`approved_by` metadata. This lab preview implements the §8.1 read surface
(`GET /api/v1/signals`) as **seeded, read-only publication** — values
from the single-row `loop_signal_config` table (migration 015, mirroring
§6.1 example categories) — but does **not** run voting, proposal intake,
or signal mutation.

| Surface | Behavior | Status |
| --- | --- | --- |
| `GET /api/v1/signals` | Returns LoopSignalConfig from `getLoopSignalConfig`; no write path | ✅ Read-only |
| `loop_signal_config` table | Seeded at migrate time; no HTTP update route | ✅ Seeded lab data |
| LoopVote / SignalProposal HTTP routes | Not implemented (schema types exist; no Signal Governor) | ⚠️ Intentional lab boundary |
| LoopSignalConfig `approved_by` | Omitted from lab responses; no vote record linked | ⚠️ Intentional lab boundary |
| `GET /api/v1/node/info` `capabilities` | May include `loopsignal`; advertises publish intent only — no voting engine | ⚠️ Intentional lab boundary |

Signal values are not adjusted at runtime; `registerSignalsRoutes` in
`src/routes/signals.ts` reads the stored row and emits JSON-LD only.
This is not a compliance gap for the lab demo: conformance validates
the §8.1 LoopSignalConfig schema surface, not production-grade
democratic governance.

### Payments lab boundary

Payments intake is a **lab-only extension** outside the LOOP protocol
spec and `openapi.json`. This preview implements
`POST /api/payments/intent` and `POST /api/payments/webhook` as
**intake-only persistence** — validated payloads stored in
`payment_intents` and `payment_webhooks` — but does **not** call
Stripe (or any PSP), execute charges, verify webhook signatures, or
settle LoopCoin.

| Surface | Behavior | Status |
| --- | --- | --- |
| `POST /api/payments/intent` | Persists intake row via `insertPaymentIntent`; returns `{id, status, created_at}` | ✅ Intake-only |
| `POST /api/payments/webhook` | Persists provider payload via `insertPaymentWebhook`; returns `{status: "received"}` | ✅ Intake-only |
| `PAYMENTS_ENABLED` | When `false`, both routes answer `503` before DB write | ✅ Feature gate |
| Stripe charge / refund HTTP routes | Not implemented (no Stripe SDK; no charge execution) | ⚠️ Intentional lab boundary |
| Webhook signature verification | Not implemented (any payload accepted when enabled + API key valid) | ⚠️ Intentional lab boundary |
| LoopCoin settlement linkage | Separate from `/api/v1/transaction` record-only surface (see LoopCoin settlement lab boundary above) | ✅ Distinct lab extension |

Payment rows are not reconciled with transactions at runtime;
`registerPaymentRoutes` in `src/routes/payments.ts` inserts the payload
only. This is not a compliance gap for the lab demo: payments are an
optional lab intake path, not a protocol §8 requirement.

### Evidence lab boundary

The Core-DP evidence log (`loop_evidence`, migration 013) is an
**append-only audit trail**, not a general-purpose records API. Entries
are written internally by other write routes (e.g. `createLoopMaterial`
calling `insertLoopEvidence`) — there is no public HTTP endpoint to
create, update, delete, redact, or export evidence directly.

| Surface | Behavior | Status |
| --- | --- | --- |
| `GET /api/v1/evidence/:event_id` | Read a single entry by `event_id` | ✅ Read-only |
| `GET /api/v1/evidence` | Query/list entries (filters + cursor pagination) | ✅ Read-only |
| `POST /api/v1/evidence/search` | Same query as above via a request body (for larger filter sets) | ✅ Read-only |
| `insertLoopEvidence` (`src/db/evidence.ts`) | Called only from other routes' write paths, never from a public "create evidence" endpoint | ✅ Internal-only |
| `UPDATE` / `DELETE` on `loop_evidence` | Blocked at the database level by `trg_loop_evidence_no_update` / `trg_loop_evidence_no_truncate` (migration 013) | ✅ DB-enforced |
| Redaction endpoint (e.g. mark an entry `redacted`) | Not implemented — `retention.redaction_status` is always `none` | ⚠️ Intentional lab boundary |
| Export endpoint (bulk download/archive) | Not implemented | ⚠️ Intentional lab boundary |
| Create/update/delete HTTP routes | Not implemented — no `POST /api/v1/evidence`, `PUT`, or `DELETE` route exists | ⚠️ Intentional lab boundary |

This is not a compliance gap for the lab demo: the evidence log exists
to demonstrate an append-only audit trail behind the existing write
routes, not to be a standalone records-management product with
redaction/export tooling.

### Federation registry lab boundary

The federation node registry (`federation_nodes`, migration 008) exists
to demonstrate a minimal multi-node handshake, not a production
peer-discovery or trust system.

| Surface | Behavior | Status |
| --- | --- | --- |
| `POST /api/v1/federation/handshake` | The **only** write path into the registry; upserts via `upsertFederationNode` (`INSERT ... ON CONFLICT (node_id) DO UPDATE`) | ✅ Single write path |
| `GET /api/v1/federation/nodes` | Read-only; returns the local node (computed per-request, never persisted) plus all `federation_nodes` rows | ✅ Read-only |
| Remove/deregister a node | Not implemented — no delete function in `src/db/federationNodes.ts`, no `DELETE` route | ⚠️ Intentional lab boundary |
| Node trust / allowlist | Not implemented — any caller with a valid API key may register any `node_id` | ⚠️ Intentional lab boundary |
| `X-Node-Signature` on handshake | Not required (see §9.2 X-Node-Signature lab boundary above) | ⚠️ Intentional lab boundary |

Registry entries are never expired or pruned automatically —
`last_seen` refreshes on every handshake, but nothing removes stale
nodes. This is not a compliance gap for the lab demo: the registry
demonstrates the handshake write path, not production node lifecycle
management or trust.

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
- No LoopCoin wallet/settlement engine; transactions are recorded, not executed (see LoopCoin settlement lab boundary above).
- Signal governance (LoopVote) is out of scope; signals are seeded, not voted (see Signal governance lab boundary above).
- Payments intake is record-only; no Stripe charges or webhook verification (see Payments lab boundary above).
- Evidence is an append-only audit trail with no redaction/export tooling; entries are written internally, not via a public create endpoint (see Evidence lab boundary above).
- Federation `X-Node-Signature` verification (see §9.2 boundary table above).
- Federation registry has no node removal or trust/allowlist; the handshake is the only write path (see Federation registry lab boundary above).
