# Micro-sprint plan 0011 — remove unused loop.ts cache import

## Status
COMPLETED

## Cycle
11

## Control repository
`localloop-backend`

## Observation
- Cycle 0010 gaps: unused `setPublicShortCache` import in `loop.ts` flagged since cycle 0006
- `loop.ts` applies plugin-wide `onRequest` `setNoStore` only; import was dead code
- Remote HEAD verified at `4da1fd6` (synced with `origin/main`)

## Selected item
Remove unused `setPublicShortCache` import from `src/routes/loop.ts`.

## Priority rationale
Smallest independently valuable maintainability fix; zero behavioral change; clears a recurring backlog item without touching test or production logic beyond the import line.

## Skipped optional items
- Cache header tests for transactions, evidence, or payments — next highest-value gap for cycle 0012
- ETag/Last-Modified on federation/nodes — deferred per cycle 0010

## Implementation
1. Deleted the unused `setPublicShortCache` import from `loop.ts`
2. No other refactors

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Import cleanup + plan |

## Verification
- `bun run typecheck` — pass
- `bun test tests/loop*.test.ts` — 68 pass across 5 files

## Deploy order
1. `localloop-backend` only (import-only change)

## RSI learning
- Dead imports on high-churn route plugins accumulate silently when cache strategy shifts (loop moved to full no-store while signals/federation keep short public cache); grep for import usage before assuming backlog items are still open.
- One-line import removals are safe to ship with loop test suite only; no dedicated httpCache regression needed when behavior is unchanged.

## Gaps for next cycle
- Add cache header tests for transactions, evidence, or payments plugins (each has its own `onRequest` hook; highest-value test gap after cycle 0011).
- Consider ETag or `Last-Modified` on federation/nodes if short public cache becomes desirable.
- GET-by-id loop cache tests remain optional (same loop hook already covered 15 times).

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `e431856` | implementation | yes |
| `localloop-backend` | `8ad0f3e` | plan close (HEAD) | yes (`origin/main`) |
