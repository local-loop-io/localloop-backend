import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
describe('interest cache posture', () => {
  it('declares Cache-Control no-store', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'src', 'routes', 'interest.ts'), 'utf8');
    expect(src).toContain('no-store');
  });
});
