import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { insertPaymentIntent, insertPaymentWebhook } from '../db/payments';
import { validatePaymentIntent } from '../validation';

const intentBodySchema = {
  type: 'object',
  required: ['name', 'amount', 'currency'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
    organization: { type: 'string', maxLength: 120 },
    email: { type: 'string', maxLength: 120 },
    amount: { type: 'number', minimum: 0.01 },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    note: { type: 'string', maxLength: 280 },
    metadata: { type: 'object' },
  },
};

const intentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    status: { type: 'string' },
    created_at: { type: 'string' },
  },
};

type PaymentDeps = {
  insertPaymentIntent: typeof insertPaymentIntent;
  insertPaymentWebhook: typeof insertPaymentWebhook;
};

const defaultDeps: PaymentDeps = {
  insertPaymentIntent,
  insertPaymentWebhook,
};

export async function registerPaymentRoutes(
  app: FastifyInstance,
  deps: PaymentDeps = defaultDeps,
  enabled = config.paymentsEnabled
) {
  app.post('/api/payments/intent', {
    schema: {
      body: intentBodySchema,
      response: {
        201: intentResponseSchema,
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!enabled) {
      reply.code(503).send({ error: 'Payments are disabled' });
      return;
    }

    const validation = validatePaymentIntent(request.body);
    if (!validation.ok) {
      reply.code(400).send({ error: 'Invalid request', details: validation.errors });
      return;
    }

    const amountCents = Math.round(validation.data.amount * 100);
    const created = await deps.insertPaymentIntent({
      name: validation.data.name,
      organization: validation.data.organization ?? null,
      email: validation.data.email ?? null,
      amountCents,
      currency: validation.data.currency,
      note: validation.data.note ?? null,
      metadata: validation.data.metadata ?? null,
    });

    reply.code(201).send(created);
  });

  app.post('/api/payments/webhook', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
        },
      },
      response: {
        202: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!enabled) {
      reply.code(503).send({ error: 'Payments are disabled' });
      return;
    }

    const { provider } = request.query as { provider?: string };
    const payload = (request.body && typeof request.body === 'object')
      ? request.body as Record<string, unknown>
      : { raw: request.body };

    await deps.insertPaymentWebhook({
      provider,
      payload,
    });

    reply.code(202).send({ status: 'received' });
  });
}
