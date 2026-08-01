# Micro-sprint plan 0054 — Payments lab boundary

## Status
COMPLETED

## Cycle
54

## Control repository
`localloop-backend`

## Observation
- Remote HEAD verified: `00ac792` matches `origin/main`
- Cycle 0053 closed signal governance lab boundary; 254 tests pass
- SPEC-COMPLIANCE mentions `/api/payments/*` only as a one-line row under
  LoopCoin settlement; no dedicated subsection or executable guard (unlike
  signal governance pattern from cycle 0053)
- `POST /api/payments/intent` and `POST /api/payments/webhook` persist intake
  rows via `insertPaymentIntent` / `insertPaymentWebhook` (`src/routes/payments.ts`);
  no Stripe SDK, charge execution, or webhook signature verification

## Selected item
Document payments lab boundary in `docs/SPEC-COMPLIANCE.md` and add route-level
regression guards asserting intake-only payment behavior.

## Priority rationale
First P1 gap from cycle 0053; testable behavior (intent/webhook persist rows,
hypothetical charge routes 404) matches the docs+tests pattern established
for LoopCoin settlement and signal governance lab boundaries.

## Implementation
1. `docs/SPEC-COMPLIANCE.md` — add Payments lab boundary subsection with
   surface matrix; cross-reference from intentional lab boundaries list;
   remove one-line payments row from LoopCoin settlement table
2. `tests/payments.routes.test.ts` — describe block with three boundary tests

## Repositories
| Repo | Role |
|------|------|
| `localloop-backend` | Docs + tests + plan |

## Verification
- `bun test tests/payments.routes.test.ts` — pass (8 tests)
- `bun run test` — full suite pass (260 tests)
- `bun run typecheck` — pass
- `bun run check:conformance` — pass

## Deploy order
1. `localloop-backend` only (docs + test changes)

## RSI learning
- Payments boundary spans four surfaces (intent intake, webhook intake,
  missing Stripe charge routes, no signature verification) — document each
  separately like signal governance to avoid implying PSP settlement runs
  when only DB persistence exists.
- Spy-on-deps insert-count tests complement buildServer 404 guards for
  hypothetical charge/refund routes without requiring Postgres or Stripe.

## Gaps for cycle 0055
- **P1** — Evidence lab boundary (append-only log; read-only HTTP; no redaction/export engine)
- **P2** — Federation registry lab boundary (node registry read-only semantics)
- **P3** — Docs route cache policy (`/openapi.json`, `/docs`)
- **P2** — ETag on `GET /api/v1/federation/nodes` (skip unless clear win)
- **Skip** — org root docs (not git-tracked); interest.ts cache refactor (done)
- **Cycle 0075** = next mandatory org rescan

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `localloop-backend` | `154f8ea` | implementation | yes |
| `localloop-backend` | `6dc7e34` | plan close | yes |
| `localloop-backend` | (pending) | SHA record (HEAD) | pending |

## Tag
`micro-sprint-0054` on plan-close commit (HEAD).
