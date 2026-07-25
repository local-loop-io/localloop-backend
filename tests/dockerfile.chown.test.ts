import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Dockerfile ownership', () => {
  it('copies src as app via --chown and drops full-tree chown after src', () => {
    const df = readFileSync(join(import.meta.dir, '..', 'Dockerfile'), 'utf8');
    expect(df).toContain('COPY --chown=app:app src');
    expect(df).toContain('USER app');
    // expensive full-tree chown after src copy should be gone
    expect(df).not.toMatch(/COPY --chown=app:app src[\s\S]*RUN chown -R app:app \/app/);
  });
});
