# Micro-sprint plan 0017 — interest conditional cache header refactor

## Status
COMPLETED

## Cycle
17

## Control repository
`localloop-backend`

## Observation
- Cycle 0016 gaps: `interest.ts` retains conditional inline Cache-Control (checks existing header before setting) — different pattern from simple `setNoStore` swap
- All other lab route plugins now use `setNoStore` or `setPublicShortCache` from `httpCache.ts`
- `interest.ts` onSend hook: sets `no-store` only when `Cache-Control` header not already present
- Existing tests: `interest.cache.headers.test.ts` asserts no-store on GET; `httpCache.test.ts` covers helpers
- Remote HEAD verified at `0b83fe8` (synced with `origin/main`)

## Selected item
Refactor `interest.ts` conditional cache header to use shared `setNoStoreIfUnset` helper in `httpCache.ts`.

## Priority rationale
Zero behavior change; closes the last inline Cache-Control pattern and completes httpCache consolidation. Smallest complete change preserving existing-header guard semantics.

## Skipped optional items
- Docs routes (`/openapi.json`, `/docs`) cache policy — functional decision; not lab-data surface
- ETag/Last-Modified on federation/nodes — deferred per cycle 0014/0015/0016
- GET-by-id loop cache tests — same loop hook already covered 15 times

## Implementation
1. Add `setNoStoreIfUnset(reply)` to `httpCache.ts` — delegates to `setNoStore` when header absent
2. Replace inline conditional in `interest.ts` onSend hook with `setNoStoreIfUnset(reply)`
3. Extend `httpCache.test.ts` with guard-behavior tests (skip when set, apply when unset)

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Refactor + plan |

## Verification
- `bun run typecheck` — pass
- `bun test tests/interest.cache.headers.test.ts tests/interest.routes.test.ts tests/httpCache.test.ts` — pass

## Deploy order
1. `localloop-backend` only (helper + hook refactor)

## RSI learning
- Conditional cache headers in onSend hooks benefit from a dedicated `setNoStoreIfUnset` helper rather than forcing `setNoStore` (which would overwrite) or leaving inline guards.
- Unit tests for guard behavior belong in `httpCache.test.ts`; route-level tests remain unchanged when hook semantics are preserved.
- Inline Cache-Control theme is now fully closed across all lab route plugins.

## Gaps for next cycle
- ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- Docs routes (`/openapi.json`, `/docs`) cache policy undecided — functional item if spec UI caching is desired.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `ecff4cc` | implementation | yes |
| `localloop-backend` | `451b80a` | plan close (HEAD) | yes (`origin/main`) |
