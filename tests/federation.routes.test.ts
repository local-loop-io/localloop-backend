import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerFederationSchemas } from '../src/schemas/federationSchemas';
import { registerFederationRoutes } from '../src/routes/federation';

const handshakePayload = {
  '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'NodeHandshake',
  schema_version: '0.1.1',
  node_id: 'munich.loop',
  name: 'DEMO Munich Node',
  endpoint: 'https://demo-munich.loop/api',
  capabilities: ['material-registry', 'lab-relay'],
  timestamp: '2025-12-20T10:00:00Z',
};

const localNode = {
  node_id: 'lab-hub.loop',
  name: 'localLOOP Lab Hub',
  endpoint: 'https://loop-api.urbnia.com',
  capabilities: ['lab-relay'],
  last_seen: '2025-12-20T10:00:00Z',
  lab_only: true as const,
};

describe('federation routes', () => {
  it('lists lab nodes', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerFederationSchemas(app);
    await registerFederationRoutes(app, {
      listNodes: async () => [localNode],
      upsertNode: async (node) => ({
        ...node,
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true as const,
      }),
      getLocalNode: () => localNode,
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/federation/nodes' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.lab_only).toBe(true);
    expect(payload.nodes.length).toBeGreaterThan(0);
  });

  it('returns local node info', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerFederationSchemas(app);
    await registerFederationRoutes(app, {
      listNodes: async () => [localNode],
      upsertNode: async (node) => ({
        ...node,
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true as const,
      }),
      getLocalNode: () => localNode,
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/node/info' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload['@type']).toBe('NodeInfo');
    expect(payload.id).toBe(localNode.node_id);
    expect(payload.endpoint).toBe('https://loop-api.urbnia.com/api/v1');
    expect(payload.lab_only).toBe(true);
  });

  it('accepts handshake payloads', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerFederationSchemas(app);
    const calls: { node?: string } = {};
    await registerFederationRoutes(app, {
      listNodes: async () => [],
      upsertNode: async (node) => {
        calls.node = node.node_id;
        return {
          ...node,
          last_seen: '2025-12-20T10:00:00Z',
          lab_only: true as const,
        };
      },
      getLocalNode: () => localNode,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federation/handshake',
      payload: handshakePayload,
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload['@context']).toBe('https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld');
    expect(payload.schema_version).toBe('0.2.0');
    expect(payload.status).toBe('accepted');
    expect(payload.peer_id).toBe('lab-hub.loop');
    expect(calls.node).toBe('munich.loop');
  });

  it('rejects malformed handshake payloads', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerFederationSchemas(app);
    await registerFederationRoutes(app, {
      listNodes: async () => [],
      upsertNode: async (node) => ({
        ...node,
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true as const,
      }),
      getLocalNode: () => localNode,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/federation/handshake',
      payload: {
        ...handshakePayload,
        endpoint: 'not-a-uri',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
