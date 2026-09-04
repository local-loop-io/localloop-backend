# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.2] - 2026-09-04

### Fixed
- **Backups:** `deploy/backup.sh` issued `redis-cli SAVE` without authenticating
  against the compose Valkey service (which always runs with `--requirepass`);
  the command returned `NOAUTH` with exit status 0, so the copied `dump.rdb`
  was silently whatever the last automatic save had written. The script now
  authenticates, fails loudly if `SAVE` does not answer `OK`, and never deletes
  the run the `latest` symlink points at during retention cleanup.
- **Idempotency:** `loop_idempotency_keys` was keyed on `key` alone while
  lookups filtered on `(key, route)`, so reusing one `Idempotency-Key` on two
  routes overwrote the first route's cached response and a legitimate retry
  re-ran its handler (migration `018_loop_idempotency_route_scope.sql`).
  `withIdempotency` also held a pool client for its advisory lock while the
  handler waited for a second client, so `DB_POOL_SIZE` concurrent keyed writes
  stalled until the connection timeout; the lock client is now handed to the
  handler and reused for its transaction.
- **State machine:** a transfer for a match that already has an active transfer,
  and a match against an already-reserved offer, are `409 CONFLICT` again
  (0.6.1 had turned the transfer case into `400 INVALID_REQUEST`; the test that
  covered it stubbed a raw `23505` and could not catch the regression).
- **Foreign-key violations** on write routes returned `409 CONFLICT` with the
  message "Related resource was not found"; they are `400 INVALID_REQUEST`.
- **SSE streams** (`/api/v1/stream`, `/api/interest/stream`) call
  `reply.hijack()`, guard every write so a dead subscriber socket no longer
  turns the write request that triggered the broadcast into a `500`, and clean
  up on response-side `close`/`error` as well as request close.
- **Route encapsulation:** route groups are registered as encapsulated plugins,
  so the `Cache-Control: no-store` hooks they add no longer run globally (seven
  copies per request, including on `/openapi.json`).
- `trustProxy: 1` instead of `true`: only the single reverse-proxy hop is
  trusted, so a client can no longer choose its own `request.ip` via
  `X-Forwarded-For` and sidestep the per-IP rate limits.
- List routes rejected nothing: `GET /api/v1/material?limit=-1` reached
  `LIMIT -1` and answered `500`. `limit` must now be an integer ≥ 1 (values
  above the cap are clamped), on the loop list routes, `/api/v1/events`,
  `/api/interest`, and `/api/cities`.
- `POST /api/v1/material-status` was the only write route without
  `Idempotency-Key` support or database-error mapping; a retried update
  appended duplicate `loop_events` and duplicate append-only evidence rows.
- Core-DP search responses claimed `consistency.mode: snapshot` with a random
  `snapshot_id` although each page is an independent query; they now report
  `eventual` with `as_of`. Search routes use the read rate limit instead of the
  20-per-window write limit.
- `REFRESH MATERIALIZED VIEW interests_search` runs `CONCURRENTLY`, so
  `GET /api/interest?search=` is no longer blocked for the duration of every
  `POST /api/interest`.
- Migration runner: a session advisory lock serialises concurrent runners
  (compose `api` with `RUN_MIGRATIONS=true` racing `bun run migrate`); the
  constraint statements in migrations 011 and 016 are re-runnable.
- Shutdown: re-entrancy guard, 10 s force-exit, and the BullMQ connection,
  Prisma client, and better-auth pool are closed (the auth pool is no longer
  created at all when `AUTH_ENABLED=false`).
- §9.2: a missing or blank `X-Timestamp` is `400 INVALID_REQUEST` (malformed
  request); only a well-formed but stale timestamp is `401`.
- Health/metrics/node-info and the OpenAPI document derive their version from
  one `src/version.ts`; the OpenAPI `info.version` was a hard-coded, stale
  `0.2.0-lab` (the spec baseline is now `info.x-protocol-version`).
- `deploy/healthcheck-alert.sh` built its webhook payload by string
  interpolation (invalid JSON whenever the embedded `/health` body contained
  quotes) and treated the degraded `503` as "unreachable"; `deploy/setup.sh`
  did not copy `storage-proxy/` or `scripts/`, chmod'ed the source tree instead
  of the install, and installed units pointing at three different paths — the
  units now carry one placeholder path that `setup.sh` rewrites to
  `INSTALL_DIR`. `deploy/nginx.conf` disables buffering for the SSE routes.
- `.env.example` used Docker-internal hostnames (`postgres`, `redis`,
  `minio-proxy`) and an unauthenticated `REDIS_URL`, so following the README
  quickstart on the host overrode working defaults with unreachable ones;
  `.env.docker.example` referenced the retired `minio-proxy` service name
  (`storage-proxy`).
- `cities`: `radiusKm` guard matched its own error message (values below 1 are
  rejected); `payments`: AJV and Zod validators agree on `amount ≥ 0.01` and a
  3-letter `currency`.
- Tests: the ~30 DB/Redis-backed cases that silently *passed* when no service
  was reachable (`if (!dbReady) return;`) are declared with `it.skipIf(...)` and
  show up as skipped. New coverage: per-route idempotency scoping, pool
  exhaustion under concurrent keyed writes, concurrent migration runners,
  `trustProxy` hop handling, SSE dead-socket handling, list-limit validation,
  duplicate/reserved conflicts on the real state-error path.

### Changed
- `docs/SPEC-COMPLIANCE.md` gains the `POST /api/v1/offer|match|transfer`
  rows (listed in loop-protocol v0.5.1's §8.1/`openapi.json`), records the
  intentional Core-DP error-body exception for the search contract and
  evidence routes (the previous text claimed every lab surface used the §8.3
  envelope), and uses "locked lab scenario" wording in line with the claims
  policy. README documents the actual stack (Valkey, SeaweedFS), the
  host/container split of the two env examples, the eight tables without a
  Prisma model, and the evidence/payments/auth routes it omitted.
- Biome (`bun run lint`) added as the linter; CI runs it, installs with
  `--frozen-lockfile`, uses the same pinned Valkey image as `docker-compose.yml`
  (the old comment claimed parity while pinning Redis), and runs
  `check:schemas` (tolerant of the missing sibling checkout only via
  `SCHEMA_SYNC_ALLOW_MISSING=1`).
- `scripts/sync-schemas.ts` drift-checks `material-status.schema.json` (it was
  validated against but never compared) and self-checks the base schema
  directory the way it already did for Core-DP; `scripts/check-protocol-parity.sh`
  (unexecutable, unreferenced, diverging list) removed; `bun run check:domains`
  added.
- Dockerfile on `oven/bun:1.4.0`, `--frozen-lockfile`, no `.env.example` copy.
- `prisma/schema.prisma` declares the `updated_at` columns migration 012 added;
  `prisma.config.ts` no longer points at a non-existent `prisma/migrations`.
- New indexes for the Core-DP search filters (`origin_city`, prefix
  `text_pattern_ops` on category/id) and a cursor predicate that can use the
  `(updated_at, id)` index (migration `019_loop_search_indexes.sql`).

### Removed
- `@aws-sdk/client-s3` dependency and `src/storage/s3.ts` (no importers; the
  `MINIO_*` configuration and its production secret check remain in place for
  when object storage is wired in).
- CHANGELOG: releases 0.5.0 and 0.6.0 had no sections of their own — every entry
  sat under `[0.6.1]` with repeated headings; split by release, with the
  per-agent-cycle duplicates consolidated.

## [0.6.1] - 2026-08-21

### Fixed
- Duplicate active LOOP transfers now return a clean state error instead of
  creating conflicting transfer state.

## [0.6.0] - 2026-08-15

### Added
- `AUTH_ENABLED` (better-auth) end-to-end coverage: provisioned the missing
  core schema (`user`/`session`/`account`/`verification`,
  `src/db/migrations/017_better_auth_schema.sql` — previously AUTH_ENABLED
  was wired in code with no schema ever applied, so the first sign-up would
  have failed on a missing relation), set an explicit `baseURL` on the
  `betterAuth()` config (removes the "Base URL is not set" warning and
  hardens redirect/callback correctness), and added real sign-up/sign-in
  (including wrong-password rejection)/session-issuance/`get-session`
  coverage in `tests/auth.enabled.test.ts`.
- Docker Compose log rotation (`json-file`, 10m/5 files) on all 5 services —
  previously unbounded, so container logs could grow without limit on a
  long-lived VPS host.
- Basic health-check alerting: `deploy/healthcheck-alert.sh` polls `/health`
  on a 5-minute systemd timer (`deploy/localloop-backend-healthcheck.timer`),
  fails loudly (non-zero exit, visible in `systemctl --failed` /
  `journalctl`) on a down or degraded node, and optionally POSTs to a
  webhook if `ALERT_WEBHOOK_URL` is set.

### Fixed
- `deploy/localloop-backend-backup.service` and `deploy/localloop-backend.service`
  hardcoded `/opt/localloop-backend`, which was never actually this project's real
  deployment path — same bug already fixed in the health-check timer service.
  Also found and stopped a hand-customized copy of `localloop-backend.service`
  running live against a stale, 8-month-old checkout with an outdated DB
  password, crash-looping every ~15s for 35+ hours (harmless in practice —
  Docker exclusively held the app's port the entire time — but wasteful).
  `localloop-backend.service` is now documented as the legacy bare-metal
  alternative to the actual, current Docker Compose deployment.
- `deploy/backup.sh` referenced the retired `minio` service/`data/minio`
  path (renamed to `seaweedfs` in `docker-compose.yml` at some prior point)
  — under `set -euo pipefail` this aborted the entire nightly backup run
  after the Postgres/Redis dumps but before the manifest write, `latest`
  symlink update, or retention cleanup. Caught by an actual backup/restore
  drill against the local dev stack, not a documentation read — see
  `localloop-agent` `evidence/pilot-readiness-2026-08-14/backup-restore-drill.md`.
  Fixed and re-verified end to end (real run, scratch `BACKUP_ROOT`, exited 0
  with correctly sized dumps for all three stores).

## [0.5.0] - 2026-08-14

### Added
- `status-updated` evidence event type: `POST /api/v1/material-status` now also writes
  to the append-only `loop_evidence` log (migration `016_loop_evidence_status_updated.sql`),
  closing a gap where status changes reached only the mutable `loop_events` SSE feed. See
  `loop-protocol/docs/retention-and-evidence-guidance.md`.
- Shared `httpCache` helpers for public short cache and no-store (agent cycle 016).
- `GET /health` includes package `version` for deploy forensics (agent cycle 010).
- `GET /health` now reports a `redis` probe (`ok` | `error` | `skipped`) alongside
  the existing database check. Either probe failure yields HTTP 503 / `degraded`
  so Traefik and Docker healthchecks surface Redis outages (agent cycle 001).

### Changed
- loop routes set no-store (agent cycle 031).
- payments routes set no-store (agent cycle 030).
- federate routes set no-store (agent cycle 029).
- Federation routes set no-store (agent cycle 025).
- Evidence routes set no-store (agent cycle 024).
- Transaction routes set no-store (agent cycle 023).
- City routes call `setNoStore` (agent cycle 021; retries cycle 014).
- `GET /api/v1/signals` uses short public cache (30s) (agent cycle 018).
- `GET /api/v1/node/info` uses short public cache (30s) (agent cycle 017).
- Interest routes set `Cache-Control: no-store` (agent cycle 015).
- City routes set `Cache-Control: no-store` (agent cycle 014).
- Dockerfile copies `src` with `--chown=app:app` and avoids a second full-tree `chown` after source copy (agent cycle 013).
- `/api/auth/status` sends `Cache-Control: no-store` (agent cycle 012).
- `/api/privacy` and `/api/metrics` send `Cache-Control: no-store` (agent cycle 011).
- README documents Redis probe and `Cache-Control: no-store` on `/health` (agent cycle 008).
- `GET /api/metrics` always lists known metric keys at zero so dashboards do not
  treat a quiet node as missing metrics (agent cycle 006).
- `GET /health` sends `Cache-Control: no-store` so proxies never cache readiness (agent cycle 005).

### Fixed
- Replaced source-string "theater" cache/metrics tests with handler inject tests
  that assert real `Cache-Control` response headers and live metrics counters
  (agent residual: honest tests).
- Metrics expose package `version`; remove broken nodeInfo cache source test that
  asserted the wrong route file (residual after agent cycles 001-100).
- Metrics key regression guard (agent cycle 100).
- Metrics key regression guard (agent cycle 096).
- Metrics key regression guard (agent cycle 092).
- Metrics key regression guard (agent cycle 088).
- Metrics key regression guard (agent cycle 084).
- Metrics key regression guard (agent cycle 080).
- Metrics key regression guard (agent cycle 076).
- Metrics key regression guard (agent cycle 072).
- Metrics key regression guard (agent cycle 068).
- Metrics key regression guard (agent cycle 064).
- Metrics key regression guard (agent cycle 060).
- Metrics key regression guard (agent cycle 056).
- Metrics key regression guard (agent cycle 052).
- Metrics key regression guard (agent cycle 048).
- Metrics key regression guard (agent cycle 044).
- CORS `allowedHeaders` includes `Idempotency-Key` so browser clients can send
  write idempotency headers without preflight failure (agent cycle 009).
- Metrics response schema now allows numeric additionalProperties so Fastify
  serialization no longer strips counter keys to `{}` (agent cycle 007).
- Privacy regression test types compile under `tsc --noEmit` (`consentPublic`
  required on insertInterest fixture; agent cycle 004).
- Interest search (`GET /api/interest?search=`) now redacts `email` from the live
  `share_email` flag instead of the materialized view snapshot, so revoking
  email sharing is effective immediately without waiting for a view refresh
  (agent cycle 003).

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

> Historical note: this entry carries a date one day before `[0.1.1]` below; the
> dates are kept as originally recorded rather than rewritten.

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

[Unreleased]: https://github.com/local-loop-io/localloop-backend/compare/v0.6.2...HEAD
[0.6.2]: https://github.com/local-loop-io/localloop-backend/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/local-loop-io/localloop-backend/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/local-loop-io/localloop-backend/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.4...v0.5.0
[0.4.4]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/local-loop-io/localloop-backend/compare/v0.4.0...v0.4.1
