# Changelog

## Unreleased
### Added
- GET endpoints for all five Loop entity types: `GET /api/v1/material/:id`,
  `/material`, `/product/:id`, `/product`, `/offer/:id`, `/offer`,
  `/match/:id`, `/match`, `/transfer/:id`, `/transfer`.
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

### Security
- Rotated all `.env.docker` secrets (postgres, minio, better-auth).


## 0.2.2 - 2025-12-19
### Added
- Prisma v7 ORM client and schema mappings for core tables.

### Changed
- Interest and city data access now go through Prisma (raw SQL for PostGIS/search).

## 0.2.1 - 2025-12-19
### Added
- City GIS filters (bbox/near/radius) and GeoJSON FeatureCollection endpoint.
- Route-level validation for city query parameters.

## 0.2.0 - 2025-12-19
### Added
- Bun + Fastify API stack with Postgres, Redis, MinIO scaffolding.
- Full-text search materialized view and demo city data.
- OpenAPI JSON and Redoc documentation routes.
- Real-time interest SSE stream and BullMQ queue hooks.

### Changed
- Migrated backend runtime from Node/Express to Bun/Fastify.
- Updated Docker Compose to include Postgres 18.1, Redis, and MinIO.
- Updated systemd service to run the Bun server.

### Notes
- Auth is disabled by default; enable with `AUTH_ENABLED=true` and `BETTER_AUTH_SECRET`.

## 0.1.1-demo - 2025-12-20
### Added
- Minimal interop lab demo endpoints (MaterialDNA → Offer → Match → Transfer).
- Loop event log + SSE stream for demo state updates.
- Lab demo scripts (seed + simulate + one-command runner).
- Privacy notice endpoint and in-memory metrics snapshot.

### Notes
- Lab-only demo. No public pilots or deployments.
