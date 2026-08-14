import { afterEach, describe, expect, it } from 'bun:test';

const originalOrigins = process.env.ALLOWED_ORIGINS;
const ALLOWED_ORIGIN = 'https://localloop.urbnia.com';

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
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/interest',
        headers: {
          origin: ALLOWED_ORIGIN,
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

  it('includes idempotency-key in allowed headers for preflight (browser write retries)', async () => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/interest',
        headers: {
          origin: ALLOWED_ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'idempotency-key,content-type',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowHeaders = response.headers['access-control-allow-headers'] || '';
      expect(allowHeaders.toLowerCase()).toContain('idempotency-key');
    } finally {
      await app.close();
    }
  });

  it('reflects an allowed origin in Access-Control-Allow-Origin', async () => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: ALLOWED_ORIGIN },
      });

      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    } finally {
      await app.close();
    }
  });

  it('does not reflect a disallowed origin in Access-Control-Allow-Origin', async () => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'https://evil.example.com' },
      });

      // credentials: true means the server must never fall back to a
      // wildcard or otherwise reflect an origin it doesn't recognize.
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('does not reflect a disallowed origin on a preflight request either', async () => {
    process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/interest',
        headers: {
          origin: 'https://evil.example.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
