import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
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

describe('federation routes', () => {
  it('lists lab nodes', async () => {
    const app = Fastify({ logger: false });
    await registerFederationRoutes(app, {
      listNodes: () => ([
        {
          node_id: 'lab-hub.loop',
          name: 'LocalLoop Lab Hub',
          endpoint: 'https://loop-api.urbnia.com',
          capabilities: ['lab-relay'],
          last_seen: '2025-12-20T10:00:00Z',
          lab_only: true,
        },
      ]),
      upsertNode: (node) => ({
        ...node,
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true,
      }),
      getLocalNode: () => ({
        node_id: 'lab-hub.loop',
        name: 'LocalLoop Lab Hub',
        endpoint: 'https://loop-api.urbnia.com',
        capabilities: ['lab-relay'],
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true,
      }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/federation/nodes' });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.lab_only).toBe(true);
    expect(payload.nodes.length).toBeGreaterThan(0);
  });

  it('accepts handshake payloads', async () => {
    const app = Fastify({ logger: false });
    const calls: { node?: string } = {};
    await registerFederationRoutes(app, {
      listNodes: () => ([]),
      upsertNode: (node) => {
        calls.node = node.node_id;
        return {
          ...node,
          last_seen: '2025-12-20T10:00:00Z',
          lab_only: true,
        };
      },
      getLocalNode: () => ({
        node_id: 'lab-hub.loop',
        name: 'LocalLoop Lab Hub',
        endpoint: 'https://loop-api.urbnia.com',
        capabilities: ['lab-relay'],
        last_seen: '2025-12-20T10:00:00Z',
        lab_only: true,
      }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/federation/handshake',
      payload: handshakePayload,
    });

    expect(response.statusCode).toBe(202);
    const payload = response.json();
    expect(payload.status).toBe('accepted');
    expect(payload.peer_id).toBe('lab-hub.loop');
    expect(calls.node).toBe('munich.loop');
  });
});
