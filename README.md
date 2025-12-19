# LocalLoop Backend

Backend service for collecting and publishing Expressions of Interest for the LocalLoop protocol.

> This project is an early, low-TRL concept. There are no public pilots or deployments yet.

## Stack
- **Runtime**: Bun
- **API**: Fastify
- **Database**: PostgreSQL 18.x (PostGIS-enabled image; pgvector provisioned when available)
- **ORM**: Prisma v7
- **Cache/Queue**: Redis + BullMQ
- **Object Storage**: MinIO (S3 compatible)
- **Auth**: Better Auth (disabled by default)

## Features
- Accepts Expression of Interest submissions.
- Publishes a public list for transparency.
- Full-text search powered by Postgres materialized views.
- Real-time interest stream via Server-Sent Events.
- OpenAPI + Redoc docs.

## API

### `GET /health`
Returns service status.

### `POST /api/interest`
Create a new expression of interest.

Request body:
```json
{
  "name": "Jane Doe",
  "organization": "Circular Labs",
  "role": "Ops Lead",
  "country": "DE",
  "city": "Munich",
  "website": "https://example.com",
  "email": "jane@example.com",
  "message": "Interested in pilots",
  "shareEmail": true,
  "consentPublic": true
}
```

### `GET /api/interest`
Returns public entries (default limit 100). Use `?limit=50` to override within max limit.
Use `?search=term` to query the materialized search view.

### `GET /api/interest/stream`
Server-Sent Events feed that pushes new interest submissions.

### `GET /api/cities`
Returns city records (seeded with `DEMO City`).
- Optional filters:
  - `bbox=minLon,minLat,maxLon,maxLat`
  - `near=lon,lat`
  - `radiusKm=50` (used with `near`, max 500)
  - `limit=50`

### `GET /api/cities/geojson`
Returns a GeoJSON FeatureCollection for mapping. Supports the same filters as
`/api/cities` and includes `distance_m` when `near` is provided.

### `GET /openapi.json`
OpenAPI JSON schema.

### `GET /docs`
Redoc HTML viewer for the OpenAPI spec.

## Local Development
```bash
bun install
cp .env.example .env
bun run prisma:generate
bun run dev
```

## Docker Compose (Postgres + Redis + MinIO)
```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d
```
Update `.env` if you want to run the API on the host instead of Docker.

## Configuration
Key variables (see `.env.example`):
- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_*`
- `ALLOWED_ORIGINS`
- `PUBLIC_BASE_URL`

## Migrations
Migrations run on startup by default. You can also run them manually:
```bash
bun run migrate
```

## Prisma
The Prisma schema lives in `prisma/schema.prisma` and maps to the existing SQL
migrations (custom SQL). Prisma CLI configuration lives in `prisma.config.ts`.
Generate the Prisma client after installing dependencies:
```bash
bun run prisma:generate
```

## SQLite import
```bash
bun run import:sqlite
```
Use this once to migrate legacy SQLite data into Postgres.

## Auth (Better Auth)
Auth routes are mounted at `/api/auth/*` and are disabled by default. Set `AUTH_ENABLED=true`
and configure `BETTER_AUTH_SECRET` before enabling.

## Deployment
- Run behind a reverse proxy with TLS (Traefik or Nginx).
- Keep `ALLOWED_ORIGINS` restricted to the public site.
- Use `deploy/localloop-backend.service` for systemd (Bun runtime).

## License
MIT (c) 2025-2026 Alphin Tom.

## How to Cite

If you reference this repository, please cite:
Alphin Tom. "LocalLoop Backend API." LocalLoop, GitHub repository, 2025-2026. https://github.com/local-loop-io/localloop-backend

```bibtex
@misc{localloop_backend_2025,
  author = {Alphin Tom},
  title = {LocalLoop Backend API},
  year = {2025},
  howpublished = {GitHub repository},
  url = {https://github.com/local-loop-io/localloop-backend},
  note = {Accessed 2025-12-19}
}
```
