# LocalLoop Backend

Backend service for collecting and publishing Expressions of Interest for the LocalLoop protocol.

> This project is an early, low‑TRL concept. There are no public pilots or deployments yet.

## Features
- Accepts Expression of Interest submissions.
- Publishes a public list for transparency.
- SQLite storage with rate limiting and input validation.

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

## Local Development
```bash
npm install
npm test
npm start
```

## Configuration
Copy `.env.example` and adjust:
- `PORT`
- `DATABASE_PATH`
- `PUBLIC_LIMIT`
- `ALLOWED_ORIGINS`
- `RATE_LIMIT_MAX`

## Deployment
- Run behind a reverse proxy with TLS (Nginx or Caddy).
- Keep `ALLOWED_ORIGINS` restricted to `https://local-loop-io.github.io`.
- Use `deploy/localloop-backend.service` if you want a systemd unit.

## License
MIT (c) 2025-2026 Alphin Tom.
