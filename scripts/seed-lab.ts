import { pool } from '../src/db/pool';
import { waitForDatabase } from '../src/db/wait';
import { runMigrations } from '../src/db/migrate';
import { insertLoopMaterial, insertLoopProduct, insertLoopOffer, insertLoopEvent } from '../src/db/loop';

const demoCities = [
  { slug: 'demo-munich', name: 'DEMO Munich', country: 'DE', code: 'MUC' },
  { slug: 'demo-berlin', name: 'DEMO Berlin', country: 'DE', code: 'BER' },
];

const categories = [
  'plastic-pet',
  'plastic-hdpe',
  'metal-aluminum',
  'organic-food',
  'glass-clear',
  'paper-clean',
];

const productCategories = [
  'furniture-office',
  'electronics-computing',
  'building-fixture',
  'textile-garment',
  'equipment-industrial',
];

const productConditions = ['new', 'like-new', 'good', 'fair', 'poor'] as const;

const productNames = [
  'Standing Desk — Ergotron WorkFit',
  'Monitor — Dell UltraSharp 27"',
  'LED Panel — Philips CoreLine',
  'Work Jacket — Engelbert Strauss',
  'Conveyor Belt Motor — Siemens',
];

const units = ['kg', 't', 'piece'];

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randomHex = (random: () => number, length: number) =>
  Array.from({ length }).map(() => Math.floor(random() * 16).toString(16)).join('').toUpperCase();

export async function seedLab() {
  await waitForDatabase();
  await runMigrations();

  await pool.query('TRUNCATE loop_transfers, loop_matches, loop_offers, loop_products, loop_materials, loop_events RESTART IDENTITY');

  await pool.query(`
    INSERT INTO cities (slug, name, country)
    VALUES ($1, $2, $3), ($4, $5, $6)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country
  `, [
    demoCities[0].slug,
    demoCities[0].name,
    demoCities[0].country,
    demoCities[1].slug,
    demoCities[1].name,
    demoCities[1].country,
  ]);

  const random = mulberry32(20251220);

  for (let index = 0; index < 200; index += 1) {
    const city = demoCities[index % demoCities.length];
    const category = categories[index % categories.length];
    const quantityValue = Math.round((random() * 900 + 100) * 10) / 10;
    const unit = units[index % units.length];
    const id = `DE-${city.code}-2025-${category.toUpperCase().split('-')[0]}-${randomHex(random, 6)}`;

    const materialPayload = {
      '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
      '@type': 'MaterialDNA',
      schema_version: '0.1.1',
      id,
      category,
      quantity: { value: quantityValue, unit },
      quality: Math.round(random() * 100) / 100,
      origin_city: city.name,
      current_city: city.name,
      available_from: new Date().toISOString(),
      metadata: {
        demo: true,
        batch: `LAB-${index + 1}`,
      },
    };

    await insertLoopMaterial(materialPayload);
    await insertLoopEvent({
      event_type: 'material.seeded',
      entity_type: 'material',
      entity_id: id,
      payload: materialPayload,
    });

    const offerPayload = {
      '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
      '@type': 'Offer',
      schema_version: '0.1.1',
      id: `OFR-${randomHex(random, 8)}`,
      material_id: id,
      from_city: city.name,
      to_city: demoCities[(index + 1) % demoCities.length].name,
      quantity: { value: quantityValue * 0.8, unit },
      status: 'open',
      available_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      terms: 'Lab demo offer',
      metadata: { demo: true },
    };

    await insertLoopOffer(offerPayload);
    await insertLoopEvent({
      event_type: 'offer.seeded',
      entity_type: 'offer',
      entity_id: offerPayload.id,
      payload: offerPayload,
    });
  }

  for (let index = 0; index < 50; index += 1) {
    const city = demoCities[index % demoCities.length];
    const productCategory = productCategories[index % productCategories.length];
    const condition = productConditions[index % productConditions.length];
    const name = productNames[index % productNames.length];
    const quantityValue = Math.round(random() * 20 + 1);
    const productId = `PRD-DE-${city.code}-2025-${productCategory.toUpperCase().split('-')[0]}-${randomHex(random, 6)}`;

    const productPayload = {
      '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
      '@type': 'ProductDNA',
      schema_version: '0.2.0',
      id: productId,
      product_category: productCategory,
      name,
      condition,
      quantity: { value: quantityValue, unit: 'piece' },
      origin_city: city.name,
      current_city: city.name,
      available_from: new Date().toISOString(),
      metadata: {
        demo: true,
        batch: `LAB-PRD-${index + 1}`,
      },
    };

    await insertLoopProduct(productPayload);
    await insertLoopEvent({
      event_type: 'product.seeded',
      entity_type: 'product',
      entity_id: productId,
      payload: productPayload,
    });

    const productOfferPayload = {
      '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
      '@type': 'Offer',
      schema_version: '0.2.0',
      id: `OFR-PRD-${randomHex(random, 8)}`,
      product_id: productId,
      from_city: city.name,
      to_city: demoCities[(index + 1) % demoCities.length].name,
      quantity: { value: quantityValue, unit: 'piece' },
      status: 'open',
      available_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      terms: 'Lab demo product offer',
      metadata: { demo: true },
    };

    await insertLoopOffer(productOfferPayload);
    await insertLoopEvent({
      event_type: 'offer.seeded',
      entity_type: 'offer',
      entity_id: productOfferPayload.id,
      payload: productOfferPayload,
    });
  }
}

if (import.meta.main) {
  seedLab()
    .then(() => {
      console.log('Seeded lab demo data.');
    })
    .catch((error) => {
      console.error('Failed to seed lab data', error);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
