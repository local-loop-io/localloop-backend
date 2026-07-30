import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerFederationRoutes } from '../src/routes/federation';

const localNode = {
  node_id: 'lab-hub.loop',
  name: 'localLOOP Lab Hub',
  endpoint: 'https://loop-api.urbnia.com',
  capabilities: ['lab-relay'],
  last_seen: '2025-12-20T10:00:00Z',
  lab_only: true as const,
};

const deps = {
  listNodes: async () => [localNode],
  upsertNode: async (node: Omit<typeof localNode, 'last_seen' | 'lab_only'>) => ({
    ...node,
    last_seen: '2025-12-20T10:00:00Z',
    lab_only: true as const,
  }),
  getLocalNode: () => localNode,
};

describe('node info route Cache-Control', () => {
  it('returns public short cache on GET /api/v1/node/info', async () => {
    const app = Fastify({ logger: false });
    await registerFederationRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/v1/node/info' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=30');
    expect(response.json()['@type']).toBe('NodeInfo');
  });

  it('returns no-store on GET /api/v1/federation/nodes', async () => {
    const app = Fastify({ logger: false });
    await registerFederationRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/v1/federation/nodes' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
