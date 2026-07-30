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

### `mock.module` tests

When stubbing a module with `mock.module`, register the mock at file scope
and restore the real module in `afterAll`:

```typescript
const realModule = await import('../src/db/evidence');

mock.module('../src/db/evidence', () => ({ /* stubs */ }));

afterAll(() => {
  mock.module('../src/db/evidence', () => realModule);
});
```

See `tests/evidence.cache.headers.test.ts` for the canonical pattern.
`afterAll` restore alone is not enough without `--isolate`; another file
that imports the same module would still see the mock.

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
