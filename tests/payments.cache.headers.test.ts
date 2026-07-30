import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerPaymentRoutes } from '../src/routes/payments';

const buildApp = async () => {
  const app = Fastify({ logger: false });

  const deps = {
    insertPaymentIntent: async () => ({
      id: 99,
      status: 'received',
      created_at: new Date().toISOString(),
    }),
    insertPaymentWebhook: async () => ({
      id: 12,
      created_at: new Date().toISOString(),
    }),
  };

  await registerPaymentRoutes(app, deps, true);
  return app;
};

describe('payment routes Cache-Control', () => {
  it.each([
    [
      'POST',
      '/api/payments/intent',
      { name: 'Ada', amount: 42.5, currency: 'usd' },
      201,
    ],
    [
      'POST',
      '/api/payments/webhook?provider=test',
      { event: 'payment.test' },
      202,
    ],
  ] as const)('returns no-store on %s %s', async (method, url, payload, expectedStatus) => {
    const app = await buildApp();
    const response = await app.inject({ method, url, payload });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
