# Changelog

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
