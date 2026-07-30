# Contributing to localLOOP Backend

Thanks for your interest in contributing! This backend is intentionally small and focused.

## Ground Rules
- Create a feature branch for your work.
- Open a pull request against `main`.
- All changes must include tests.

## Development Setup
```bash
bun install
bun run test
bun run dev
```

## Testing

Run the full suite with:

```bash
bun run test
```

This invokes `bun test --isolate` (see `package.json`). Per-file isolation
is required because Bun's default runner shares module state across test
files.

### Route deps injection (preferred)

For route-level tests that need to stub DB or side-effect calls, pass an
optional deps object to the route registrar instead of using `mock.module`.
Production defaults are unchanged when deps are omitted.

```typescript
const deps = {
  getLoopEvidenceByEventId: async (eventId: string) =>
    (eventId === sampleEntry.event_id ? sampleEntry : undefined),
  listLoopEvidence: async () => listResult,
};
await registerEvidenceRoutes(app, deps);
```

See `tests/evidence.cache.headers.test.ts` and
`tests/transactions.cache.headers.test.ts` for the canonical pattern.
All cache-header route tests use deps injection; the test suite has no
`mock.module` registrations (audited cycle 0034).

### `mock.module` (avoid)

Do not add new `mock.module` stubs for route tests — they leak across test
files even with `afterAll` restore when another file imports the same module
before restore runs. Prefer route deps injection above.

If you must mock a non-route module, register at file scope and restore in
`afterAll`, and rely on `bun test --isolate` (see `package.json`). Document
why deps injection is not viable.

### Metrics assertions

In-memory metrics counters (`src/metrics.ts`) are process-global. Do not
assert hardcoded zero values — other tests may have incremented counters
first. Capture a baseline with `getMetricsSnapshot()` and compare deltas:

```typescript
const baseline = getMetricsSnapshot();
// ... exercise route ...
expect(payload.metrics.loop_material_created).toBe(
  baseline.metrics.loop_material_created,
);
```

See `tests/utility.routes.test.ts`.

## Pull Request Checklist
- [ ] Tests added/updated
- [ ] Documentation updated if behavior changes
- [ ] No secrets committed

## Contact
Questions? Email dev@mycel-ai.de or open a GitHub Discussion.
