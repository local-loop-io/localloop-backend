import { describe, expect, it } from 'bun:test';
import path from 'node:path';

describe('spec conformance gate (backend <-> loop-protocol <-> docs hub)', () => {
  it('passes with no drift and a fully implemented spec route surface', () => {
    const cwd = path.join(import.meta.dirname, '..');
    const result = Bun.spawnSync(['bun', 'run', 'scripts/check-conformance.ts'], { cwd });
    if (result.exitCode !== 0) {
      console.error(result.stdout.toString());
      console.error(result.stderr.toString());
    }
    expect(result.exitCode).toBe(0);
  });
});
