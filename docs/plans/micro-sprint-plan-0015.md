# Micro-sprint plan 0015 — health 503 cache header tests

## Status
IN PROGRESS

## Cycle
15

## Control repository
`localloop-backend`

## Observation
- Cycle 0014 gaps: cache header theme largely complete across route plugins; ETag/Last-Modified on federation/nodes deferred; GET-by-id loop cache tests optional
- Cache audit: all route plugins with distinct cache hooks covered by dedicated or utility tests; docs routes (`/openapi.json`, `/docs`) have no cache policy (intentionally deferred — spec UI, not lab data)
- `health.routes.test.ts` asserts `Cache-Control: no-store` on 200 only; 503 degraded responses also emit no-store in production (`health.ts` line 108) but tests omit the header check
- Cycle 005 rationale: cached health responses mask outages — especially critical for 503 degraded payloads
- Remote HEAD verified at `9eed203` (synced with `origin/main`)

## Selected item
Assert `Cache-Control: no-store` on GET `/health` 503 responses (database and redis probe failures) in `tests/health.routes.test.ts`.

## Priority rationale
Distinct error-path behavior not covered by the 200 test. Degraded health must not be cached by intermediaries or load balancers would serve stale "ok" or stale "degraded" snapshots. Test-only change; no production churn. Cache plugin theme closed; this closes the last untested health cache path.

## Skipped optional items
- ETag/Last-Modified on federation/nodes — deferred per cycle 0014
- GET-by-id loop cache tests — same loop hook already covered 15 times
- Cities slug/geojson cache tests — same plugin `onRequest` hook as list route
- Docs route cache headers — separate functional decision; not lab-data surface

## Implementation
1. Add `cache-control: no-store` assertions to both 503 test cases in `health.routes.test.ts`
2. Refactor `health.ts` to use shared `setNoStore` helper (consistency with cycle 016 httpCache pattern; zero behavior change)
3. No other production changes

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test + minor refactor + plan |

## Verification
- `bun test tests/health.routes.test.ts` — all pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test + import refactor)

## RSI learning
- (pending ship)

## Gaps for next cycle
- (pending ship)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | (pending) | implementation | — |
| `localloop-backend` | (pending) | plan close | — |
