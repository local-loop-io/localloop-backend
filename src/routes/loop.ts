import type { FastifyInstance, FastifyReply } from 'fastify';
import { config } from '../config';
import {
  insertLoopMaterial,
  insertLoopProduct,
  insertLoopOffer,
  insertLoopMatch,
  insertLoopTransfer,
  insertLoopEvent,
  listLoopEvents,
  getLoopMaterial,
  getLoopMaterialById,
  listLoopMaterials,
  getLoopProduct,
  getLoopProductById,
  listLoopProducts,
  getLoopOffer,
  getLoopOfferById,
  listLoopOffers,
  getLoopMatch,
  getLoopMatchById,
  listLoopMatches,
  getLoopTransferById,
  listLoopTransfers,
  type LoopMaterialPayload,
  type LoopProductPayload,
  type LoopOfferPayload,
  type LoopMatchPayload,
  type LoopTransferPayload,
} from '../db/loop';
import { broadcastLoopEvent, registerLoopStream } from '../realtime/loopStream';
import { incrementMetric } from '../metrics';
import { loopSchemaIds } from '../schemas/loopSchemas';
import { requireApiKey } from '../security/apiKey';
import { loopContentType } from '../protocol';

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

const relayBodySchema = {
  type: 'object',
  required: ['event_type', 'entity_type', 'entity_id', 'payload'],
  properties: {
    event_type: { type: 'string' },
    entity_type: { type: 'string' },
    entity_id: { type: 'string' },
    payload: { type: 'object' },
    source_node: { type: 'string' },
  },
};

const relayResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    id: { type: 'number' },
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

const apiKeySecurity = [{ ApiKeyAuth: [] }];

const writeRateLimit = {
  max: config.rateLimitWriteMax,
  timeWindow: config.rateLimitWriteWindow,
};

type DbLikeError = Error & {
  code?: string;
};

type LoopMaterialStatusPayload = {
  '@context'?: string;
  '@type'?: string;
  schema_version: string;
  id: string;
  material_id: string;
  status: 'available' | 'reserved' | 'withdrawn';
  updated_at: string;
  reason?: string;
  notes?: string;
  source_node?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type LoopDeps = {
  insertLoopMaterial: typeof insertLoopMaterial;
  insertLoopProduct: typeof insertLoopProduct;
  insertLoopOffer: typeof insertLoopOffer;
  insertLoopMatch: typeof insertLoopMatch;
  insertLoopTransfer: typeof insertLoopTransfer;
  insertLoopEvent: typeof insertLoopEvent;
  listLoopEvents: typeof listLoopEvents;
  getLoopMaterial: typeof getLoopMaterial;
  getLoopMaterialById: typeof getLoopMaterialById;
  listLoopMaterials: typeof listLoopMaterials;
  getLoopProduct: typeof getLoopProduct;
  getLoopProductById: typeof getLoopProductById;
  listLoopProducts: typeof listLoopProducts;
  getLoopOffer: typeof getLoopOffer;
  getLoopOfferById: typeof getLoopOfferById;
  listLoopOffers: typeof listLoopOffers;
  getLoopMatch: typeof getLoopMatch;
  getLoopMatchById: typeof getLoopMatchById;
  listLoopMatches: typeof listLoopMatches;
  getLoopTransferById: typeof getLoopTransferById;
  listLoopTransfers: typeof listLoopTransfers;
  broadcastLoopEvent: typeof broadcastLoopEvent;
};

const defaultDeps: LoopDeps = {
  insertLoopMaterial,
  insertLoopProduct,
  insertLoopOffer,
  insertLoopMatch,
  insertLoopTransfer,
  insertLoopEvent,
  listLoopEvents,
  getLoopMaterial,
  getLoopMaterialById,
  listLoopMaterials,
  getLoopProduct,
  getLoopProductById,
  listLoopProducts,
  getLoopOffer,
  getLoopOfferById,
  listLoopOffers,
  getLoopMatch,
  getLoopMatchById,
  listLoopMatches,
  getLoopTransferById,
  listLoopTransfers,
  broadcastLoopEvent,
};

function sendWriteConflict(error: unknown, reply: FastifyReply) {
  const pgError = error as DbLikeError;
  if (pgError?.code === '23505') {
    reply.code(409).send({ error: 'Resource already exists' });
    return true;
  }
  if (pgError?.code === '23503') {
    reply.code(409).send({ error: 'Related resource was not found' });
    return true;
  }
  return false;
}

export async function registerLoopRoutes(app: FastifyInstance, deps: LoopDeps = defaultDeps) {
  app.post('/api/v1/material', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.material}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMaterialPayload;
    let created;
    try {
      created = await deps.insertLoopMaterial(payload);
    } catch (error) {
      if (sendWriteConflict(error, reply)) {
        return;
      }
      throw error;
    }

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

  app.post('/api/v1/product', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.product}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopProductPayload;
    let created;
    try {
      created = await deps.insertLoopProduct(payload);
    } catch (error) {
      if (sendWriteConflict(error, reply)) {
        return;
      }
      throw error;
    }

    const eventPayload = {
      type: 'product.created',
      entity: 'product',
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
    incrementMetric('loop_product_created');
    incrementMetric('loop_event_emitted');
    request.log.info({ productId: created.id }, 'Loop product created');

    reply.code(201).send(created);
  });

  app.post('/api/v1/offer', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.offer}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopOfferPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        reply.code(400).send({ error: 'Unknown material_id' });
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        reply.code(400).send({ error: 'Unknown product_id' });
        return;
      }
    }

    let created;
    try {
      created = await deps.insertLoopOffer(payload);
    } catch (error) {
      if (sendWriteConflict(error, reply)) {
        return;
      }
      throw error;
    }
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
    request.log.info({ offerId: created.id, materialId: payload.material_id, productId: payload.product_id }, 'Loop offer created');

    reply.code(201).send(created);
  });

  app.post('/api/v1/match', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.match}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMatchPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        reply.code(400).send({ error: 'Unknown material_id' });
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        reply.code(400).send({ error: 'Unknown product_id' });
        return;
      }
    }
    const offer = await deps.getLoopOffer(payload.offer_id);
    if (!offer) {
      reply.code(400).send({ error: 'Unknown offer_id' });
      return;
    }
    const subjectId = payload.material_id || payload.product_id;
    const offerSubjectId = offer.material_id || offer.product_id;
    if (subjectId && offerSubjectId && offerSubjectId !== subjectId) {
      reply.code(400).send({ error: 'Offer does not match subject' });
      return;
    }

    let created;
    try {
      created = await deps.insertLoopMatch(payload);
    } catch (error) {
      if (sendWriteConflict(error, reply)) {
        return;
      }
      throw error;
    }
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

  app.post('/api/v1/transfer', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.transfer}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema, 409: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopTransferPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        reply.code(400).send({ error: 'Unknown material_id' });
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        reply.code(400).send({ error: 'Unknown product_id' });
        return;
      }
    }
    const match = await deps.getLoopMatch(payload.match_id);
    if (!match) {
      reply.code(400).send({ error: 'Unknown match_id' });
      return;
    }
    const subjectId = payload.material_id || payload.product_id;
    const matchSubjectId = match.material_id || match.product_id;
    if (subjectId && matchSubjectId && matchSubjectId !== subjectId) {
      reply.code(400).send({ error: 'Match does not match subject' });
      return;
    }

    let created;
    try {
      created = await deps.insertLoopTransfer(payload);
    } catch (error) {
      if (sendWriteConflict(error, reply)) {
        return;
      }
      throw error;
    }
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

  app.post('/api/v1/material-status', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.materialStatus}#` },
      response: { 201: createResponseSchema, 400: errorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMaterialStatusPayload;
    const material = await deps.getLoopMaterial(payload.material_id);
    if (!material) {
      reply.code(400).send({ error: 'Unknown material_id' });
      return;
    }

    const eventPayload = {
      type: 'material.status_updated',
      entity: 'material',
      entity_id: payload.material_id,
      data: payload,
    };

    const created = await deps.insertLoopEvent({
      event_type: eventPayload.type,
      entity_type: eventPayload.entity,
      entity_id: eventPayload.entity_id,
      payload: eventPayload,
    });

    deps.broadcastLoopEvent({
      ...eventPayload,
      created_at: created.created_at,
    });
    incrementMetric('loop_material_status_updated');
    incrementMetric('loop_event_emitted');
    request.log.info({ materialId: payload.material_id, status: payload.status }, 'Loop material status updated');

    reply.code(201).send({ id: payload.id, created_at: created.created_at });
  });

  app.get('/api/v1/events', {
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

  app.get('/api/v1/stream', async (request, reply) => {
    registerLoopStream(request, reply);
  });

  const listQuerySchema = {
    type: 'object',
    properties: {
      limit: { type: 'number' },
      category: { type: 'string' },
      status: { type: 'string' },
    },
  };

  const entityResponseSchema = { type: 'object', additionalProperties: true };
  const entityListResponseSchema = { type: 'array', items: { type: 'object', additionalProperties: true } };

  app.get('/api/v1/material/:id', {
    schema: { response: { 200: entityResponseSchema, 404: errorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopMaterialById(id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return result;
  });

  app.get('/api/v1/material', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; category?: string };
    return deps.listLoopMaterials({ limit: q.limit, category: q.category });
  });

  app.get('/api/v1/product/:id', {
    schema: { response: { 200: entityResponseSchema, 404: errorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopProductById(id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return result;
  });

  app.get('/api/v1/product', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; category?: string };
    return deps.listLoopProducts({ limit: q.limit, category: q.category });
  });

  app.get('/api/v1/offer/:id', {
    schema: { response: { 200: entityResponseSchema, 404: errorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopOfferById(id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return result;
  });

  app.get('/api/v1/offer', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; status?: string };
    return deps.listLoopOffers({ limit: q.limit, status: q.status });
  });

  app.get('/api/v1/match/:id', {
    schema: { response: { 200: entityResponseSchema, 404: errorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopMatchById(id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return result;
  });

  app.get('/api/v1/match', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number };
    return deps.listLoopMatches({ limit: q.limit });
  });

  app.get('/api/v1/transfer/:id', {
    schema: { response: { 200: entityResponseSchema, 404: errorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopTransferById(id);
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return result;
  });

  app.get('/api/v1/transfer', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number };
    return deps.listLoopTransfers({ limit: q.limit });
  });

  app.post('/api/v1/relay', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: relayBodySchema,
      response: {
        202: relayResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as {
      event_type: string;
      entity_type: string;
      entity_id: string;
      payload: Record<string, unknown>;
      source_node?: string;
    };

    const eventPayload = {
      ...payload.payload,
      source_node: payload.source_node ?? 'remote',
      relayed_at: new Date().toISOString(),
    };

    const created = await deps.insertLoopEvent({
      event_type: payload.event_type,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      payload: eventPayload,
    });

    deps.broadcastLoopEvent({
      type: payload.event_type,
      entity: payload.entity_type,
      entity_id: payload.entity_id,
      data: payload.payload,
      source_node: payload.source_node ?? 'remote',
      relayed_at: eventPayload.relayed_at,
      created_at: created.created_at,
    });
    incrementMetric('loop_event_relayed');

    reply.code(202).send({ status: 'accepted', id: created.id });
  });
}
