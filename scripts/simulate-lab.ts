import { config } from '../src/config';

type TimelineEvent = {
  label: string;
  id: string;
  createdAt: string;
};

const buildId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const buildMaterialId = (year: number) => {
  const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `DE-MUC-${year}-PLASTIC-${unique}`;
};

export async function runLabSimulation(baseUrl = `http://localhost:${config.port}`) {
  const timeline: TimelineEvent[] = [];
  const now = new Date();

  const material = {
    '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
    '@type': 'MaterialDNA',
    schema_version: '0.1.1',
    id: buildMaterialId(now.getUTCFullYear()),
    category: 'plastic-pet',
    quantity: { value: 120, unit: 'kg' },
    quality: 0.94,
    origin_city: 'DEMO Munich',
    current_city: 'DEMO Munich',
    available_from: now.toISOString(),
  };

  const materialResponse = await fetch(`${baseUrl}/api/loop/materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(material),
  });
  if (!materialResponse.ok) {
    throw new Error(`Material creation failed: ${await materialResponse.text()}`);
  }
  const materialCreated = await materialResponse.json();
  timeline.push({ label: 'MaterialDNA registered', id: materialCreated.id, createdAt: materialCreated.created_at });

  const offer = {
    '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
    '@type': 'Offer',
    schema_version: '0.1.1',
    id: buildId('OFR'),
    material_id: material.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    quantity: { value: 100, unit: 'kg' },
    status: 'open',
    available_until: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    terms: 'Lab demo pickup',
  };

  const offerResponse = await fetch(`${baseUrl}/api/loop/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer),
  });
  if (!offerResponse.ok) {
    throw new Error(`Offer creation failed: ${await offerResponse.text()}`);
  }
  const offerCreated = await offerResponse.json();
  timeline.push({ label: 'Offer published', id: offerCreated.id, createdAt: offerCreated.created_at });

  const match = {
    '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
    '@type': 'Match',
    schema_version: '0.1.1',
    id: buildId('MCH'),
    material_id: material.id,
    offer_id: offer.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    status: 'accepted',
    matched_at: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
  };

  const matchResponse = await fetch(`${baseUrl}/api/loop/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(match),
  });
  if (!matchResponse.ok) {
    throw new Error(`Match creation failed: ${await matchResponse.text()}`);
  }
  const matchCreated = await matchResponse.json();
  timeline.push({ label: 'Match accepted', id: matchCreated.id, createdAt: matchCreated.created_at });

  const transfer = {
    '@context': 'https://local-loop-io.github.io/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
    '@type': 'Transfer',
    schema_version: '0.1.1',
    id: buildId('TRF'),
    material_id: material.id,
    match_id: match.id,
    status: 'completed',
    handoff_at: new Date(now.getTime() + 1000 * 60 * 60 * 2).toISOString(),
    received_at: new Date(now.getTime() + 1000 * 60 * 60 * 4).toISOString(),
    route: { from_city: 'DEMO Munich', to_city: 'DEMO Berlin', mode: 'road' },
  };

  const transferResponse = await fetch(`${baseUrl}/api/loop/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transfer),
  });
  if (!transferResponse.ok) {
    throw new Error(`Transfer creation failed: ${await transferResponse.text()}`);
  }
  const transferCreated = await transferResponse.json();
  timeline.push({ label: 'Transfer completed', id: transferCreated.id, createdAt: transferCreated.created_at });

  console.log('\nLab demo timeline');
  console.log('-----------------');
  for (const event of timeline) {
    console.log(`${event.createdAt} — ${event.label} (${event.id})`);
  }

  return timeline;
}

if (import.meta.main) {
  runLabSimulation()
    .catch((error) => {
      console.error('Lab simulation failed', error);
      process.exit(1);
    });
}
