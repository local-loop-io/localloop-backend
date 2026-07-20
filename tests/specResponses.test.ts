import { describe, expect, it } from 'bun:test';
import Ajv from 'ajv';
import Fastify from 'fastify';
import nodeInfoSchema from '../src/schemas/node-info.schema.json';
import loopSignalSchema from '../src/schemas/loopsignal.schema.json';
import transactionSchema from '../src/schemas/transaction.schema.json';
import materialDnaSchema from '../src/schemas/material-dna.schema.json';
import productDnaSchema from '../src/schemas/product-dna.schema.json';
import { registerLoopProtocolParsers } from '../src/protocol';
import { registerLoopSchemas } from '../src/schemas/loopSchemas';
import { registerFederationRoutes } from '../src/routes/federation';
import { registerSignalsRoutes } from '../src/routes/signals';
import { registerTransactionRoutes } from '../src/routes/transactions';
import { registerLoopRoutes } from '../src/routes/loop';
import { getLocalNode } from '../src/federation/registry';

/**
 * Validates live route responses against the canonical loop-protocol schemas
 * (synced into src/schemas/ — drift-guarded by scripts/sync-schemas.ts). This
 * is the response-side counterpart of the route-surface conformance gate:
 * the spec's JSON-LD contracts must actually hold on the wire.
 */
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });

const validateNodeInfo = ajv.compile(nodeInfoSchema);
const validateLoopSignal = ajv.compile(loopSignalSchema);
const validateTransaction = ajv.compile(transactionSchema);
const validateMaterialDna = ajv.compile(materialDnaSchema);
const validateProductDna = ajv.compile(productDnaSchema);

const validMaterialDoc = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
  '@type': 'MaterialDNA',
  schema_version: '0.1.1',
  id: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
  category: 'plastic-pet',
  quantity: { value: 100, unit: 'kg' },
  origin_city: 'Munich',
  current_city: 'Munich',
  available_from: '2025-06-01T10:00:00Z',
};

const validProductDoc = {
  '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
  '@type': 'ProductDNA',
  schema_version: '0.2.0',
  id: 'PRD-DE-MUC-2025-DESK-F4A7B2',
  product_category: 'furniture-office',
  name: 'Standing Desk — Ergotron WorkFit',
  condition: 'good',
  quantity: { value: 12, unit: 'piece' },
  origin_city: 'Munich',
  current_city: 'Munich',
  available_from: '2026-03-15T08:00:00Z',
};

/** Full LoopDeps stub; only the get-by-id reads are exercised by these tests. */
const buildLoopAppWithDocs = async () => {
  const app = Fastify({ logger: false });
  registerLoopProtocolParsers(app);
  registerLoopSchemas(app);

  const record = { id: 'x', created_at: new Date().toISOString() };
  await registerLoopRoutes(app, {
    createLoopMaterial: async () => ({ ...record, event: {} }),
    createLoopProduct: async () => ({ ...record, event: {} }),
    createLoopOffer: async () => ({ ...record, event: {} }),
    createLoopMatch: async () => ({ ...record, event: {} }),
    createLoopTransfer: async () => ({ ...record, event: {} }),
    insertLoopEvent: async () => ({ id: 1, created_at: record.created_at }),
    listLoopEvents: async () => [],
    getLoopMaterial: async () => undefined,
    getLoopMaterialById: async (id: string) =>
      id === validMaterialDoc.id ? { id, payload: validMaterialDoc } : undefined,
    listLoopMaterials: async () => [],
    getLoopProduct: async () => undefined,
    getLoopProductById: async (id: string) =>
      id === validProductDoc.id ? { id, payload: validProductDoc } : undefined,
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
    searchLoopMaterialsProtocol: async () => ({ results: [], total: 0 }),
    broadcastLoopEvent: () => undefined,
  });
  return app;
};

describe('canonical schema conformance of protocol responses', () => {
  it('GET /api/v1/node/info validates against node-info.schema.json', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    await registerFederationRoutes(app, {
      listNodes: async () => [],
      upsertNode: async (node) => ({ ...node, last_seen: new Date().toISOString(), lab_only: true as const }),
      getLocalNode,
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/node/info' });
    expect(response.statusCode).toBe(200);
    const valid = validateNodeInfo(response.json());
    expect(validateNodeInfo.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /api/v1/signals validates against loopsignal.schema.json', async () => {
    const app = Fastify({ logger: false });
    await registerSignalsRoutes(app, {
      getLoopSignalConfig: async () => ({
        signals: {
          'plastic-pet': 0.3,
          'plastic-hdpe': 0.25,
          'metal-aluminum': 0.15,
          'organic-food': 0.4,
          'glass-clear': 0.1,
          'paper-clean': 0.05,
          'ewaste-phones': 0.35,
          default: 0.05,
        },
        valid_from: '2026-01-01T00:00:00.000Z',
        valid_until: '2027-12-31T23:59:59.000Z',
        updated_at: '2026-07-19T10:00:00.000Z',
      }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/signals' });
    expect(response.statusCode).toBe(200);
    const valid = validateLoopSignal(response.json());
    expect(validateLoopSignal.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /api/v1/transaction responds with a valid TransactionStatus', async () => {
    const app = Fastify({ logger: false });
    registerLoopProtocolParsers(app);
    registerLoopSchemas(app);
    await registerTransactionRoutes(app, {
      createLoopTransaction: async (p: { id?: string }) => ({
        id: p.id as string,
        created_at: new Date().toISOString(),
        event: {},
      }),
      getLoopTransactionById: async () => undefined,
      broadcastLoopEvent: () => undefined,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/transaction',
      payload: {
        '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
        '@type': 'MaterialTransaction',
        schema_version: '0.2.0',
        id: 'TXN-2026-07-19-777',
        material: 'MAT-DE-MUC-2025-PLASTIC-B847F3',
        seller: 'munich.loop',
        buyer: 'berlin.loop',
        offer: { base_price: 120, loop_cost: 156 },
        timestamp: '2026-07-19T16:00:00Z',
      },
    });
    expect(response.statusCode).toBe(201);
    const valid = validateTransaction(response.json());
    expect(validateTransaction.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /api/v1/material/:id validates against material-dna.schema.json', async () => {
    const app = await buildLoopAppWithDocs();

    const response = await app.inject({ method: 'GET', url: `/api/v1/material/${validMaterialDoc.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/ld+json');
    const valid = validateMaterialDna(response.json());
    expect(validateMaterialDna.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /api/v1/product/:id validates against product-dna.schema.json', async () => {
    const app = await buildLoopAppWithDocs();

    const response = await app.inject({ method: 'GET', url: `/api/v1/product/${validProductDoc.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/ld+json');
    const valid = validateProductDna(response.json());
    expect(validateProductDna.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });
});
