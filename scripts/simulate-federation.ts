import { config } from '../src/config';

type TimelineEvent = {
  label: string;
  node: string;
  id: string;
  createdAt: string;
};

const buildId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const buildMaterialId = (year: number) => {
  const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `DE-MUC-${year}-PLASTIC-${unique}`;
};

const postJson = async (url: string, payload: unknown) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${url} failed: ${await response.text()}`);
  }
  return response.json();
};

const relayEvent = async (
  baseUrl: string,
  event: { event_type: string; entity_type: string; entity_id: string; payload: Record<string, unknown> },
  sourceNode: string,
) => postJson(`${baseUrl}/api/loop/relay`, { ...event, source_node: sourceNode });

export async function runFederationSimulation(
  nodeAUrl = process.env.LOOP_NODE_A_URL ?? `http://localhost:${config.port}`,
  nodeBUrl = process.env.LOOP_NODE_B_URL ?? 'http://localhost:8089',
) {
  const timeline: TimelineEvent[] = [];
  const now = new Date();

  const material = {
    '@context': 'https://loop-protocol.org/v0.1.1',
    '@type': 'MaterialDNA',
    schema_version: '0.1.1',
    id: buildMaterialId(now.getUTCFullYear()),
    category: 'plastic-pet',
    quantity: { value: 140, unit: 'kg' },
    quality: 0.92,
    origin_city: 'DEMO Munich',
    current_city: 'DEMO Munich',
    available_from: now.toISOString(),
  };

  const materialCreated = await postJson(`${nodeAUrl}/api/loop/materials`, material);
  timeline.push({ label: 'MaterialDNA registered', node: 'Node A', id: materialCreated.id, createdAt: materialCreated.created_at });
  await relayEvent(nodeBUrl, {
    event_type: 'material.created',
    entity_type: 'material',
    entity_id: material.id,
    payload: material,
  }, 'node-a');
  timeline.push({ label: 'MaterialDNA relayed', node: 'Node B', id: material.id, createdAt: new Date().toISOString() });

  const offer = {
    '@context': 'https://loop-protocol.org/v0.1.1',
    '@type': 'Offer',
    schema_version: '0.1.1',
    id: buildId('OFR'),
    material_id: material.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    quantity: { value: 110, unit: 'kg' },
    status: 'open',
    available_until: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    terms: 'Lab federation demo pickup',
  };

  const offerCreated = await postJson(`${nodeAUrl}/api/loop/offers`, offer);
  timeline.push({ label: 'Offer published', node: 'Node A', id: offerCreated.id, createdAt: offerCreated.created_at });
  await relayEvent(nodeBUrl, {
    event_type: 'offer.created',
    entity_type: 'offer',
    entity_id: offer.id,
    payload: offer,
  }, 'node-a');
  timeline.push({ label: 'Offer relayed', node: 'Node B', id: offer.id, createdAt: new Date().toISOString() });

  const match = {
    '@context': 'https://loop-protocol.org/v0.1.1',
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

  const matchCreated = await postJson(`${nodeAUrl}/api/loop/matches`, match);
  timeline.push({ label: 'Match accepted', node: 'Node A', id: matchCreated.id, createdAt: matchCreated.created_at });
  await relayEvent(nodeBUrl, {
    event_type: 'match.created',
    entity_type: 'match',
    entity_id: match.id,
    payload: match,
  }, 'node-a');
  timeline.push({ label: 'Match relayed', node: 'Node B', id: match.id, createdAt: new Date().toISOString() });

  const transfer = {
    '@context': 'https://loop-protocol.org/v0.1.1',
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

  const transferCreated = await postJson(`${nodeAUrl}/api/loop/transfers`, transfer);
  timeline.push({ label: 'Transfer completed', node: 'Node A', id: transferCreated.id, createdAt: transferCreated.created_at });
  await relayEvent(nodeBUrl, {
    event_type: 'transfer.created',
    entity_type: 'transfer',
    entity_id: transfer.id,
    payload: transfer,
  }, 'node-a');
  timeline.push({ label: 'Transfer relayed', node: 'Node B', id: transfer.id, createdAt: new Date().toISOString() });

  console.log('\nFederation demo timeline');
  console.log('-------------------------');
  for (const event of timeline) {
    console.log(`${event.createdAt} — ${event.label} (${event.node}, ${event.id})`);
  }

  return timeline;
}

if (import.meta.main) {
  runFederationSimulation()
    .catch((error) => {
      console.error('Federation simulation failed', error);
      process.exit(1);
    });
}
