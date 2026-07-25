import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cities cache posture', () => {
  it('declares Cache-Control no-store on city routes', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'src', 'routes', 'cities.ts'), 'utf8');
    expect(src).toContain('setNoStore');
  });
});
