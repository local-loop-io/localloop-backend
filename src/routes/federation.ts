import type { FastifyInstance } from 'fastify';
import { incrementMetric } from '../metrics';
import { getLocalNode, listNodes, upsertNode, type NodeRecord } from '../federation/registry';

const handshakeBodySchema = {
  type: 'object',
  required: ['@context', '@type', 'schema_version', 'node_id', 'name', 'endpoint', 'capabilities', 'timestamp'],
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string' },
    schema_version: { type: 'string' },
    node_id: { type: 'string' },
    name: { type: 'string' },
    endpoint: { type: 'string' },
    capabilities: { type: 'array', items: { type: 'string' } },
    timestamp: { type: 'string' },
    public_key: { type: 'string' },
    signature: { type: 'string' },
  },
};

const handshakeResponseSchema = {
  type: 'object',
  properties: {
    '@context': { type: 'string' },
    '@type': { type: 'string' },
    schema_version: { type: 'string' },
    status: { type: 'string' },
    peer_id: { type: 'string' },
    capabilities: { type: 'array', items: { type: 'string' } },
    received_at: { type: 'string' },
    lab_only: { type: 'boolean' },
    message: { type: 'string' },
  },
};

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

type FederationDeps = {
  listNodes: typeof listNodes;
  upsertNode: typeof upsertNode;
  getLocalNode: typeof getLocalNode;
};

const defaultDeps: FederationDeps = {
  listNodes,
  upsertNode,
  getLocalNode,
};

export async function registerFederationRoutes(app: FastifyInstance, deps: FederationDeps = defaultDeps) {
  app.get('/api/federation/nodes', {
    schema: {
      response: {
        200: listResponseSchema,
      },
    },
  }, async () => {
    return {
      lab_only: true,
      updated_at: new Date().toISOString(),
      nodes: deps.listNodes(),
    };
  });

  app.post('/api/federation/handshake', {
    schema: {
      body: handshakeBodySchema,
      response: {
        202: handshakeResponseSchema,
      },
    },
  }, async (request, reply) => {
    const payload = request.body as {
      node_id: string;
      name: string;
      endpoint: string;
      capabilities: string[];
    };

    const record = deps.upsertNode({
      node_id: payload.node_id,
      name: payload.name,
      endpoint: payload.endpoint,
      capabilities: payload.capabilities,
    } as Omit<NodeRecord, 'last_seen' | 'lab_only'>);

    incrementMetric('federation_handshake');

    const local = deps.getLocalNode();
    reply.code(202).send({
      '@context': 'https://loop-protocol.org/v0.1.1',
      '@type': 'NodeHandshakeResponse',
      schema_version: '0.1.1',
      status: 'accepted',
      peer_id: local.node_id,
      capabilities: local.capabilities,
      received_at: new Date().toISOString(),
      lab_only: true,
      message: `Lab handshake accepted for ${record.node_id}.`,
    });
  });
}
