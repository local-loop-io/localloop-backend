import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { incrementMetric } from '../metrics';
import { getLocalNode, listNodes, resolveNodeApiEndpoint, upsertNode, type NodeRecord } from '../federation/registry';
import { requireApiKey } from '../security/apiKey';
import { federationSchemaIds, registerFederationSchemas } from '../schemas/federationSchemas';
import { loopContentType } from '../protocol';
import packageInfo from '../../package.json';

const listResponseSchema = {
  type: 'object',
  properties: {
    lab_only: { type: 'boolean' },
    updated_at: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          node_id: { type: 'string' },
          name: { type: 'string' },
          endpoint: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          last_seen: { type: 'string' },
          lab_only: { type: 'boolean' },
        },
      },
    },
  },
};

const nodeInfoResponseSchema = {
  type: 'object',
  required: ['@context', '@type', 'id', 'name', 'version', 'location', 'endpoint', 'capabilities', 'lab_only'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string', const: 'NodeInfo' },
    schema_version: { type: 'string' },
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
    location: {
      type: 'object',
      required: ['lat', 'lon'],
      properties: {
        lat: { type: 'number' },
        lon: { type: 'number' },
        city: { type: 'string' },
        country: { type: 'string' },
      },
    },
    endpoint: { type: 'string' },
    capabilities: { type: 'array', items: { type: 'string' } },
    lab_only: { type: 'boolean', const: true },
  },
};

const apiKeySecurity = [{ ApiKeyAuth: [] }];

const writeRateLimit = {
  max: config.rateLimitWriteMax,
  timeWindow: config.rateLimitWriteWindow,
};

type FederationDeps = {
  listNodes: () => Promise<NodeRecord[]>;
  upsertNode: (input: Omit<NodeRecord, 'last_seen' | 'lab_only'>) => Promise<NodeRecord>;
  getLocalNode: () => NodeRecord;
};

const defaultDeps: FederationDeps = {
  listNodes,
  upsertNode,
  getLocalNode,
};

export async function registerFederationRoutes(app: FastifyInstance, deps: FederationDeps = defaultDeps) {
  registerFederationSchemas(app);

  app.get('/api/v1/node/info', {
    schema: {
      response: {
        200: nodeInfoResponseSchema,
      },
    },
  }, async () => {
    const local = deps.getLocalNode();
    return {
      '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
      '@type': 'NodeInfo',
      schema_version: '0.2.0',
      id: local.node_id,
      name: local.name,
      version: packageInfo.version,
      location: config.node.location,
      endpoint: resolveNodeApiEndpoint(config.publicBaseUrl),
      capabilities: local.capabilities,
      lab_only: true,
    };
  });

  app.get('/api/v1/federation/nodes', {
    schema: {
      response: {
        200: listResponseSchema,
      },
    },
  }, async () => {
    return {
      lab_only: true,
      updated_at: new Date().toISOString(),
      nodes: await deps.listNodes(),
    };
  });

  app.post('/api/v1/federation/handshake', {
    config: { rateLimit: writeRateLimit },
    schema: {
      consumes: ['application/json', loopContentType],
      security: apiKeySecurity,
      body: { $ref: federationSchemaIds.handshakeRequest },
      response: {
        202: { $ref: federationSchemaIds.handshakeResponse },
      },
    },
  }, async (request, reply) => {
    if (!requireApiKey(request, reply)) {
      return;
    }

    const payload = request.body as {
      node_id: string;
      name: string;
      endpoint: string;
      capabilities: string[];
    };

    const record = await deps.upsertNode({
      node_id: payload.node_id,
      name: payload.name,
      endpoint: payload.endpoint,
      capabilities: payload.capabilities,
    } as Omit<NodeRecord, 'last_seen' | 'lab_only'>);

    incrementMetric('federation_handshake');

    const local = deps.getLocalNode();
    reply.code(202).send({
      '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
      '@type': 'NodeHandshakeResponse',
      schema_version: '0.2.0',
      status: 'accepted',
      peer_id: local.node_id,
      capabilities: local.capabilities,
      received_at: new Date().toISOString(),
      lab_only: true,
      message: `Lab handshake accepted for ${record.node_id}.`,
    });
  });
}
