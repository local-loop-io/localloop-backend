import type { FastifyInstance } from 'fastify';
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
            metrics: { type: 'object' },
          },
        },
      },
    },
  }, async () => getMetricsSnapshot());
}
