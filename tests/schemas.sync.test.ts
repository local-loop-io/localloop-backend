import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';

// The sibling loop-protocol checkout is the canonical source these checks
// compare against. Backend-only CI (ci.yml) has no sibling, so the case is
// reported as skipped there rather than passing vacuously; the full three-way
// gate runs in protocol-parity.yml, which checks out all three repos.
const siblingPresent = existsSync(path.join(import.meta.dirname, '..', '..', 'loop-protocol', 'schemas'));

describe('schema sync (loop-protocol -> localloop-backend)', () => {
  it.skipIf(!siblingPresent)('backend schema copies match the canonical loop-protocol source', () => {
    const cwd = path.join(import.meta.dirname, '..');
    const result = Bun.spawnSync(['bun', 'run', 'scripts/sync-schemas.ts', '--check'], { cwd });
    if (result.exitCode !== 0) {
      console.error(result.stderr.toString());
    }
    expect(result.exitCode).toBe(0);
  });
});
