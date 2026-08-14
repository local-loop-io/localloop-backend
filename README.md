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
bun run test                  # run all tests (--isolate; see CONTRIBUTING.md)
```

## API

### Health
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service + DB + Redis status (`db`, `redis`). Returns `503` if either probe fails. `Cache-Control: no-store`. |

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
| `POST` | `/api/v1/material/search` | Spec §8.1 protocol search (`category` glob, `radius_km`, `min_quantity`) and additive Core-DP contract (`limit` + filters + cursor) |
| `GET` | `/api/v1/node/info` | NodeInfo JSON-LD (validates against canonical node-info schema) |
| `GET` | `/api/v1/signals` | LoopSignalConfig JSON-LD published by this node (spec §8.1) |
| `POST` | `/api/v1/transaction` | Record a transaction (canonical transaction schema); responds TransactionStatus |
| `GET` | `/api/v1/transaction/:id` | Resolve a transaction's `settlement_url` |
| `POST` | `/api/v1/product` | Register a ProductDNA record |
| `GET` | `/api/v1/product/:id` | Retrieve a product by ID |
| `GET` | `/api/v1/product` | List products (`limit`, `category`) |
| `POST` | `/api/v1/product/search` | Core-DP search (additive lab profile) |
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
| `POST` | `/api/v1/relay` | Relay a supported lab loop event from another node |

### Federation
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/federation/nodes` | List known federation nodes |
| `POST` | `/api/v1/federation/handshake` | Register a federation node (lab-only handshake) |
| `POST` | `/api/v1/federate/announce` | Spec §8.2 MaterialAnnouncement (requires §9.2 node headers) |
| `POST` | `/api/v1/federate/offer` | Spec §8.2 inbound MaterialOffer for a locally hosted material |

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
Protocol GET endpoints (`/api/v1/node/info`, `/api/v1/signals`, `/api/v1/transaction/:id`) respond with `application/ld+json`.
Node-to-node routes (`/api/v1/federate/*`) require the spec §9.2 headers
`X-Node-ID`, `X-Node-Signature`, and `X-Timestamp` (±5 minutes). Signature
presence and timestamp freshness are enforced; cryptographic verification is
not implemented in this lab preview.

## Spec conformance

This repo aims to be the reference implementation of
[loop-protocol](https://github.com/local-loop-io/loop-protocol) v0.2.0: every
endpoint required by SPECIFICATION.md §8 and `openapi.json` is implemented and
validated against the canonical JSON schemas (synced byte-identical into
`src/schemas/`).

- Compliance matrix: [docs/SPEC-COMPLIANCE.md](docs/SPEC-COMPLIANCE.md)
- `bun run check:conformance` — three-way drift gate (backend ↔ loop-protocol
  ↔ docs-hub mirror at `localloop-site/public/projects/loop-protocol/`):
  schema copies, mirrored artifacts, and the implemented route surface must
  not drift. Runs in tests (`tests/conformance.test.ts`) and in CI
  (`protocol-parity.yml`).
- `tests/specResponses.test.ts` validates live route responses against the
  canonical JSON schemas.

## Environment variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | — | Postgres connection string (required) |
| `DATABASE_SSL` | `false` | Enable TLS for Postgres |
| `DB_POOL_SIZE` | `20` | Max pool connections |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Close idle connections after ms |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Fail if no pool slot in ms |
| `REDIS_URL` | — | Redis connection string (must embed a password in production) |
| `REDIS_PASSWORD` | — | Redis password for the compose redis service |
| `MINIO_SECRET_KEY` | — | MinIO secret (required) |
| `ALLOWED_ORIGINS` | `https://localloop.urbnia.com` | CORS allowlist (comma-separated) |
| `NODE_ID` | `lab-hub.loop` | Node identifier (pattern: `*.loop`) |
| `NODE_CAPABILITIES` | `material-registry,loopsignal` | Advertised capabilities; canonical enum only |
| `NODE_LAT` / `NODE_LON` | `48.1351` / `11.582` | Node location (required by canonical node-info schema; powers `radius_km` search) |
| `NODE_CITY` / `NODE_COUNTRY` | — | Optional node location metadata |
| `RATE_LIMIT_MAX` | `600` | Global read-route limit per window; write routes use `RATE_LIMIT_WRITE_MAX` |
| `RATE_LIMIT_WRITE_MAX` | `20` | Write route rate limit per window |
| `REQUEST_TIMEOUT_MS` | `30000` | Server connection timeout |
| `AUTH_ENABLED` | `false` | Enable BetterAuth |
| `API_KEY_ENABLED` | `false` | Require `X-API-Key` on write routes |
| `RUN_MIGRATIONS` | `true` | Auto-run DB migrations on startup |
| `WORKER_ENABLED` | `false` | Consume queued interest jobs. When left at the default `false`, `POST /api/interest` still enqueues a BullMQ job, but nothing ever picks it up. |

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
- Docs hub: https://localloop.urbnia.com
