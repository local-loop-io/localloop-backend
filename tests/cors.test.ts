import { afterEach, describe, expect, it } from 'bun:test';

const originalOrigins = process.env.ALLOWED_ORIGINS;

const resetEnv = () => {
  if (originalOrigins === undefined) {
    delete process.env.ALLOWED_ORIGINS;
    return;
  }
  process.env.ALLOWED_ORIGINS = originalOrigins;
};

describe('cors headers', () => {
  afterEach(() => {
    resetEnv();
  });

  it('includes x-api-key in allowed headers for preflight', async () => {
    process.env.ALLOWED_ORIGINS = 'https://localloop.urbnia.com';
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/interest',
        headers: {
          origin: 'https://localloop.urbnia.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'x-api-key,content-type',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowHeaders = response.headers['access-control-allow-headers'] || '';
      expect(allowHeaders.toLowerCase()).toContain('x-api-key');
    } finally {
      await app.close();
    }
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('CORS allowed headers', () => {
  it('allows Idempotency-Key for browser write retries', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'src', 'server.ts'), 'utf8');
    expect(src).toContain("'Idempotency-Key'");
  });
});

