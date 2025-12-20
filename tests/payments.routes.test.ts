import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerPaymentRoutes } from '../src/routes/payments';

const buildApp = (enabled: boolean) => {
  const app = Fastify({ logger: false });
  const calls: {
    intent?: {
      name: string;
      amountCents: number;
      currency: string;
    };
    webhook?: {
      provider?: string;
      payload: Record<string, unknown>;
    };
  } = {};

  const deps = {
    insertPaymentIntent: async (input: {
      name: string;
      amountCents: number;
      currency: string;
    }) => {
      calls.intent = input;
      return { id: 99, status: 'received', created_at: new Date().toISOString() };
    },
    insertPaymentWebhook: async (input: { provider?: string; payload: Record<string, unknown> }) => {
      calls.webhook = input;
      return { id: 12, created_at: new Date().toISOString() };
    },
  };

  return { app, deps, calls, enabled };
};

describe('payment routes', () => {
  it('blocks intent when payments are disabled', async () => {
    const { app, deps, enabled } = buildApp(false);
    await registerPaymentRoutes(app, deps, enabled);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/intent',
      payload: { name: 'Ada', amount: 50, currency: 'USD' },
    });

    expect(response.statusCode).toBe(503);
  });

  it('accepts valid payment intent when enabled', async () => {
    const { app, deps, calls, enabled } = buildApp(true);
    await registerPaymentRoutes(app, deps, enabled);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/intent',
      payload: { name: 'Ada', amount: 42.5, currency: 'usd' },
    });

    expect(response.statusCode).toBe(201);
    expect(calls.intent?.amountCents).toBe(4250);
    expect(calls.intent?.currency).toBe('USD');
  });

  it('rejects invalid payment intent', async () => {
    const { app, deps, enabled } = buildApp(true);
    await registerPaymentRoutes(app, deps, enabled);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/intent',
      payload: { name: 'A', currency: 'USD' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('accepts webhook payload when enabled', async () => {
    const { app, deps, calls, enabled } = buildApp(true);
    await registerPaymentRoutes(app, deps, enabled);

    const response = await app.inject({
      method: 'POST',
      url: '/api/payments/webhook?provider=test',
      payload: { event: 'payment.test' },
    });

    expect(response.statusCode).toBe(202);
    expect(calls.webhook?.provider).toBe('test');
  });
});
