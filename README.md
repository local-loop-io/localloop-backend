# localLOOP Backend

Backend service for the localLOOP lab demo — interest registry, city data, and minimal LOOP protocol interop flows.

> This project is an early, low-TRL concept. There are no public pilots or deployments. Lab demo only.

## At a glance
| Item | Details |
| --- | --- |
| Runtime | Bun + Fastify |
| Data | PostgreSQL (PostGIS), Redis, MinIO |
| API base | https://loop-api.urbnia.com |
| Docs | Live OpenAPI at `/openapi.json`, Redoc at `/docs` |

## Quickstart (local)
```bash
bun install
cp .env.example .env          # adjust values as needed
docker compose up -d          # start Postgres, Redis, MinIO
bun run dev                   # API on :8088
bun test                      # run all tests
```

## API

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service + DB status. Returns `503` if DB unreachable. |

### Interest
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/interest` | Submit an Expression of Interest |
| `GET` | `/api/interest` | List Expressions of Interest |
| `GET` | `/api/interest/stream` | SSE stream for new interest events |

### Loop demo (MaterialDNA → Offer → Match → Transfer)
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/v1/material` | Register a MaterialDNA record |
| `GET` | `/api/v1/material/:id` | Retrieve a material by ID |
| `GET` | `/api/v1/material` | List materials (`limit`, `category`) |
| `POST` | `/api/v1/product` | Register a ProductDNA record |
| `GET` | `/api/v1/product/:id` | Retrieve a product by ID |
| `GET` | `/api/v1/product` | List products (`limit`, `category`) |
| `POST` | `/api/v1/offer` | Create an Offer |
| `GET` | `/api/v1/offer/:id` | Retrieve an offer by ID |
| `GET` | `/api/v1/offer` | List offers (`limit`, `status`) |
| `POST` | `/api/v1/match` | Record a Match |
| `GET` | `/api/v1/match/:id` | Retrieve a match by ID |
| `GET` | `/api/v1/match` | List matches (`limit`) |
| `POST` | `/api/v1/transfer` | Record a Transfer |
| `GET` | `/api/v1/transfer/:id` | Retrieve a transfer by ID |
| `GET` | `/api/v1/transfer` | List transfers (`limit`) |
| `POST` | `/api/v1/material-status` | Record a material status update |
| `GET` | `/api/v1/events` | List loop events (`limit`) |
| `GET` | `/api/v1/stream` | SSE stream for loop events |
| `POST` | `/api/v1/relay` | Relay a loop event from another node |

### Federation
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/federation/nodes` | List known federation nodes |
| `POST` | `/api/v1/federation/handshake` | Register a federation node |

### Cities
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/cities` | List demo cities |
| `GET` | `/api/cities/:slug` | City detail |
| `GET` | `/api/cities/geojson` | GeoJSON FeatureCollection |

### Other
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/metrics` | In-memory service metrics snapshot |
| `GET` | `/api/privacy` | Privacy notice |
| `GET` | `/openapi.json` | OpenAPI spec (auto-generated) |
| `GET` | `/docs` | Redoc UI |

LOOP write routes accept both `application/json` and `application/ld+json`.

## Environment variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | — | Postgres connection string (required) |
| `DATABASE_SSL` | `false` | Enable TLS for Postgres |
| `DB_POOL_SIZE` | `20` | Max pool connections |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Close idle connections after ms |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Fail if no pool slot in ms |
| `REDIS_URL` | — | Redis connection string |
| `MINIO_SECRET_KEY` | — | MinIO secret (required) |
| `ALLOWED_ORIGINS` | `https://local-loop-io.github.io` | CORS allowlist (comma-separated) |
| `RATE_LIMIT_MAX` | `60` | Global rate limit per window |
| `RATE_LIMIT_WRITE_MAX` | `20` | Write route rate limit per window |
| `REQUEST_TIMEOUT_MS` | `30000` | Server connection timeout |
| `AUTH_ENABLED` | `false` | Enable BetterAuth |
| `API_KEY_ENABLED` | `false` | Require `X-API-Key` on write routes |
| `RUN_MIGRATIONS` | `true` | Auto-run DB migrations on startup |

In `NODE_ENV=production` the server refuses to start with missing or weak secrets.

## Repo layout
```
src/
  config.ts        env validation (Zod)
  server.ts        Fastify app setup
  routes/          one file per route group
  db/
    pool.ts        pg connection pool
    migrations/    numbered .sql files
    loop.ts        loop entity queries
  realtime/        SSE stream handlers
  security/        API key middleware
scripts/           lab demo + federation scripts
deploy/            systemd service + nginx example
tests/             Bun test suite
```

## Notes
- Lab demo only. No public pilots or deployments.
- The normative protocol reference is [loop-protocol](https://github.com/local-loop-io/loop-protocol).

## Links
- Protocol spec: https://github.com/local-loop-io/loop-protocol
- Docs hub: https://local-loop-io.github.io
