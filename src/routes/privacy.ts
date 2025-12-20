import type { FastifyInstance } from 'fastify';

const privacyPayload = {
  scope: 'Lab demo only',
  dataMinimization: [
    'Protocol payloads must avoid personal data (names, emails, phone numbers).',
    'Only organization identifiers and city names are permitted in demo payloads.',
    'Interest submissions are optional and explicitly consent-based.',
  ],
  retention: 'Lab demo data is retained only for validation and removed on request.',
  contact: 'alphinctom@gmail.com',
};

export async function registerPrivacyRoutes(app: FastifyInstance) {
  app.get('/api/privacy', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            scope: { type: 'string' },
            dataMinimization: { type: 'array', items: { type: 'string' } },
            retention: { type: 'string' },
            contact: { type: 'string' },
          },
        },
      },
    },
  }, async () => privacyPayload);
}
