import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
describe('signals cache', () => {
  it('uses setPublicShortCache', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'src', 'routes', 'signals.ts'), 'utf8');
    expect(src).toContain('setPublicShortCache');
  });
});
