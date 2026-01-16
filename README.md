# LocalLoop Backend

Backend service for collecting and publishing Expressions of Interest for the LocalLoop protocol.

> This project is an early, low-TRL concept. There are no public pilots or deployments. Lab demo only.

## At a glance
| Item | Details |
| --- | --- |
| Runtime | Bun + Fastify |
| Data | PostgreSQL, Redis, MinIO |
| API base | https://loop-api.urbnia.com |
| Docs | Swagger at `/docs` |

## Quickstart (local)
```bash
# from repo root
bun install
bun test

# optional: run with Docker Compose
# docker compose up -d --build
```

## API highlights
- `GET /health`: service status.
- `POST /api/interest`: submit an Expression of Interest.
- `GET /api/interest`: list Expressions of Interest.
- `GET /api/interest/stream`: SSE stream for new interest.
- `GET /api/loop/stream`: SSE stream for lab demo flow.
- `GET /api/metrics`: service metrics.

## Repo layout
- `src/`: Fastify app and routes.
- `tests/`: API and integration tests.
- `docker-compose.yml`: local infra stack.
- `scripts/`: utilities and checks.

## Notes
- Keep outward messaging lab demo only.
- No public pilots or deployments.

## Links
- Protocol spec: https://github.com/local-loop-io/loop-protocol
- Docs hub: https://local-loop-io.github.io

## Contributing
- See `../AGENTS.md` for org context and domain policy.
