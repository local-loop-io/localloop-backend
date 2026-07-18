import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import {
  createLoopMaterial,
  createLoopProduct,
  searchLoopMaterials,
  searchLoopProducts,
  type LoopMaterialPayload,
  type LoopProductPayload,
} from '../src/db/loop';

// DB-backed: auto-skips when Postgres is unreachable, same convention as
// loop.stateMachine.test.ts.
let dbReady = false;
const createdMaterials: string[] = [];
const createdProducts: string[] = [];

const hex = '0123456789ABCDEF';
const suffix = () => Array.from({ length: 8 }, () => hex[Math.floor(Math.random() * 16)]).join('');

function buildMaterial(overrides: Partial<LoopMaterialPayload> = {}): LoopMaterialPayload {
  const id = `MAT-DE-MUC-2025-SEARCH-${suffix()}`;
  createdMaterials.push(id);
  return {
    id,
    category: 'test-search',
    quantity: { value: 100, unit: 'kg' },
    origin_city: 'Munich',
    current_city: 'Munich',
    available_from: '2025-06-01T10:00:00Z',
    schema_version: '0.1.1',
    ...overrides,
  };
}

function buildProduct(overrides: Partial<LoopProductPayload> = {}): LoopProductPayload {
  const id = `PRD-SEARCH-${suffix()}`;
  createdProducts.push(id);
  return {
    id,
    product_category: 'test-search',
    name: 'Test product',
    condition: 'good',
    quantity: { value: 1, unit: 'piece' },
    origin_city: 'Munich',
    current_city: 'Munich',
    available_from: '2025-06-01T10:00:00Z',
    schema_version: '0.2.0',
    ...overrides,
  };
}

beforeAll(async () => {
  try {
    await runMigrations();
    dbReady = true;
  } catch (error) {
    console.warn('[loop.search] Postgres unavailable — skipping search tests:', (error as Error).message);
    dbReady = false;
  }
});

afterAll(async () => {
  if (dbReady) {
    for (const id of createdMaterials) {
      await pool.query('DELETE FROM loop_materials WHERE id = $1', [id]);
    }
    for (const id of createdProducts) {
      await pool.query('DELETE FROM loop_products WHERE id = $1', [id]);
    }
  }
});

describe('Core-DP local search', () => {
  it('filters by category_prefix and returns deterministic record hashes/provenance', async () => {
    if (!dbReady) return;
    const cat = `cat-${suffix()}`;
    const a = buildMaterial({ category: cat });
    const b = buildMaterial({ category: cat });
    await createLoopMaterial(a);
    await createLoopMaterial(b);

    const result = await searchLoopMaterials({ filters: { category_prefix: cat }, limit: 100 });
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    for (const row of result.results) {
      expect(row.record_hash_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof row.source_node).toBe('string');
      expect(typeof row.updated_at).toBe('string');
    }
  });

  it('paginates with an opaque cursor in updated_at_asc,id_asc order with no gaps or dupes', async () => {
    if (!dbReady) return;
    const cat = `page-${suffix()}`;
    const created: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const m = buildMaterial({ category: cat });
      await createLoopMaterial(m);
      created.push(m.id);
    }

    const page1 = await searchLoopMaterials({ filters: { category_prefix: cat }, limit: 2 });
    expect(page1.results.length).toBe(2);
    expect(page1.next_cursor).toBeDefined();

    const page2 = await searchLoopMaterials({ filters: { category_prefix: cat }, limit: 2, cursor: page1.next_cursor });
    expect(page2.results.length).toBe(1);
    expect(page2.next_cursor).toBeUndefined();

    const allIds = [...page1.results, ...page2.results].map((r) => r.id);
    expect(new Set(allIds).size).toBe(3);
    for (const id of created) {
      expect(allIds).toContain(id);
    }
  });

  it('applies the quantity_min filter', async () => {
    if (!dbReady) return;
    const cat = `qty-${suffix()}`;
    const small = buildMaterial({ category: cat, quantity: { value: 5, unit: 'kg' } });
    const large = buildMaterial({ category: cat, quantity: { value: 500, unit: 'kg' } });
    await createLoopMaterial(small);
    await createLoopMaterial(large);

    const result = await searchLoopMaterials({ filters: { category_prefix: cat, quantity_min: 100 }, limit: 100 });
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(large.id);
    expect(ids).not.toContain(small.id);
  });

  it('treats id_prefix and category_prefix LIKE metacharacters as literal text', async () => {
    if (!dbReady) return;
    const cat = `lit_${suffix()}%`; // literal % must not become a wildcard
    const decoy = buildMaterial({ category: `lit_${suffix()}xyz` });
    const target = buildMaterial({ category: cat });
    await createLoopMaterial(decoy);
    await createLoopMaterial(target);

    const result = await searchLoopMaterials({ filters: { category_prefix: cat }, limit: 100 });
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(target.id);
    expect(ids).not.toContain(decoy.id);
  });

  it('rejects the condition filter on materials under strict_filtering', async () => {
    if (!dbReady) return;
    await expect(
      searchLoopMaterials({ filters: { condition: 'good' }, limit: 10, strictFiltering: true }),
    ).rejects.toThrow(/condition/);
  });

  it('supports the condition filter on products', async () => {
    if (!dbReady) return;
    const cat = `prodcond-${suffix()}`;
    const good = buildProduct({ product_category: cat, condition: 'good' });
    const fair = buildProduct({ product_category: cat, condition: 'fair' });
    await createLoopProduct(good);
    await createLoopProduct(fair);

    const result = await searchLoopProducts({ filters: { category_prefix: cat, condition: 'good' }, limit: 100 });
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(good.id);
    expect(ids).not.toContain(fair.id);
  });
});
