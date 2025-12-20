import type { FastifyInstance } from 'fastify';
import {
  insertLoopMaterial,
  insertLoopOffer,
  insertLoopMatch,
  insertLoopTransfer,
  insertLoopEvent,
  listLoopEvents,
  getLoopMaterial,
  getLoopOffer,
  getLoopMatch,
  type LoopMaterialPayload,
  type LoopOfferPayload,
  type LoopMatchPayload,
  type LoopTransferPayload,
} from '../db/loop';
import { broadcastLoopEvent, registerLoopStream } from '../realtime/loopStream';
import { incrementMetric } from '../metrics';
import { loopSchemaIds } from '../schemas/loopSchemas';

const createResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    created_at: { type: 'string' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

const listEventsSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          event_type: { type: 'string' },
          entity_type: { type: 'string' },
          entity_id: { type: 'string' },
          payload: { type: 'object' },
          created_at: { type: 'string' },
        },
      },
    },
  },
};

type LoopDeps = {
  insertLoopMaterial: typeof insertLoopMaterial;
  insertLoopOffer: typeof insertLoopOffer;
  insertLoopMatch: typeof insertLoopMatch;
  insertLoopTransfer: typeof insertLoopTransfer;
  insertLoopEvent: typeof insertLoopEvent;
  listLoopEvents: typeof listLoopEvents;
  getLoopMaterial: typeof getLoopMaterial;
  getLoopOffer: typeof getLoopOffer;
  getLoopMatch: typeof getLoopMatch;
  broadcastLoopEvent: typeof broadcastLoopEvent;
};

const defaultDeps: LoopDeps = {
  insertLoopMaterial,
  insertLoopOffer,
  insertLoopMatch,
  insertLoopTransfer,
  insertLoopEvent,
  listLoopEvents,
  getLoopMaterial,
  getLoopOffer,
  getLoopMatch,
  broadcastLoopEvent,
};

export async function registerLoopRoutes(app: FastifyInstance, deps: LoopDeps = defaultDeps) {
  app.post('/api/loop/materials', {
    schema: {
      body: { $ref: `${loopSchemaIds.material}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema },
    },
  }, async (request, reply) => {
    const payload = request.body as LoopMaterialPayload;
    const created = await deps.insertLoopMaterial(payload);

    const eventPayload = {
      type: 'material.created',
      entity: 'material',
      entity_id: created.id,
      data: payload,
      created_at: created.created_at,
    };
    await deps.insertLoopEvent({
      event_type: eventPayload.type,
      entity_type: eventPayload.entity,
      entity_id: eventPayload.entity_id,
      payload: eventPayload,
    });
    deps.broadcastLoopEvent(eventPayload);
    incrementMetric('loop_material_created');
    incrementMetric('loop_event_emitted');
    request.log.info({ materialId: created.id }, 'Loop material created');

    reply.code(201).send(created);
  });

  app.post('/api/loop/offers', {
    schema: {
      body: { $ref: `${loopSchemaIds.offer}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema },
    },
  }, async (request, reply) => {
    const payload = request.body as LoopOfferPayload;
    const material = await deps.getLoopMaterial(payload.material_id);
    if (!material) {
      reply.code(400).send({ error: 'Unknown material_id' });
      return;
    }

    const created = await deps.insertLoopOffer(payload);
    const eventPayload = {
      type: 'offer.created',
      entity: 'offer',
      entity_id: created.id,
      data: payload,
      created_at: created.created_at,
    };
    await deps.insertLoopEvent({
      event_type: eventPayload.type,
      entity_type: eventPayload.entity,
      entity_id: eventPayload.entity_id,
      payload: eventPayload,
    });
    deps.broadcastLoopEvent(eventPayload);
    incrementMetric('loop_offer_created');
    incrementMetric('loop_event_emitted');
    request.log.info({ offerId: created.id, materialId: payload.material_id }, 'Loop offer created');

    reply.code(201).send(created);
  });

  app.post('/api/loop/matches', {
    schema: {
      body: { $ref: `${loopSchemaIds.match}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema },
    },
  }, async (request, reply) => {
    const payload = request.body as LoopMatchPayload;
    const material = await deps.getLoopMaterial(payload.material_id);
    if (!material) {
      reply.code(400).send({ error: 'Unknown material_id' });
      return;
    }
    const offer = await deps.getLoopOffer(payload.offer_id);
    if (!offer) {
      reply.code(400).send({ error: 'Unknown offer_id' });
      return;
    }
    if (offer.material_id !== payload.material_id) {
      reply.code(400).send({ error: 'Offer does not match material_id' });
      return;
    }

    const created = await deps.insertLoopMatch(payload);
    const eventPayload = {
      type: 'match.created',
      entity: 'match',
      entity_id: created.id,
      data: payload,
      created_at: created.created_at,
    };
    await deps.insertLoopEvent({
      event_type: eventPayload.type,
      entity_type: eventPayload.entity,
      entity_id: eventPayload.entity_id,
      payload: eventPayload,
    });
    deps.broadcastLoopEvent(eventPayload);
    incrementMetric('loop_match_created');
    incrementMetric('loop_event_emitted');
    request.log.info({ matchId: created.id, offerId: payload.offer_id }, 'Loop match created');

    reply.code(201).send(created);
  });

  app.post('/api/loop/transfers', {
    schema: {
      body: { $ref: `${loopSchemaIds.transfer}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema },
    },
  }, async (request, reply) => {
    const payload = request.body as LoopTransferPayload;
    const material = await deps.getLoopMaterial(payload.material_id);
    if (!material) {
      reply.code(400).send({ error: 'Unknown material_id' });
      return;
    }
    const match = await deps.getLoopMatch(payload.match_id);
    if (!match) {
      reply.code(400).send({ error: 'Unknown match_id' });
      return;
    }
    if (match.material_id !== payload.material_id) {
      reply.code(400).send({ error: 'Match does not match material_id' });
      return;
    }

    const created = await deps.insertLoopTransfer(payload);
    const eventPayload = {
      type: 'transfer.created',
      entity: 'transfer',
      entity_id: created.id,
      data: payload,
      created_at: created.created_at,
    };
    await deps.insertLoopEvent({
      event_type: eventPayload.type,
      entity_type: eventPayload.entity,
      entity_id: eventPayload.entity_id,
      payload: eventPayload,
    });
    deps.broadcastLoopEvent(eventPayload);
    incrementMetric('loop_transfer_created');
    incrementMetric('loop_event_emitted');
    request.log.info({ transferId: created.id, matchId: payload.match_id }, 'Loop transfer created');

    reply.code(201).send(created);
  });

  app.get('/api/loop/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
      response: {
        200: listEventsSchema,
      },
    },
  }, async (request) => {
    const rawLimit = Number((request.query as { limit?: string }).limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const results = await deps.listLoopEvents(limit);
    return { results };
  });

  app.get('/api/loop/stream', async (request, reply) => {
    registerLoopStream(request, reply);
  });
}
