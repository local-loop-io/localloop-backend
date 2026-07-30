import type { FastifyInstance } from 'fastify';
import { setNoStore } from '../httpCache';
import { getMetricsSnapshot } from '../metrics';

export async function registerMetricsRoutes(app: FastifyInstance) {
  app.get('/api/metrics', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            startedAt: { type: 'string' },
            uptimeSeconds: { type: 'number' },
            metrics: { type: 'object', additionalProperties: { type: 'number' } },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    setNoStore(reply);
    return getMetricsSnapshot();
  });
}

