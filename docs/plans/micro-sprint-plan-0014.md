# Micro-sprint plan 0014 — evidence route cache header tests

## Status
COMPLETED

## Cycle
14

## Control repository
`localloop-backend`

## Observation
- Cycle 0013 gaps: evidence plugin cache header tests deferred (DB coupling); ETag/Last-Modified on federation/nodes deferred; GET-by-id loop cache tests optional
- `evidence.ts` applies plugin-wide `onRequest` `setNoStore` hook on 3 routes: GET by id, GET list, POST search
- `evidence.test.ts` covers DB append-only behavior with integration setup but not HTTP cache headers
- Evidence routes import DB functions directly (no deps injection), unlike payments/transactions plugins
- Remote HEAD verified at `ae52577` (synced with `origin/main`)

## Selected item
Add `Cache-Control: no-store` assertions for `GET /api/v1/evidence/:event_id`, `GET /api/v1/evidence`, and `POST /api/v1/evidence/search` in a new `tests/evidence.cache.headers.test.ts`.

## Priority rationale
Evidence plugin has its own `onRequest` no-store hook; append-only audit log responses must not be cached. Cycle 0013 deferred this due to DB coupling; Bun `mock.module` on `../src/db/evidence` enables isolated Fastify inject tests without Postgres.

## Skipped optional items
- ETag/Last-Modified on federation/nodes — deferred per cycle 0013
- GET-by-id loop cache tests — same loop hook already covered 15 times

## Implementation
1. Created `tests/evidence.cache.headers.test.ts` with `mock.module('../src/db/evidence', …)` stubbing `getLoopEvidenceByEventId` and `listLoopEvidence`
2. Dynamic import of `registerEvidenceRoutes` after mock registration
3. `it.each` asserts `cache-control: no-store` on all 3 evidence routes (200 responses)
4. No production changes required

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test addition + plan |

## Verification
- `bun test tests/evidence.cache.headers.test.ts` — 3 pass
- `bun run typecheck` — pass

## Deploy order
1. `localloop-backend` only (test-only change)

## RSI learning
- Bun `mock.module` before dynamic import successfully isolates evidence route cache tests from Postgres; pattern applies to any route plugin that imports DB modules directly without deps injection.
- After cycle 0014, cache header test coverage spans loop (15), federation registry (3), federate (2), transactions (2), payments (2), evidence (3), signals (1), cities (1), interest (1), SSE streams (2), health/auth/metrics/utility — evidence plugin gap closed.
- Module mocking is preferable to integration-style cache tests when only HTTP headers are under test; reserve DB integration for append-only and pagination semantics (already in `evidence.test.ts`).

## Gaps for next cycle
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).
- Audit remaining route plugins for uncovered cache policies (if any).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | (pending) | implementation | pending |
| `localloop-backend` | (pending) | plan close (HEAD) | pending |
