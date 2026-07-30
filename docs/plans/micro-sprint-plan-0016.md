# Micro-sprint plan 0016 — consolidate setNoStore on utility routes

## Status
COMPLETED

## Cycle
16

## Control repository
`localloop-backend`

## Observation
- Cycle 0015 gaps: metrics/auth/privacy still use inline `reply.header('Cache-Control', 'no-store')`; health migrated to shared `setNoStore` as template
- Grep confirms three route files with inline headers: `metrics.ts`, `auth.ts`, `privacy.ts`
- All other lab route plugins already use `setNoStore` from `httpCache.ts`
- Existing tests assert cache headers: `metrics.keys.test.ts`, `auth.routes.test.ts`, `utility.routes.test.ts` (privacy)
- Docs routes (`/openapi.json`, `/docs`) cache policy deferred — not lab-data surface; no change this cycle
- Remote HEAD verified at `76a4654` (synced with `origin/main`)

## Selected item
Replace inline `Cache-Control: no-store` headers with shared `setNoStore` in `metrics.ts`, `auth.ts`, and `privacy.ts`.

## Priority rationale
Zero behavior change; improves maintainability and completes the httpCache consolidation started in cycle 0015. All three files follow identical one-line pattern; trivial batch with existing test coverage.

## Skipped optional items
- ETag/Last-Modified on federation/nodes — deferred per cycle 0014/0015
- Docs route cache headers — functional decision; not lab-data surface
- GET-by-id loop cache tests — same loop hook already covered 15 times

## Implementation
1. Add `import { setNoStore } from '../httpCache'` to metrics, auth, privacy route files
2. Replace `reply.header('Cache-Control', 'no-store')` with `setNoStore(reply)`
3. No test changes required (behavior identical)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Refactor + plan |

## Verification
- `bun run typecheck` — pass
- `bun test tests/metrics.keys.test.ts tests/auth.routes.test.ts tests/utility.routes.test.ts tests/httpCache.test.ts` — pass

## Deploy order
1. `localloop-backend` only (import refactor)

## RSI learning
- Batch consolidation of identical one-line cache headers is safe when dedicated cache tests already exist per route; no test changes needed.
- `interest.ts` retains conditional inline Cache-Control (checks existing header before setting) — different pattern, not a simple swap; defer unless hook refactor is planned.
- All lab route plugins now use `setNoStore` or `setPublicShortCache` from `httpCache.ts`; inline Cache-Control theme is fully closed except interest conditional.

## Gaps for next cycle
- Consider refactoring `interest.ts` conditional cache header to use `setNoStore` with existing-header guard in helper or hook.
- ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — functional item if spec UI caching is desired.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `0691dcc` | implementation | yes |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
