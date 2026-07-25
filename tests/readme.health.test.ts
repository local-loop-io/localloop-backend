import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('README health docs', () => {
  it('documents redis probe and no-store posture on /health', () => {
    const readme = readFileSync(join(import.meta.dir, '..', 'README.md'), 'utf8');
    expect(readme).toContain('/health');
    expect(readme.toLowerCase()).toContain('redis');
    expect(readme).toContain('Cache-Control: no-store');
  });
});
