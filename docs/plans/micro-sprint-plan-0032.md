# Micro-sprint plan 0032 — auth disabled 503 envelope guard

## Status
IN_PROGRESS

## Cycle
32

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `606a28a` matches `origin/main`
- Cycle 0031 closed apiKey 503 misconfiguration unit test; 237 tests pass
- Conformance gate green (`bun run check:conformance`)
- P2/P3 deferred per guidance: ETag federation/nodes, docs cache policy,
  route-level apiKey 503 duplicate, org root docs
- Remaining untested 503 §8.3 surface: `handleAuth` in `src/auth.ts` emits
  `sendSpecErrorForStatus(503, 'Auth is disabled')` when Better Auth is off
- Cycle 0029 payment 503 sweep noted auth/apiKey guards as follow-up; apiKey
  503 closed in 0031; auth disabled path still lacks regression guard

## Selected item
Add unit test asserting `handleAuth` returns 503 with §8.3 `INTERNAL_ERROR`
envelope when Better Auth is not active (default lab config).

## Priority rationale
Smallest complete P1 deliverable — guard logic exists and is reachable via
`/api/auth/*` proxy; test prevents accidental regression to legacy error shapes
or wrong status codes on the auth-disabled path.

## Implementation
1. `tests/auth.test.ts` — one test: auth null → 503 envelope with message

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test + plan |

## Verification
- `bun test tests/auth.test.ts` — pass
- `bun run typecheck` — pass
- `bun run test` — full suite pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- (fill after close)

## Gaps for cycle 0033
- (fill after close)

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
