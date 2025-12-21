import { pool } from '../src/db/pool';
import { waitForDatabase } from '../src/db/wait';
import { runMigrations } from '../src/db/migrate';
import { insertLoopMaterial, insertLoopOffer, insertLoopEvent } from '../src/db/loop';

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

  await pool.query('TRUNCATE loop_transfers, loop_matches, loop_offers, loop_materials, loop_events RESTART IDENTITY');

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
