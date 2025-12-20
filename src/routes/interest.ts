import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { validateInterest } from '../validation';
import { insertInterest, listInterests, countInterests } from '../db/interest';
import { enqueueInterest } from '../queue';
import { broadcastInterest, registerInterestStream } from '../realtime/interestStream';

const interestBodySchema = {
  type: 'object',
  required: ['name', 'consentPublic'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
    organization: { type: 'string', maxLength: 120 },
    role: { type: 'string', maxLength: 80 },
    country: { type: 'string', maxLength: 80 },
    city: { type: 'string', maxLength: 80 },
    website: { type: 'string', maxLength: 200 },
    email: { type: 'string', maxLength: 120 },
    message: { type: 'string', maxLength: 500 },
    shareEmail: { type: 'boolean' },
    consentPublic: { type: 'boolean' },
    honey: { type: 'string', maxLength: 100 },
  },
};

const interestResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    created_at: { type: 'string' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: { type: 'object' },
  },
};

const listResponseSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          organization: { type: ['string', 'null'] },
          role: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          website: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          message: { type: ['string', 'null'] },
          is_demo: { type: 'boolean' },
          created_at: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
  },
};

type InterestDeps = {
  insertInterest: typeof insertInterest;
  listInterests: typeof listInterests;
  countInterests: typeof countInterests;
  enqueueInterest: typeof enqueueInterest;
  broadcastInterest: typeof broadcastInterest;
};

const defaultDeps: InterestDeps = {
  insertInterest,
  listInterests,
  countInterests,
  enqueueInterest,
  broadcastInterest,
};

export async function registerInterestRoutes(app: FastifyInstance, deps: InterestDeps = defaultDeps) {
  app.get('/api/interest', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          search: { type: 'string' },
        },
      },
      response: {
        200: listResponseSchema,
      },
    },
  }, async (request) => {
    const rawLimit = Number((request.query as { limit?: string }).limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, config.publicLimit)
      : config.publicLimit;
    const search = (request.query as { search?: string }).search?.trim();

    const [results, total] = await Promise.all([
      deps.listInterests(limit, search),
      deps.countInterests(search),
    ]);

    return { results, total };
  });

  app.post('/api/interest', {
    schema: {
      body: interestBodySchema,
      response: {
        201: interestResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const validation = validateInterest(request.body);
    if (!validation.ok) {
      reply.code(400).send({ error: 'Invalid request', details: validation.errors });
      return;
    }

    const created = await deps.insertInterest(validation.data);
    const payload = { id: created.id, created_at: created.created_at };
    deps.enqueueInterest({ ...validation.data, ...payload }).catch((error) => {
      request.log.warn({ error }, 'Failed to enqueue interest job');
    });
    deps.broadcastInterest(payload);

    reply.code(201).send(payload);
  });

  app.get('/api/interest/stream', async (request, reply) => {
    registerInterestStream(request, reply);
  });
}
