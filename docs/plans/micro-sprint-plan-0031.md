# Micro-sprint plan 0031 — apiKey 503 misconfiguration guard

## Status
COMPLETED

## Cycle
31

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `5219e02` matches `origin/main`
- Cycle 0030 closed loop-protocol audit `localloop.github.io` → `localloop-site` path refs
- Deferred from cycles 0029–0030: apiKey 503 when `API_KEY_ENABLED=true` but `API_KEY` unset
- `requireApiKey` in `src/security/apiKey.ts` already emits `sendSpecErrorForStatus(503, …)`
- `tests/apiKey.test.ts` covers disabled, missing header (401), valid x-api-key, valid bearer —
  no case for enabled-without-key misconfiguration

## Selected item
Add unit test asserting `requireApiKey` returns 503 with §8.3 `INTERNAL_ERROR` envelope when
API key protection is enabled but no key is configured.

## Priority rationale
Smallest complete P1 deliverable — guard logic exists; test prevents accidental regression
to 401 or legacy error shapes on the misconfiguration path.

## Implementation
1. `tests/apiKey.test.ts` — one new test: enabled + `apiKey` undefined → 503 envelope

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Test + plan |

## Verification
- `bun test tests/apiKey.test.ts` — pass
- `bun run typecheck` — pass
- `bun run test` — full suite pass

## Deploy order
1. `localloop-backend` only (test-only changes)

## RSI learning
- Misconfiguration guard (503) is distinct from auth failure (401); unit test on
  `requireApiKey` is sufficient — route-level coverage would duplicate the same guard.
- Production config validation in `config.ts` rejects weak/missing keys when enabled, but
  runtime guard still matters for lab toggles via mutable `config.auth`.
- Pattern matches cycle 0029 payment 503 envelope assertions: status + `error.code` + message.

## Gaps for cycle 0032
- **P2** — ETag on federation/nodes; docs cache policy
- **P3** — route-level apiKey 503 on a representative write route (optional; low ROI)
- **Skip** — org root `AGENTS.md` / parent workspace docs (not git-tracked)
- **Cycle 0050** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `a4d26bf` | implementation + plan close (HEAD) | yes |
