import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerLoopRoutes } from '../src/routes/loop';

const searchDeps = () => ({
  createLoopMaterial: async (p: { id: string }) => ({ id: p.id, created_at: new Date().toISOString(), event: {} }),
  createLoopProduct: async (p: { id: string }) => ({ id: p.id, created_at: new Date().toISOString(), event: {} }),
  createLoopOffer: async (p: { id: string }) => ({ id: p.id, created_at: new Date().toISOString(), event: {} }),
  createLoopMatch: async (p: { id: string }) => ({ id: p.id, created_at: new Date().toISOString(), event: {} }),
  createLoopTransfer: async (p: { id: string }) => ({ id: p.id, created_at: new Date().toISOString(), event: {} }),
  insertLoopEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
  listLoopEvents: async () => [],
  getLoopMaterial: async () => ({ id: 'material' }),
  getLoopMaterialById: async () => undefined,
  listLoopMaterials: async () => [],
  getLoopProduct: async () => undefined,
  getLoopProductById: async () => undefined,
  listLoopProducts: async () => [],
  getLoopOffer: async () => undefined,
  getLoopOfferById: async () => undefined,
  listLoopOffers: async () => [],
  getLoopMatch: async () => undefined,
  getLoopMatchById: async () => undefined,
  listLoopMatches: async () => [],
  getLoopTransferById: async () => undefined,
  listLoopTransfers: async () => [],
  searchLoopMaterials: async () => {
    throw new Error('searchLoopMaterials must not be called when auth guards reject');
  },
  searchLoopProducts: async () => {
    throw new Error('searchLoopProducts must not be called when auth guards reject');
  },
  searchLoopMaterialsProtocol: async () => ({ results: [], total: 0 }),
  broadcastLoopEvent: () => undefined,
});

async function buildApp() {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);
  await registerLoopRoutes(app, searchDeps());
  return app;
}

describe('Core-DP search auth guards', () => {
  it.each([
    ['POST', '/api/v1/material/search'],
    ['POST', '/api/v1/product/search'],
  ] as const)('%s %s rejects cross-node scope before search runs', async (_method, url) => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { limit: 10, scope: 'cross-node' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('invalid_request');
    expect(body.message).toMatch(/cross-node search requires the signed envelope/i);
  });

  it.each([
    ['POST', '/api/v1/material/search'],
    ['POST', '/api/v1/product/search'],
  ] as const)('%s %s rejects node-signature auth mode before search runs', async (_method, url) => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { limit: 10, auth: { mode: 'node-signature', subject_node: 'munich.loop' } },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('invalid_request');
    expect(body.message).toMatch(/node-signature.*not implemented/i);
  });
});
