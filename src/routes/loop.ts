import { setNoStore } from '../httpCache';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import {
  createLoopMaterial,
  createLoopProduct,
  createLoopOffer,
  createLoopMatch,
  createLoopTransfer,
  insertLoopEvent,
  listLoopEvents,
  clampListLimit,
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
  searchLoopMaterials,
  searchLoopProducts,
  searchLoopMaterialsProtocol,
  LoopStateError,
  type LoopMaterialPayload,
  type LoopProductPayload,
  type LoopOfferPayload,
  type LoopMatchPayload,
  type LoopTransferPayload,
  type LoopSearchFilters,
  type LoopSearchResult,
  type ProtocolMaterialSearchFilters,
} from '../db/loop';
import { insertLoopEvidence } from '../db/evidence';
import { broadcastLoopEvent, registerLoopStream } from '../realtime/loopStream';
import { incrementMetric } from '../metrics';
import { loopSchemaIds } from '../schemas/loopSchemas';
import { requireApiKey } from '../security/apiKey';
import { loopContentType } from '../protocol';
import { CoreDpError, sendCoreDpError, toCoreDpError } from '../errors';
import { sendSpecError, specErrorResponseSchema } from '../specErrors';
import { withIdempotency } from '../idempotency';

const createResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    created_at: { type: 'string' },
  },
};

// Write-route 409s can carry either the §8.3 envelope (duplicate ids via
// sendPgWriteError, reserved offers / already-transferred matches via
// sendStateError) or the Core-DP error body (Idempotency-Key conflicts via
// withIdempotency), so that status cannot use a strict single-envelope schema.
const mixedWriteErrorResponseSchema = { type: 'object', additionalProperties: true };

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
          // additionalProperties required — fast-json-stringify otherwise
          // serializes payload as `{}` and the event log loses its contents.
          payload: { type: 'object', additionalProperties: true },
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

const allowedRelayEvents: Record<string, readonly string[]> = {
  material: ['material.created', 'material.status_updated'],
  product: ['product.created'],
  offer: ['offer.created'],
  match: ['match.created'],
  transfer: ['transfer.created'],
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
  createLoopMaterial: typeof createLoopMaterial;
  createLoopProduct: typeof createLoopProduct;
  createLoopOffer: typeof createLoopOffer;
  createLoopMatch: typeof createLoopMatch;
  createLoopTransfer: typeof createLoopTransfer;
  insertLoopEvent: typeof insertLoopEvent;
  insertLoopEvidence: typeof insertLoopEvidence;
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
  searchLoopMaterials: typeof searchLoopMaterials;
  searchLoopProducts: typeof searchLoopProducts;
  searchLoopMaterialsProtocol: typeof searchLoopMaterialsProtocol;
  broadcastLoopEvent: typeof broadcastLoopEvent;
};

const defaultDeps: LoopDeps = {
  createLoopMaterial,
  createLoopProduct,
  createLoopOffer,
  createLoopMatch,
  createLoopTransfer,
  insertLoopEvent,
  insertLoopEvidence,
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
  searchLoopMaterials,
  searchLoopProducts,
  searchLoopMaterialsProtocol,
  broadcastLoopEvent,
};

/**
 * Map Postgres integrity errors raised by a write to the §8.3 envelope.
 * 23505 (unique_violation) is a genuine conflict; 23503 (foreign_key_violation)
 * means the request referenced a row that does not exist, which is a client
 * input error — the same class the routes' own pre-checks answer with 400.
 */
function sendPgWriteError(error: unknown, reply: FastifyReply) {
  const pgError = error as DbLikeError;
  if (pgError?.code === '23505') {
    sendSpecError(reply, 'CONFLICT', 'Resource already exists');
    return true;
  }
  if (pgError?.code === '23503') {
    sendSpecError(reply, 'INVALID_REQUEST', 'Referenced resource does not exist');
    return true;
  }
  return false;
}

const STATE_ERROR_CODES = {
  not_found: 'NOT_FOUND',
  conflict: 'CONFLICT',
  invalid_state: 'INVALID_REQUEST',
} as const;

function sendStateError(error: unknown, reply: FastifyReply) {
  if (error instanceof LoopStateError) {
    sendSpecError(reply, STATE_ERROR_CODES[error.kind], error.message);
    return true;
  }
  return false;
}

function isAllowedRelayEvent(entityType: string, eventType: string) {
  if (!Object.hasOwn(allowedRelayEvents, entityType)) {
    return false;
  }

  return allowedRelayEvents[entityType]?.includes(eventType) ?? false;
}

export async function registerLoopRoutes(app: FastifyInstance, deps: LoopDeps = defaultDeps) {
  app.addHook('onRequest', async (_req, reply) => { setNoStore(reply); });

  app.post('/api/v1/material', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.material}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMaterialPayload;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('material.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopMaterial(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_material_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ materialId: created.id }, 'Loop material created');
        return { status: 201, body: { id: created.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/v1/product', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.product}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopProductPayload;
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('product.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopProduct(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_product_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ productId: created.id }, 'Loop product created');
        return { status: 201, body: { id: created.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/v1/offer', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.offer}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopOfferPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown material_id');
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown product_id');
        return;
      }
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('offer.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopOffer(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_offer_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ offerId: created.id, materialId: payload.material_id, productId: payload.product_id }, 'Loop offer created');
        return { status: 201, body: { id: created.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/v1/match', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.match}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMatchPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown material_id');
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown product_id');
        return;
      }
    }
    const offer = await deps.getLoopOffer(payload.offer_id);
    if (!offer) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Unknown offer_id');
      return;
    }
    const subjectId = payload.material_id || payload.product_id;
    const offerSubjectId = offer.material_id || offer.product_id;
    if (subjectId && offerSubjectId && offerSubjectId !== subjectId) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Offer does not belong to the given material/product');
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('match.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopMatch(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_match_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ matchId: created.id, offerId: payload.offer_id }, 'Loop match created');
        return { status: 201, body: { id: created.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/v1/transfer', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.transfer}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopTransferPayload;
    if (payload.material_id) {
      const material = await deps.getLoopMaterial(payload.material_id);
      if (!material) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown material_id');
        return;
      }
    }
    if (payload.product_id) {
      const product = await deps.getLoopProduct(payload.product_id);
      if (!product) {
        sendSpecError(reply, 'INVALID_REQUEST', 'Unknown product_id');
        return;
      }
    }
    const match = await deps.getLoopMatch(payload.match_id);
    if (!match) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Unknown match_id');
      return;
    }
    const subjectId = payload.material_id || payload.product_id;
    const matchSubjectId = match.material_id || match.product_id;
    if (subjectId && matchSubjectId && matchSubjectId !== subjectId) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Match does not belong to the given material/product');
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('transfer.create', idempotencyKey, payload, async (client) => {
        const created = await deps.createLoopTransfer(payload, client);
        deps.broadcastLoopEvent(created.event);
        incrementMetric('loop_transfer_created');
        incrementMetric('loop_event_emitted');
        request.log.info({ transferId: created.id, matchId: payload.match_id }, 'Loop transfer created');
        return { status: 201, body: { id: created.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/v1/material-status', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: `${loopSchemaIds.materialStatus}#` },
      response: { 201: createResponseSchema, 400: specErrorResponseSchema, 409: mixedWriteErrorResponseSchema },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as LoopMaterialStatusPayload;
    const material = await deps.getLoopMaterial(payload.material_id);
    if (!material) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Unknown material_id');
      return;
    }

    const eventPayload = {
      type: 'material.status_updated',
      entity: 'material',
      entity_id: payload.material_id,
      data: payload,
    };

    // Same Idempotency-Key contract and error mapping as the sibling write
    // routes: without it a retried status update appended duplicate loop_events
    // and duplicate (append-only, undeletable) loop_evidence rows.
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    let outcome: { status: 201; body: { id: string; created_at: string } };
    try {
      outcome = await withIdempotency('material.status_update', idempotencyKey, payload, async () => {
        const created = await deps.insertLoopEvent({
          event_type: eventPayload.type,
          entity_type: eventPayload.entity,
          entity_id: eventPayload.entity_id,
          payload: eventPayload,
        });

        await deps.insertLoopEvidence({
          subject: { type: 'material', id: payload.material_id },
          eventType: 'status-updated',
          data: payload,
        });

        deps.broadcastLoopEvent({
          ...eventPayload,
          created_at: created.created_at,
        });
        incrementMetric('loop_material_status_updated');
        incrementMetric('loop_event_emitted');
        request.log.info({ materialId: payload.material_id, status: payload.status }, 'Loop material status updated');
        return { status: 201, body: { id: payload.id, created_at: created.created_at } };
      }) as { status: 201; body: { id: string; created_at: string } };
    } catch (error) {
      if (error instanceof CoreDpError) {
        sendCoreDpError(reply, error);
        return;
      }
      if (sendPgWriteError(error, reply)) {
        return;
      }
      if (sendStateError(error, reply)) {
        return;
      }
      throw error;
    }

    reply.code(outcome.status).send(outcome.body);
  });

  app.get('/api/v1/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1 },
        },
      },
      response: {
        200: listEventsSchema,
      },
    },
  }, async (request) => {
    const limit = clampListLimit((request.query as { limit?: number }).limit, 50, 200);
    const results = await deps.listLoopEvents(limit);
    return { results };
  });

  app.get('/api/v1/stream', async (request, reply) => {
    registerLoopStream(request, reply);
  });

  // `limit` below 1 is rejected here (400); values above the cap are clamped by
  // the db helpers (clampListLimit) rather than rejected, so lab clients that
  // ask for "everything" keep working.
  const listQuerySchema = {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1 },
      category: { type: 'string' },
      status: { type: 'string' },
    },
  };

  const entityResponseSchema = { type: 'object', additionalProperties: true };
  const entityListResponseSchema = { type: 'array', items: { type: 'object', additionalProperties: true } };

  app.get('/api/v1/material/:id', {
    schema: { response: { 200: entityResponseSchema, 404: specErrorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await deps.getLoopMaterialById(id);
    if (!row) return sendSpecError(reply, 'NOT_FOUND', 'Not found');
    // openapi.json contracts this route as MaterialDNA over application/ld+json:
    // answer with the stored canonical document, not the internal DB row.
    reply.type(loopContentType);
    return row.payload;
  });

  app.get('/api/v1/material', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; category?: string };
    return deps.listLoopMaterials({ limit: q.limit, category: q.category });
  });

  app.get('/api/v1/product/:id', {
    schema: { response: { 200: entityResponseSchema, 404: specErrorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await deps.getLoopProductById(id);
    if (!row) return sendSpecError(reply, 'NOT_FOUND', 'Not found');
    // openapi.json contracts this route as ProductDNA over application/ld+json:
    // answer with the stored canonical document, not the internal DB row.
    reply.type(loopContentType);
    return row.payload;
  });

  app.get('/api/v1/product', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; category?: string };
    return deps.listLoopProducts({ limit: q.limit, category: q.category });
  });

  app.get('/api/v1/offer/:id', {
    schema: { response: { 200: entityResponseSchema, 404: specErrorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopOfferById(id);
    if (!result) return sendSpecError(reply, 'NOT_FOUND', 'Not found');
    return result;
  });

  app.get('/api/v1/offer', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number; status?: string };
    return deps.listLoopOffers({ limit: q.limit, status: q.status });
  });

  app.get('/api/v1/match/:id', {
    schema: { response: { 200: entityResponseSchema, 404: specErrorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopMatchById(id);
    if (!result) return sendSpecError(reply, 'NOT_FOUND', 'Not found');
    return result;
  });

  app.get('/api/v1/match', {
    schema: { querystring: listQuerySchema, response: { 200: entityListResponseSchema } },
  }, async (request) => {
    const q = request.query as { limit?: number };
    return deps.listLoopMatches({ limit: q.limit });
  });

  app.get('/api/v1/transfer/:id', {
    schema: { response: { 200: entityResponseSchema, 404: specErrorResponseSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.getLoopTransferById(id);
    if (!result) return sendSpecError(reply, 'NOT_FOUND', 'Not found');
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
        400: specErrorResponseSchema,
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

    if (!isAllowedRelayEvent(payload.entity_type, payload.event_type)) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Unsupported relay event_type for entity_type');
      return;
    }

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

  // --- Core-DP local search (MaterialDNA / ProductDNA) -----------------------
  // Request body is validated against a plain Fastify/AJV schema rather than
  // profiles/core-dp/schemas/search-contract.schema.json's compound oneOf/$defs
  // directly, since that schema mixes request and response shapes behind
  // conditionals AJV draft/version support in Fastify's default compiler isn't
  // guaranteed to handle identically; loop-protocol's own `npm run
  // validate:schemas` is the source of truth for full schema conformance, this
  // is an operational-level guard.
  const searchFiltersSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      category_prefix: { type: 'string', minLength: 1 },
      id_prefix: { type: 'string', minLength: 3 },
      origin_city: { type: 'string', minLength: 1 },
      current_city: { type: 'string', minLength: 1 },
      available_from_gte: { type: 'string' },
      available_from_lt: { type: 'string' },
      quantity_min: { type: 'number', minimum: 0 },
      condition: { type: 'string', minLength: 1 },
      updated_since: { type: 'string' },
    },
  };

  const searchRequestSchema = {
    type: 'object',
    required: ['limit'],
    additionalProperties: false,
    properties: {
      scope: { type: 'string', enum: ['local', 'cross-node'] },
      filters: searchFiltersSchema,
      auth: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['public-lab', 'bearer', 'node-signature'] },
          subject_node: { type: 'string' },
        },
      },
      strict_filtering: { type: 'boolean' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      cursor: { type: 'string', pattern: '^cur_[A-Za-z0-9_-]{16,200}$' },
      consistency: { type: 'string', enum: ['snapshot', 'eventual'] },
    },
  };

  const searchResponseSchema = { type: 'object', additionalProperties: true };

  // SPEC §8.1 protocol contract for POST /api/v1/material/search, as published
  // in loop-protocol/openapi.json (MaterialSearchRequest -> {results, total,
  // next?}). The same route also serves the additive Core-DP contract below.
  // The two contracts are disjoint on `limit` (required by Core-DP, absent
  // from the protocol contract).
  //
  // NOTE: a oneOf of the two contracts is NOT expressible here — Fastify's
  // AJV runs with `removeAdditional: true`, which strips undeclared keys
  // instead of failing additionalProperties:false, so a Core-DP body would
  // match BOTH oneOf branches. Instead the union of properties is declared
  // once, and the handler rejects mixed bodies explicitly.
  const CORE_DP_SEARCH_KEYS = ['scope', 'filters', 'auth', 'strict_filtering', 'limit', 'cursor', 'consistency'] as const;
  const PROTOCOL_SEARCH_KEYS = ['category', 'radius_km', 'min_quantity', 'max_loop_cost'] as const;

  const materialSearchBodySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...searchRequestSchema.properties,
      category: { type: 'string' },
      radius_km: { type: 'number', minimum: 0 },
      min_quantity: { type: 'number', minimum: 0 },
      max_loop_cost: { type: 'number', minimum: 0 },
    },
  };

  type ProtocolMaterialSearchRequestBody = {
    category?: string;
    radius_km?: number;
    min_quantity?: number;
    max_loop_cost?: number;
  };

  async function handleProtocolMaterialSearch(
    body: ProtocolMaterialSearchRequestBody,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (body.max_loop_cost !== undefined) {
      // LoopCost is defined over offers/transactions (a price is required);
      // bare MaterialDNA records carry no price, so this filter cannot be
      // evaluated honestly by a material registry. Reject explicitly rather
      // than silently ignoring it.
      sendSpecError(
        reply,
        'INVALID_REQUEST',
        'max_loop_cost filtering is not supported by this lab node: LoopCost requires offer pricing, which MaterialDNA records do not carry',
      );
      return;
    }

    const filters: ProtocolMaterialSearchFilters = {
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.radius_km !== undefined ? { radius_km: body.radius_km } : {}),
      ...(body.min_quantity !== undefined ? { min_quantity: body.min_quantity } : {}),
    };

    let result: Awaited<ReturnType<typeof deps.searchLoopMaterialsProtocol>>;
    try {
      result = await deps.searchLoopMaterialsProtocol(filters, config.node.location);
    } catch (error) {
      request.log.error({ err: error }, 'Protocol material search failed');
      sendSpecError(reply, 'INTERNAL_ERROR', 'Material search failed');
      return;
    }

    reply.send({ results: result.results, total: result.total });
  }

  type LoopSearchRequestBody = {
    scope?: 'local' | 'cross-node';
    filters?: LoopSearchFilters;
    auth?: { mode?: 'public-lab' | 'bearer' | 'node-signature'; subject_node?: string };
    strict_filtering?: boolean;
    limit: number;
    cursor?: string;
    consistency?: 'snapshot' | 'eventual';
  };

  async function handleLoopSearch(
    entityType: 'material' | 'product',
    search: (opts: {
      filters: LoopSearchFilters;
      limit: number;
      cursor?: string;
      strictFiltering?: boolean;
    }) => Promise<LoopSearchResult>,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const body = request.body as LoopSearchRequestBody;

    if (body.scope === 'cross-node') {
      sendCoreDpError(
        reply,
        new CoreDpError(
          'invalid_request',
          'Cross-node search requires the signed envelope/federation layer, which this lab preview does not implement yet.',
        ),
      );
      return;
    }

    if (body.auth?.mode === 'node-signature') {
      // No signature-verification exists yet for this mode. Reject explicitly
      // rather than silently treating it like no-auth-supplied, so a caller
      // can never get an unverified trust claim honored — even accidentally —
      // once cross-node search is wired on top of this same gate.
      sendCoreDpError(
        reply,
        new CoreDpError('invalid_request', 'auth.mode "node-signature" is not implemented in this lab preview.'),
      );
      return;
    }

    if (body.auth?.mode === 'bearer' && !requireApiKey(request, reply)) {
      return;
    }

    let result: LoopSearchResult;
    try {
      result = await search({
        filters: body.filters ?? {},
        limit: body.limit,
        cursor: body.cursor,
        strictFiltering: body.strict_filtering,
      });
    } catch (error) {
      sendCoreDpError(reply, toCoreDpError(error));
      return;
    }

    reply.send({
      entity_type: entityType,
      results: result.results,
      ordering: { primary: 'updated_at_asc', tie_break: 'id_asc' },
      ...(result.next_cursor ? { next_cursor: result.next_cursor } : {}),
      // Each page is a single SELECT with a keyset cursor; there is no snapshot
      // held across pages, so the honest answer is `eventual` regardless of the
      // mode the caller asked for (a downgrade the response field exists to
      // signal). A fabricated snapshot_id would claim isolation we don't have.
      consistency: { mode: 'eventual', as_of: new Date().toISOString() },
      provenance: { queried_nodes: [config.node.id] },
    });
  }

  // Search is read-only; it uses the default (read) rate limit, not the much
  // tighter write limit — lab UIs issue several searches in parallel.
  app.post('/api/v1/material/search', {
    schema: {
      consumes: ['application/json', loopContentType],
      body: materialSearchBodySchema,
      response: { 200: searchResponseSchema },
    },
  }, async (request, reply) => {
    const body = request.body as LoopSearchRequestBody & ProtocolMaterialSearchRequestBody;
    if (body.limit !== undefined) {
      if (PROTOCOL_SEARCH_KEYS.some((key) => (body as Record<string, unknown>)[key] !== undefined)) {
        sendSpecError(
          reply,
          'INVALID_REQUEST',
          'Protocol search filters (category, radius_km, min_quantity, max_loop_cost) cannot be combined with the Core-DP search contract',
        );
        return;
      }
      await handleLoopSearch('material', deps.searchLoopMaterials, request, reply);
      return;
    }
    if (CORE_DP_SEARCH_KEYS.some((key) => (body as Record<string, unknown>)[key] !== undefined)) {
      sendSpecError(reply, 'INVALID_REQUEST', 'The Core-DP search contract requires a limit');
      return;
    }
    await handleProtocolMaterialSearch(body, request, reply);
  });

  app.post('/api/v1/product/search', {
    schema: { body: searchRequestSchema, response: { 200: searchResponseSchema } },
  }, async (request, reply) => {
    await handleLoopSearch('product', deps.searchLoopProducts, request, reply);
  });
}
