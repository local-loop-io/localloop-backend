# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.4] - 2026-07-20

### Fixed
- `GET /api/v1/material/:id` and `GET /api/v1/product/:id` now answer with
  the stored canonical MaterialDNA / ProductDNA document over
  `application/ld+json`, as openapi.json contracts; previously they leaked
  the internal database row (snake_case columns, nested `payload`,
  `application/json`). Responses are now validated against the canonical
  material-dna / product-dna schemas in `tests/specResponses.test.ts`.

## [0.4.3] - 2026-07-20

### Fixed
- `POST /api/v1/transaction` now answers an `Idempotency-Key` reused with a
  different body with the Core-DP `conflict` body (409), matching the other
  write routes; previously the conflict fell through to the global error
  handler and surfaced as a 500 `INTERNAL_ERROR`. The route's declared 409
  response schema is now a passthrough so both the §8.3 envelope and the
  Core-DP body serialize correctly.

## [0.4.2] - 2026-07-20

### Changed
- All remaining lab surfaces migrated to the spec §8.3 error envelope
  (`{error: {code, message, details?}}`): legacy lab routes (loop CRUD,
  interest, cities, payments, auth/api-key guards, SSE stream limits), the
  global 404 handler, and Fastify schema-validation rejections (now
  `INVALID_REQUEST` with `details.validation`). HTTP statuses are unchanged;
  statuses outside the canonical six map to the nearest canonical code
  (429 → `INVALID_REQUEST`, 503 → `INTERNAL_ERROR`). Mixed write-route 409s
  can still carry the Core-DP error body for Idempotency-Key conflicts.

## [0.4.1] - 2026-07-19

### Fixed
- Raised the read-only route allowance to 600 requests per 15-minute window so
  the public DEMO City view remains available for shared-network visitors;
  write routes remain independently limited to 20 requests per window.

## [0.4.0] - 2026-07-19

### Added
- Spec-required endpoints implemented (SPECIFICATION §8 / openapi.json):
  - `GET /api/v1/signals` — LoopSignalConfig JSON-LD published by the node
    (migration 015 seeds the §6.1 example configuration).
  - `POST /api/v1/transaction` — records MaterialTransaction / Settlement /
    TransactionStatus payloads validated against the canonical transaction
    schema; responds with TransactionStatus and a resolvable `settlement_url`.
  - `GET /api/v1/transaction/:id` — TransactionStatus lookup.
  - `POST /api/v1/federate/announce` and `POST /api/v1/federate/offer` —
    spec §8.2 node-to-node endpoints enforcing the §9.2 headers
    (`X-Node-ID`, `X-Node-Signature`, `X-Timestamp` ±5 minutes; signature
    presence enforced, cryptographic verification remains a documented lab
    limitation).
- `POST /api/v1/material/search` now also serves the spec §8.1 protocol
  contract (`category` glob, `radius_km` via the node's published location,
  `min_quantity` → `{results, total}`) alongside the additive Core-DP
  contract; `max_loop_cost` is rejected explicitly (LoopCost requires offer
  pricing).
- Spec §8.3 error envelope (`{error: {code, message, details}}`) on all new
  protocol endpoints.
- Three-way conformance gate `bun run check:conformance` (backend ↔
  loop-protocol ↔ docs-hub mirror): schema byte-parity, mirrored artifacts,
  and the full openapi.json route surface are verified; wired into
  `tests/conformance.test.ts` and the `protocol-parity.yml` CI workflow.
- `tests/specResponses.test.ts` validates node/info, signals, and transaction
  responses against the canonical JSON schemas.
- `NODE_LAT`/`NODE_LON` (+ optional `NODE_CITY`/`NODE_COUNTRY`) config for the
  node location required by the canonical node-info schema.
- Production config now refuses a password-less `REDIS_URL`; compose redis
  service requires `REDIS_PASSWORD`.

### Changed
- `GET /api/v1/node/info` includes the required `location` object and
  `schema_version`, and validates against the canonical node-info schema.
- Default `NODE_CAPABILITIES` is now `material-registry,loopsignal`; values
  outside the canonical enum trigger a startup warning.
- Docker Compose hardening: API container drops all capabilities, all
  services set `no-new-privileges`, redis requires authentication.
- Schema sync now also covers `transaction`, `loopsignal`, and `node-info`
  canonical schemas.

### Fixed
- Docs-hub mirror drift: `localloop-site`'s `openapi.json` copy resynced to
  the canonical loop-protocol contract (caught by the new conformance gate).
- `GET /api/v1/events` responses carried empty `payload: {}` objects —
  fast-json-stringify was stripping event contents (missing
  `additionalProperties` on the response schema).

## [0.3.1] - 2026-07-18

### Added
- `Idempotency-Key` cache rows now expire after 24 hours; a request bearing an
  expired key runs fresh instead of replaying stale data or permanently
  conflicting. Bounds how long a key can be held, since this profile's
  single-shared-API-key auth model has no caller identity to scope keys to.
- `bun run cleanup:idempotency-keys` to purge idempotency cache rows past the
  retention window.

## [0.3.0] - 2026-07-18

### Added
- Core-DP local search for MaterialDNA/ProductDNA: `POST /api/v1/material/search`
  and `POST /api/v1/product/search`, with filters, opaque cursor pagination, and
  deterministic ordering.
- Append-only evidence log, enforced at the database level (rejects `UPDATE`,
  `DELETE`, and `TRUNCATE`), recorded automatically on every material/product/
  offer/match/transfer creation; exposed via `GET /api/v1/evidence/:event_id`,
  `GET /api/v1/evidence`, and `POST /api/v1/evidence/search`.
- Signed Core-DP message envelope (`src/envelope.ts`): Ed25519 sign/verify over
  a canonical signing input, replay-window validation, and peer-key trust-store
  lifecycle checks (active/rotated/revoked).
- `Idempotency-Key` header support on material/product/offer/match/transfer
  creation, safe under concurrent retries.
- Standardized Core-DP error response shape (`src/errors.ts`) for the new
  search and evidence endpoints.
- `bun run sync:schemas` / `check:schemas` to keep this repo's schema copies
  verified byte-identical against `loop-protocol`'s canonical source.

### Fixed
- `product-dna.schema.json`'s related-materials id pattern was missing the
  required `MAT-` prefix — a drift from the canonical `loop-protocol` schema,
  corrected by the new schema sync.

## [0.2.4] - 2026-05-27

### Fixed
- Federation handshake OpenAPI body/response schemas now register as standalone
  `$ref` targets instead of unresolved `#/definitions/` pointers.
- Offer, match, transfer, and material-status schemas now require the `MAT-`
  MaterialDNA id prefix, matching the protocol spec and material-dna schema.
- Test fixtures updated to canonical `localloop.urbnia.com` JSON-LD contexts and
  `MAT-` material ids; SSE CORS tests mutate `config.allowedOrigins` directly.

## [0.2.3] - 2026-05-26

### Added
- GET endpoints for all five Loop entity types: `GET /api/v1/material/:id`,
  `/material`, `/product/:id`, `/product`, `/offer/:id`, `/offer`,
  `/match/:id`, `/match`, `/transfer/:id`, `/transfer`.
- Minimal lab `GET /api/v1/node/info` endpoint for local node metadata.
- Backup automation artifacts: `deploy/backup.sh`, systemd backup service, and timer.
- `category` and `status` query filters on list endpoints.
- Migration `010_loop_indexes.sql`: performance indexes on all loop_* tables
  (category, status, city columns, FK columns, created_at DESC).
- Health endpoint now probes the database pool and returns `db: "ok"/"error"`;
  responds `503` if the DB is unreachable.
- Pool configuration: `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`,
  `REQUEST_TIMEOUT_MS` wired through config into Fastify and pg Pool.
- Docker Compose resource limits (CPU + memory) on all four services.
- Port `127.0.0.1:8088:8088` exposed in Docker Compose for local dev.

### Changed
- `DB_POOL_SIZE` default raised from 10 to 20.
- `.env.docker.example` documents new pool/timeout vars.
- Federation handshake responses now default to the preferred v0.2.0 context/version.
- Relay validation now restricts relayed event/entity combinations to supported lab event families.
- `deploy/setup.sh` now provisions `.env.docker` for Docker-based operations.

### Security
- Rotated all `.env.docker` secrets (postgres, minio, better-auth).

### Maintenance
- Upgraded all dependencies: TypeScript 6.0.3, Prisma 7.8.0, zod 4.4.3, better-auth 1.6.11, @aws-sdk/client-s3 latest, bullmq 5.77.3, fastify 5.8.5
- Upgraded Contributor Covenant to v3.0
- Replaced personal contact with org identity (dev@mycel-ai.de)


## [0.2.2] - 2025-12-19

### Added
- Prisma v7 ORM client and schema mappings for core tables.

### Changed
- Interest and city data access now go through Prisma (raw SQL for PostGIS/search).


## [0.2.1] - 2025-12-19

### Added
- City GIS filters (bbox/near/radius) and GeoJSON FeatureCollection endpoint.
- Route-level validation for city query parameters.


## [0.2.0] - 2025-12-19

### Added
- Bun + Fastify API stack with Postgres, Redis, MinIO scaffolding.
- Full-text search materialized view and demo city data.
- OpenAPI JSON and Redoc documentation routes.
- Real-time interest SSE stream and BullMQ queue hooks.

### Changed
- Migrated backend runtime from Node/Express to Bun/Fastify.
- Updated Docker Compose to include Postgres 18.1, Redis, and MinIO.
- Updated systemd service to run the Bun server.


## [0.1.1] - 2025-12-20

### Added
- Minimal interop lab demo endpoints (MaterialDNA → Offer → Match → Transfer).
- Loop event log + SSE stream for demo state updates.
- Lab demo scripts (seed + simulate + one-command runner).
- Privacy notice endpoint and in-memory metrics snapshot.

[Unreleased]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.4...HEAD
[0.4.4]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.0...v0.4.1
