import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
describe('federation cache', () => {
  it('uses setNoStore', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'src', 'routes', 'federation.ts'), 'utf8');
    expect(src).toContain('setNoStore');
  });
});
