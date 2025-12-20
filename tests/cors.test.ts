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
    process.env.ALLOWED_ORIGINS = 'https://local-loop-io.github.io';
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/interest',
        headers: {
          origin: 'https://local-loop-io.github.io',
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
