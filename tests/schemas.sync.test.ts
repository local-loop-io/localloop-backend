import { describe, expect, it } from 'bun:test';
import path from 'node:path';

describe('schema sync (loop-protocol -> localloop-backend)', () => {
  it('backend schema copies match the canonical loop-protocol source', () => {
    const cwd = path.join(import.meta.dirname, '..');
    const result = Bun.spawnSync(['bun', 'run', 'scripts/sync-schemas.ts', '--check'], { cwd });
    if (result.exitCode !== 0) {
      console.error(result.stderr.toString());
    }
    expect(result.exitCode).toBe(0);
  });
});
