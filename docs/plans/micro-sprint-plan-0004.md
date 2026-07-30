# Micro-sprint plan 0004 — interest SSE stream no-cache test

## Status
COMPLETED

## Cycle
4

## Control repository
`localloop-backend`

## Observation
- Cycle 0003 gaps: interest stream tests cover CORS and max-clients but not `Cache-Control`
- `interestStream.ts` sets `Cache-Control: no-cache` via `reply.raw.writeHead` (SSE convention; distinct from REST `no-store`)
- GET `/api/interest` already asserts `no-store` in `interest.cache.headers.test.ts`
- Remote HEAD verified at `86331ad` (synced with `origin/main`)

## Selected item
Add `Cache-Control: no-cache` assertion for GET `/api/interest/stream` in `tests/interest.stream.test.ts`.

## Priority rationale
SSE streams require `no-cache` (not `no-store`) so intermediaries revalidate while keeping the connection open. Production behavior is correct; missing test leaves the SSE cache policy undocumented and unguarded against regressions. Smallest independently shippable diff from cycle 0003 gaps.

## Implementation
1. Added test case to `tests/interest.stream.test.ts` mirroring existing CORS/max-clients pattern
2. Calls `registerInterestStream` directly with `makeReply` helper; asserts `Cache-Control: no-cache` on 200 response

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/interest.stream.test.ts` — 3 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- SSE endpoints use `no-cache` via raw `writeHead`, not Fastify `reply.header`; unit tests must invoke the stream registrar directly (as with CORS tests), not `app.inject`.
- Loop stream (`loopStream.ts`) uses the same SSE `no-cache` pattern but lacks an equivalent cache header test — mirror candidate for cycle 0005.

## Gaps for next cycle
- Audit remaining loop routes (material-status, product writes, GET search/list) for cache policy tests.
- Add `Cache-Control: no-cache` assertion for GET `/api/v1/stream` (loop SSE; same pattern as interest stream).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `714cd47` | implementation | yes |
| `localloop-backend` | `3514478` | plan close (HEAD) | yes (`origin/main`) |
