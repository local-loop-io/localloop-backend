import { describe, expect, it } from 'bun:test';

describe('reverse-proxy trust', () => {
  it('trusts exactly one X-Forwarded-For hop so clients cannot pick their own request.ip', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });
    app.get('/__ip', async (request) => ({ ip: request.ip }));

    try {
      // Traefik (the single trusted hop) appends the real peer 198.51.100.7;
      // 203.0.113.9 is a value the client injected itself. With trustProxy:
      // true the client value would win and per-IP rate limits could be
      // sidestepped by rotating that header.
      const response = await app.inject({
        method: 'GET',
        url: '/__ip',
        remoteAddress: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().ip).toBe('198.51.100.7');
    } finally {
      await app.close();
    }
  });
});
