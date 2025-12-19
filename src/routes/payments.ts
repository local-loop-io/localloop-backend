import type { FastifyInstance } from 'fastify';

export async function registerPaymentRoutes(app: FastifyInstance) {
  app.post('/api/payments/intent', {
    schema: {
      response: {
        501: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    reply.code(501).send({ error: 'Payments are not enabled yet.' });
  });

  app.post('/api/payments/webhook', {
    schema: {
      response: {
        501: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    reply.code(501).send({ error: 'Payments are not enabled yet.' });
  });
}
