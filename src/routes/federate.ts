import { setNoStore } from '../httpCache';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { getLoopMaterial, insertLoopEvent } from '../db/loop';
import { broadcastLoopEvent } from '../realtime/loopStream';
import { incrementMetric } from '../metrics';
import { requireApiKey } from '../security/apiKey';
import { loopContentType } from '../protocol';
import { federationSchemaIds, registerFederationSchemas } from '../schemas/federationSchemas';
import { sendSpecError, specErrorResponseSchema } from '../specErrors';

/**
 * SPEC §8.2 federation endpoints (node-to-node).
 *
 * SPEC §9.2 requires three headers on node-to-node requests: X-Node-ID,
 * X-Node-Signature, and X-Timestamp (±5 minutes tolerance). This lab
 * implementation enforces header presence and timestamp freshness, but does
 * NOT cryptographically verify X-Node-Signature — signature verification is
 * part of the Core-DP signed-envelope profile, which this lab preview has not
 * implemented for these routes. This is called out in README/SPEC-COMPLIANCE.
 */
const NODE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

// Body schemas mirror components.schemas.MaterialAnnouncement / MaterialOffer
// in loop-protocol/openapi.json, with @type narrowed to its const value
// (servers MAY validate message types).
const announcementBodySchema = {
  type: 'object',
  required: ['@context', '@type', 'material', 'origin', 'available'],
  additionalProperties: true,
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'MaterialAnnouncement' },
    material: { type: 'string', minLength: 1 },
    origin: { type: 'string', minLength: 1 },
    available: { type: 'boolean' },
  },
};

const materialOfferBodySchema = {
  type: 'object',
  required: ['@context', '@type', 'material', 'from', 'base_price', 'loop_cost', 'valid_until'],
  additionalProperties: true,
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'MaterialOffer' },
    material: { type: 'string', minLength: 1 },
    from: { type: 'string', minLength: 1 },
    base_price: { type: 'number', minimum: 0 },
    loop_cost: { type: 'number', minimum: 0 },
    valid_until: { type: 'string', format: 'date-time' },
  },
};

const apiKeySecurity = [{ ApiKeyAuth: [] }];

const writeRateLimit = {
  max: config.rateLimitWriteMax,
  timeWindow: config.rateLimitWriteWindow,
};

type FederateDeps = {
  insertLoopEvent: typeof insertLoopEvent;
  getLoopMaterial: typeof getLoopMaterial;
  broadcastLoopEvent: typeof broadcastLoopEvent;
};

const defaultDeps: FederateDeps = {
  insertLoopEvent,
  getLoopMaterial,
  broadcastLoopEvent,
};

/**
 * Enforce SPEC §9.2 headers. Returns true when the request may proceed.
 * (Presence + freshness only; see file header for the lab signature caveat.)
 */
function requireNodeHeaders(request: FastifyRequest, reply: FastifyReply): boolean {
  const nodeId = request.headers['x-node-id'];
  const signature = request.headers['x-node-signature'];
  const timestamp = request.headers['x-timestamp'];

  if (typeof nodeId !== 'string' || nodeId.trim() === '' || typeof signature !== 'string' || signature.trim() === '') {
    sendSpecError(reply, 'UNAUTHORIZED', 'Node-to-node requests require X-Node-ID and X-Node-Signature headers');
    return false;
  }
  // A missing or malformed X-Timestamp is a malformed request (400); only a
  // well-formed but stale one is an authentication failure (401), since the
  // freshness window is the replay-protection part of §9.2.
  if (typeof timestamp !== 'string' || timestamp.trim() === '') {
    sendSpecError(reply, 'INVALID_REQUEST', 'Node-to-node requests require an X-Timestamp header');
    return false;
  }
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    sendSpecError(reply, 'INVALID_REQUEST', 'X-Timestamp is not a valid timestamp');
    return false;
  }
  if (Math.abs(Date.now() - parsed) > NODE_TIMESTAMP_TOLERANCE_MS) {
    sendSpecError(reply, 'UNAUTHORIZED', 'X-Timestamp is outside the ±5 minute tolerance');
    return false;
  }
  return true;
}

export async function registerFederateRoutes(app: FastifyInstance, deps: FederateDeps = defaultDeps) {
  registerFederationSchemas(app);
  app.addHook('onRequest', async (_req, reply) => { setNoStore(reply); });

  app.post('/api/v1/federate/announce', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: announcementBodySchema,
      response: {
        202: { $ref: federationSchemaIds.federateAccepted },
        400: specErrorResponseSchema,
        401: specErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }
    if (!requireNodeHeaders(request, reply)) {
      return;
    }

    const payload = request.body as {
      material: string;
      origin: string;
      available: boolean;
      [key: string]: unknown;
    };
    const sourceNode = (request.headers['x-node-id'] as string).trim();

    const eventPayload = {
      type: 'federation.announcement',
      entity: 'material',
      entity_id: payload.material,
      data: payload,
      source_node: sourceNode,
    };
    const created = await deps.insertLoopEvent({
      event_type: 'federation.announcement',
      entity_type: 'material',
      entity_id: payload.material,
      payload: { ...payload, source_node: sourceNode },
    });

    deps.broadcastLoopEvent({ ...eventPayload, created_at: created.created_at });
    incrementMetric('federation_announcement_received');
    incrementMetric('loop_event_emitted');
    request.log.info({ material: payload.material, origin: payload.origin, sourceNode }, 'Federation announcement received');

    reply.code(202).send({ status: 'accepted', id: created.id });
  });

  app.post('/api/v1/federate/offer', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: materialOfferBodySchema,
      response: {
        202: { $ref: federationSchemaIds.federateAccepted },
        400: specErrorResponseSchema,
        401: specErrorResponseSchema,
        404: specErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }
    if (!requireNodeHeaders(request, reply)) {
      return;
    }

    const payload = request.body as {
      material: string;
      from: string;
      base_price: number;
      loop_cost: number;
      valid_until: string;
      [key: string]: unknown;
    };
    const sourceNode = (request.headers['x-node-id'] as string).trim();

    // The offer targets a material hosted by THIS node (spec §12.1 step 4).
    const material = await deps.getLoopMaterial(payload.material);
    if (!material) {
      sendSpecError(reply, 'NOT_FOUND', `Material with ID ${payload.material} not found on this node`, {
        searched_id: payload.material,
      });
      return;
    }
    if (Date.parse(payload.valid_until) <= Date.now()) {
      sendSpecError(reply, 'INVALID_REQUEST', 'Offer validity (valid_until) has already expired');
      return;
    }

    const created = await deps.insertLoopEvent({
      event_type: 'federation.offer_received',
      entity_type: 'material',
      entity_id: payload.material,
      payload: { ...payload, source_node: sourceNode },
    });

    deps.broadcastLoopEvent({
      type: 'federation.offer_received',
      entity: 'material',
      entity_id: payload.material,
      data: payload,
      source_node: sourceNode,
      created_at: created.created_at,
    });
    incrementMetric('federation_offer_received');
    incrementMetric('loop_event_emitted');
    request.log.info({ material: payload.material, from: payload.from, sourceNode }, 'Federation offer received');

    reply.code(202).send({ status: 'accepted', id: created.id });
  });
}
