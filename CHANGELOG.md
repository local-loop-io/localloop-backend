# Changelog

## Unreleased
### Added
- Lab federation relay endpoint and two-node demo scripts.
- API body size limit configuration (`BODY_LIMIT`).
- Typecheck step in CI plus SSE stream test coverage.

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
