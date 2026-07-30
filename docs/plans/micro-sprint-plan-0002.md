# Micro-sprint plan 0002 — handshake no-store cache test

## Status
IN PROGRESS

## Cycle
2

## Control repository
`localloop-backend`

## Observation
- Cycle 0001 gaps: missing POST handshake cache assertion; evaluate nodes list cache policy
- `federation.ts` already calls `setNoStore(reply)` on handshake handler (line 130)
- `node.cache.headers.test.ts` covers node/info (public short) and federation/nodes (no-store) only
- `GET /api/v1/federation/nodes` embeds dynamic `updated_at: new Date().toISOString()` per request

## Selected item
Add `Cache-Control: no-store` assertion for `POST /api/v1/federation/handshake` in `tests/node.cache.headers.test.ts`.

## Priority rationale
Missing test coverage for an existing, correct behavior. Smallest independently shippable diff; no production code change required.

## Federation nodes cache evaluation
**Decision: keep no-store (do not implement short public cache).**
- Response includes per-request `updated_at` timestamp; caching would serve stale freshness metadata.
- Node list mutates on handshake writes; 30s cache could hide newly registered peers in lab demos.
- Document as deferred unless spec adds ETag/last-modified semantics.

## Implementation
1. Extend `node.cache.headers.test.ts` with handshake POST test (register schemas/parsers like `federation.routes.test.ts`)
2. Assert `cache-control: no-store` on successful 202 response

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/node.cache.headers.test.ts`
- `bun run typecheck`

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
(pending cycle close)

## Gaps for next cycle
(pending cycle close)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| (pending) | | | |
