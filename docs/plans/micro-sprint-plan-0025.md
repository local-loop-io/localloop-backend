# Micro-sprint plan 0025 — Org-wide rescan (cycle 0025 mandatory)

## Status
COMPLETED

## Cycle
25

## Control repository
`localloop-backend` (confirmed — plans, conformance gate, RSI loop anchor)

## Rescan summary

| Repo | Remote | Branch | HEAD | origin/main | Sync | Dirty | Notes |
|------|--------|--------|------|-------------|------|-------|-------|
| `localloop-backend` | `local-loop-io/localloop-backend` | main | `d89be3b` | `d89be3b` | yes | 0 | Control repo; v0.4.4 |
| `loop-protocol` | `local-loop-io/loop-protocol` | main | `3dd2d05` | `3dd2d05` | yes | 0 | Canonical schemas/spec; v0.3.0 |
| `localloop-site` | `local-loop-io/localloop-site` | main | `be54166` | `be54166` | yes | 0 | Docs hub (not `localloop.github.io`); v0.4.5 |
| `org-github-profile` | `local-loop-io/.github` | main | `37a1027` | `37a1027` | yes | 0 | Org profile docs |
| `localloop-agent` | none | main | `d6c94eb` | N/A | local only | 0 | RSI evidence ledger; no remote — skipped |
| org workspace root | not git | — | — | — | — | — | `CLAUDE.md`/`AGENTS.md` — skipped per RSI |

Remote HEAD verified: `d89be3b` matches `origin/main` on control repo.

## Dependency map (refreshed)

```
loop-protocol (canonical source)
  ├── schemas, contexts, examples, openapi.json, DOMAIN-POLICY.md
  │
  ├─► localloop-backend
  │     sync:scripts/sync-schemas.ts → src/schemas/
  │     check:conformance → docs-hub mirror + openapi route parity
  │
  ├─► localloop-site
  │     public/projects/loop-protocol/ (mirrored artifacts)
  │     aggregate-docs script prefers local loop-protocol checkout
  │
  └─► org-github-profile
        references repos/domains; no schema coupling

localloop-backend (API provider)
  └─► localloop-site (consumer: config.js API base, live metrics/docs links)

Deploy order for cross-repo changes: loop-protocol → localloop-backend → localloop-site → org-github-profile
```

## Health check results

| Check | Repo | Result |
|-------|------|--------|
| `bun run check:conformance` | localloop-backend | **PASS** — schemas, docs-hub mirror (16 files), 11 openapi paths |
| `bun run test` | localloop-backend | **PASS** — 225 tests, 0 fail |
| `bun run typecheck` | localloop-backend | **PASS** |
| `npm run validate:schemas && check:schemas-readme && check:markers` | loop-protocol | **PASS** — 15 examples, 46 artifacts, 20 schemas |
| `bun run test` | localloop-site | **PASS** — 28 smoke tests |
| `bun run build` | localloop-site | **PASS** — 59 static pages |
| `scripts/check-domains.sh` | localloop-backend | **PASS** |
| `scripts/check-domains.sh` | loop-protocol | **PASS** |
| `scripts/check-domains.cjs` | localloop-site | **PASS** — 7 patterns |

Note: `npm test` in loop-protocol is intercepted by Bun's test runner in this environment; underlying npm scripts pass when invoked individually.

## Selected item
Fix stale `localloop.github.io` repo references in `org-github-profile` AGENTS.md and CLAUDE.md → `localloop-site`; align backend dev command to `bun run test`.

## Priority rationale
Rescan discovered org profile agent docs still name the retired `localloop.github.io` repo path and bare `bun test`. Actual checkout is `localloop-site`. Smallest high-value docs fix; no functional code change.

## Skipped items
- ETag/Last-Modified on federation/nodes — deferred per prior cycles
- Docs routes (`/openapi.json`, `/docs`) cache policy — undecided
- Org workspace root `CLAUDE.md`/`AGENTS.md` — not a git repo
- `localloop-agent` — no remote; local evidence ledger only
- loop-protocol audit docs with historical `localloop.github.io` path refs — audit artifacts, low priority

## Implementation
1. `org-github-profile/AGENTS.md` — repo name, domain-check path, dev commands
2. `org-github-profile/CLAUDE.md` — repo name

## Repositories
| Repo | Role |
|------|------|
| `org-github-profile` | Docs fix |
| `localloop-backend` | Plan |

## Verification
- Domain checks unchanged (docs-only)
- No code paths affected

## Deploy order
1. `org-github-profile` (docs fix)
2. `localloop-backend` (plan close)

## RSI learning
- Mandatory org rescan at cycle 0025 confirmed all health gates green; no conformance drift since cycle 0024.
- Site repo on disk is `localloop-site`, not `localloop.github.io`; stale name persists in org profile docs and parent workspace AGENTS.md (latter not git-tracked).
- `localloop-agent` exists locally with evidence ledger but has no origin remote — exclude from push/deploy loops.
- Bun intercepts `npm test` alias in loop-protocol; use explicit `npm run validate:schemas` etc. in CI/rescan scripts when Bun is default runner.

## Priorities for cycles 0026–0050

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | Continue executable regression guards for SPEC-COMPLIANCE lab boundaries | Pattern from cycles 0023–0024 |
| P2 | Refactor `interest.ts` conditional cache header to shared helper | Open since cycle 0016 |
| P3 | loop-protocol audit docs: update historical `localloop.github.io` path refs | Low urgency; rescan noted |
| P4 | Parent workspace AGENTS.md/CLAUDE.md sync | Blocked: org root not git |
| P5 | ETag on federation/nodes | Skip unless clearly required |
| P6 | Docs route cache policy (`/openapi.json`, `/docs`) | Functional decision pending |
| — | Cycle 0050 = next mandatory org rescan | Per RSI 25-cycle rule |

## Commit SHAs
| Repo | Commit | Role | Remote verified |
|------|--------|------|-----------------|
| `org-github-profile` | `3fca8a4` | implementation | TBD |
| `localloop-backend` | `fb309e8` | plan close (HEAD) | TBD |
