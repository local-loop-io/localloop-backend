# Micro-sprint plan 0001 — node/info short public cache

## Status
COMPLETED

## Cycle
1

## Control repository
`localloop-backend` — primary API repo per AGENTS.md; org root is not a git repo.

## Observation
- LEDGER backlog: "node/info short public cache on federation.ts (014/017/022 lineage)"
- `httpCache.ts` documents node-info as stable enough for short public cache (same as signals)
- `federation.ts` applies blanket `setNoStore` on all routes via `onRequest` hook, overriding the intended cache policy
- `GET /api/v1/signals` already uses `setPublicShortCache(reply, 30)` per spec §8.1 public publish pattern

## Selected item
Add `Cache-Control: public, max-age=30` on `GET /api/v1/node/info`; keep `no-store` on federation list and handshake write routes.

## Priority rationale
Maintainability + spec alignment (public node metadata should be cacheable like signals). Not security-critical but closes a long-standing backlog gap with minimal, independently shippable diff.

## Implementation
1. Remove federation-wide `onRequest` no-store hook
2. Apply `setPublicShortCache(reply, 30)` in node/info handler
3. Apply `setNoStore(reply)` in federation/nodes and handshake handlers
4. Add targeted cache header test mirroring `signals.cache.headers.test.ts`

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Implementation + plan |

## Verification
- `bun test tests/node.cache.headers.test.ts`
- `bun test tests/federation.routes.test.ts`
- `bun run typecheck`

## Deploy order
1. `localloop-backend` only (no protocol/site dependency)

## RSI learning
- Federation routes had a blanket `onRequest` no-store hook that prevented the documented node-info cache policy in `httpCache.ts`; per-route headers match the signals pattern and are easier to test in isolation.
- Micro-sprint plan files belong in the control repo (`localloop-backend/docs/plans/`); org root is not a git repo.

## Gaps for next cycle
- Add cache header assertion for POST `/api/v1/federation/handshake` (no-store) in tests.
- Consider whether `/api/v1/federation/nodes` could also use short public cache (currently dynamic `updated_at`).
- LEDGER backlog: prefer highest-value explore→select over hygiene stamps; capture contemporaneous deploy artifacts.

## Commit SHAs
| Repo | Local | Remote verified |
|------|-------|-----------------|
| `localloop-backend` | `3074ba0` (implementation) | pending push |
