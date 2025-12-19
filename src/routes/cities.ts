import type { FastifyInstance } from 'fastify';
import { getCity, listCities } from '../db/cities';

const citySchema = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    name: { type: 'string' },
    country: { type: ['string', 'null'] },
    center: { type: ['object', 'null'] },
    created_at: { type: 'string' },
  },
};

export async function registerCityRoutes(app: FastifyInstance) {
  app.get('/api/cities', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            results: { type: 'array', items: citySchema },
          },
        },
      },
    },
  }, async () => {
    const results = await listCities();
    return { results };
  });

  app.get('/api/cities/:slug', {
    schema: {
      response: {
        200: citySchema,
        404: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const city = await getCity(slug);
    if (!city) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    return city;
  });
}
