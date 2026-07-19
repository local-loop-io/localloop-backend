import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerLoopRoutes } from '../src/routes/loop';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import {
  createLoopMaterial,
  searchLoopMaterialsProtocol,
  type LoopMaterialPayload,
} from '../src/db/loop';

// --- Route-level: dual-contract dispatch on POST /api/v1/material/search -----
// The route must serve the SPEC §8.1 protocol contract
// ({category, radius_km, min_quantity, max_loop_cost} -> {results, total})
// alongside the additive Core-DP contract (requests carrying `limit`).

const fullDeps = () => ({
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
  searchLoopMaterials: async () => ({ results: [] }),
  searchLoopProducts: async () => ({ results: [] }),
  searchLoopMaterialsProtocol: async (
    filters: { category?: string; radius_km?: number; min_quantity?: number },
  ) => ({
    results: [{ id: 'MAT-DE-MUC-2025-PLASTIC-B847F3', category: 'plastic-pet' }],
    total: 1,
    filtersSeen: filters,
  }),
  broadcastLoopEvent: () => undefined,
});

describe('POST /api/v1/material/search (protocol contract)', () => {
  it('serves the SPEC §8.1 example request shape', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerLoopRoutes(app, fullDeps());

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material/search',
      headers: { 'content-type': 'application/ld+json' },
      payload: { category: 'plastic-*', radius_km: 100, min_quantity: 500 },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.total).toBe(1);
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results[0].category).toBe('plastic-pet');
  });

  it('rejects max_loop_cost honestly (LoopCost needs pricing materials do not carry)', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerLoopRoutes(app, fullDeps());

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material/search',
      payload: { category: 'plastic-*', max_loop_cost: 150 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('INVALID_REQUEST');
  });

  it('rejects shapes that belong to neither contract', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerLoopRoutes(app, fullDeps());

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material/search',
      payload: { category: 'plastic-*', limit: 10 },
    });
    expect(response.statusCode).toBe(400);
  });

  it('still routes Core-DP requests (limit) to the Core-DP handler', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerLoopRoutes(app, fullDeps());

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/material/search',
      payload: { limit: 10 },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    // Core-DP response shape (entity_type/results/ordering/consistency)
    expect(payload.entity_type).toBe('material');
    expect(payload.ordering.primary).toBe('updated_at_asc');
  });
});

// --- DB-backed: protocol search semantics ------------------------------------
// Auto-skips when Postgres is unreachable, same convention as loop.search.test.

const NODE_LOCATION = { lat: 48.1351, lon: 11.582 }; // spec's Munich example
let dbReady = false;
const createdIds: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');

function buildMaterial(overrides: Partial<LoopMaterialPayload> = {}): LoopMaterialPayload {
  const id = `MAT-DE-MUC-2026-PROTO-${suffix()}`;
  createdIds.push(id);
  return {
    id,
    category: 'proto-search',
    quantity: { value: 100, unit: 'kg' },
    origin_city: 'Munich',
    current_city: 'Munich',
    available_from: '2026-07-01T10:00:00Z',
    schema_version: '0.2.0',
    ...overrides,
  };
}

beforeAll(async () => {
  try {
    await runMigrations();
    dbReady = true;
  } catch (error) {
    console.warn('[materialSearch.protocol] Postgres unavailable — skipping DB tests:', (error as Error).message);
    dbReady = false;
  }
});

afterAll(async () => {
  if (dbReady) {
    for (const id of createdIds) {
      await pool.query('DELETE FROM loop_materials WHERE id = $1', [id]);
    }
  }
});

describe('searchLoopMaterialsProtocol (DB)', () => {
  it('filters by exact category and trailing-glob category', async () => {
    if (!dbReady) return;
    const cat = `proto-cat-${suffix()}`;
    await createLoopMaterial(buildMaterial({ category: cat }));
    await createLoopMaterial(buildMaterial({ category: `${cat}-extra` }));

    const exact = await searchLoopMaterialsProtocol({ category: cat }, NODE_LOCATION);
    expect(exact.results.filter((r) => r.category === cat).length).toBe(1);

    const glob = await searchLoopMaterialsProtocol({ category: `${cat}-*` }, NODE_LOCATION);
    expect(glob.results.some((r) => r.category === `${cat}-extra`)).toBe(true);
    expect(glob.results.every((r) => String(r.category).startsWith(cat))).toBe(true);
    expect(glob.total).toBe(glob.results.length);
  });

  it('filters by min_quantity', async () => {
    if (!dbReady) return;
    const cat = `proto-qty-${suffix()}`;
    await createLoopMaterial(buildMaterial({ category: cat, quantity: { value: 600, unit: 'kg' } }));
    await createLoopMaterial(buildMaterial({ category: cat, quantity: { value: 100, unit: 'kg' } }));

    const result = await searchLoopMaterialsProtocol({ category: cat, min_quantity: 500 }, NODE_LOCATION);
    expect(result.total).toBe(1);
    expect((result.results[0].quantity as { value: number }).value).toBe(600);
  });

  it('filters by radius_km around the node location and excludes location-less records', async () => {
    if (!dbReady) return;
    const cat = `proto-geo-${suffix()}`;
    const near = buildMaterial({
      category: cat,
      location: { lat: 48.14, lon: 11.585, address: 'Near lab hub' },
    });
    const far = buildMaterial({
      category: cat,
      location: { lat: 52.52, lon: 13.405, address: 'Berlin (~500km away)' },
    });
    const noLocation = buildMaterial({ category: cat });
    await createLoopMaterial(near);
    await createLoopMaterial(far);
    await createLoopMaterial(noLocation);

    const within5km = await searchLoopMaterialsProtocol({ category: cat, radius_km: 5 }, NODE_LOCATION);
    const ids = within5km.results.map((r) => r.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(far.id);
    expect(ids).not.toContain(noLocation.id);

    const within600km = await searchLoopMaterialsProtocol({ category: cat, radius_km: 600 }, NODE_LOCATION);
    expect(within600km.results.map((r) => r.id)).toContain(far.id);
  });
});
