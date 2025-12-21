import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { auth } from '../auth';

export async function registerAuthStatusRoutes(app: FastifyInstance) {
  app.get('/api/auth/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            active: { type: 'boolean' },
            provider: { type: 'string' },
            methods: { type: 'array', items: { type: 'string' } },
            apiKeyEnabled: { type: 'boolean' },
          },
        },
      },
    },
  }, async () => {
    const active = Boolean(auth);
    return {
      enabled: config.auth.enabled,
      active,
      provider: active ? 'better-auth' : 'disabled',
      methods: active ? ['email+password'] : [],
      apiKeyEnabled: config.auth.apiKeyEnabled,
    };
  });
}
