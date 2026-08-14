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
  return `MAT-DE-MUC-${year}-PLASTIC-${unique}`;
};

const buildProductId = (year: number) => {
  const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PRD-DE-MUC-${year}-FURNITURE-${unique}`;
};

export async function runLabSimulation(baseUrl = `http://localhost:${config.port}`) {
  const timeline: TimelineEvent[] = [];
  const now = new Date();

  const material = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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

  const materialResponse = await fetch(`${baseUrl}/api/v1/material`, {
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
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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

  const offerResponse = await fetch(`${baseUrl}/api/v1/offer`, {
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
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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

  const matchResponse = await fetch(`${baseUrl}/api/v1/match`, {
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
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
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

  const transferResponse = await fetch(`${baseUrl}/api/v1/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transfer),
  });
  if (!transferResponse.ok) {
    throw new Error(`Transfer creation failed: ${await transferResponse.text()}`);
  }
  const transferCreated = await transferResponse.json();
  timeline.push({ label: 'Transfer completed', id: transferCreated.id, createdAt: transferCreated.created_at });

  // --- ProductDNA flow ---

  const product = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'ProductDNA',
    schema_version: '0.2.0',
    id: buildProductId(now.getUTCFullYear()),
    product_category: 'furniture-office',
    name: 'Standing Desk — Ergotron WorkFit',
    condition: 'good',
    quantity: { value: 5, unit: 'piece' },
    origin_city: 'DEMO Munich',
    current_city: 'DEMO Munich',
    available_from: now.toISOString(),
  };

  const productResponse = await fetch(`${baseUrl}/api/v1/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!productResponse.ok) {
    throw new Error(`Product creation failed: ${await productResponse.text()}`);
  }
  const productCreated = await productResponse.json();
  timeline.push({ label: 'ProductDNA registered', id: productCreated.id, createdAt: productCreated.created_at });

  const productOffer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Offer',
    schema_version: '0.2.0',
    id: buildId('OFR-PRD'),
    product_id: product.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    quantity: { value: 5, unit: 'piece' },
    status: 'open',
    available_until: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    terms: 'Lab demo product pickup',
  };

  const productOfferResponse = await fetch(`${baseUrl}/api/v1/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productOffer),
  });
  if (!productOfferResponse.ok) {
    throw new Error(`Product offer creation failed: ${await productOfferResponse.text()}`);
  }
  const productOfferCreated = await productOfferResponse.json();
  timeline.push({ label: 'Product offer published', id: productOfferCreated.id, createdAt: productOfferCreated.created_at });

  const productMatch = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Match',
    schema_version: '0.2.0',
    id: buildId('MCH-PRD'),
    product_id: product.id,
    offer_id: productOffer.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    status: 'accepted',
    matched_at: new Date(now.getTime() + 1000 * 60 * 60 * 5).toISOString(),
  };

  const productMatchResponse = await fetch(`${baseUrl}/api/v1/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productMatch),
  });
  if (!productMatchResponse.ok) {
    throw new Error(`Product match creation failed: ${await productMatchResponse.text()}`);
  }
  const productMatchCreated = await productMatchResponse.json();
  timeline.push({ label: 'Product match accepted', id: productMatchCreated.id, createdAt: productMatchCreated.created_at });

  const productTransfer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Transfer',
    schema_version: '0.2.0',
    id: buildId('TRF-PRD'),
    product_id: product.id,
    match_id: productMatch.id,
    status: 'completed',
    handoff_at: new Date(now.getTime() + 1000 * 60 * 60 * 6).toISOString(),
    received_at: new Date(now.getTime() + 1000 * 60 * 60 * 8).toISOString(),
  };

  const productTransferResponse = await fetch(`${baseUrl}/api/v1/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productTransfer),
  });
  if (!productTransferResponse.ok) {
    throw new Error(`Product transfer creation failed: ${await productTransferResponse.text()}`);
  }
  const productTransferCreated = await productTransferResponse.json();
  timeline.push({ label: 'Product transfer completed', id: productTransferCreated.id, createdAt: productTransferCreated.created_at });

  // --- Reusable-packaging flow (PPWR extension guidance — see profiles/packaging) ---

  const packagingCycleId = `POOL-CRATE-${now.getUTCFullYear()}-CYCLE-${crypto.randomUUID().replace(/-/g, '').slice(0, 3).toUpperCase()}`;
  const packagingProductId = `PRD-DE-MUC-${now.getUTCFullYear()}-CRATE-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const packagingProduct = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'ProductDNA',
    schema_version: '0.2.0',
    id: packagingProductId,
    product_category: 'packaging-reusable',
    name: 'Reusable Transport Crate — Pooled PPWR Asset',
    condition: 'good',
    quantity: { value: 40, unit: 'piece' },
    origin_city: 'DEMO Munich',
    current_city: 'DEMO Munich',
    available_from: now.toISOString(),
    passport: {
      passport_id: `PPWR-DE-MUC-${now.getUTCFullYear()}-${packagingCycleId.slice(-3)}`,
      passport_url: `https://example.com/dpp/packaging/DE-MUC-${now.getUTCFullYear()}-${packagingCycleId.slice(-3)}`,
      access_scope: 'role-based',
      visible_to: 'operator',
      supported_regimes: ['ppwr'],
    },
    traceability: {
      batch_id: packagingCycleId,
    },
  };

  const packagingProductResponse = await fetch(`${baseUrl}/api/v1/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packagingProduct),
  });
  if (!packagingProductResponse.ok) {
    throw new Error(`Reusable-packaging product creation failed: ${await packagingProductResponse.text()}`);
  }
  const packagingProductCreated = await packagingProductResponse.json();
  timeline.push({ label: 'Reusable-packaging product registered', id: packagingProductCreated.id, createdAt: packagingProductCreated.created_at });

  const packagingOffer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Offer',
    schema_version: '0.2.0',
    id: buildId('OFR-PKG'),
    product_id: packagingProduct.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    quantity: { value: 40, unit: 'piece' },
    status: 'open',
    available_until: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    terms: 'Lab demo pooled-packaging return leg',
  };

  const packagingOfferResponse = await fetch(`${baseUrl}/api/v1/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packagingOffer),
  });
  if (!packagingOfferResponse.ok) {
    throw new Error(`Reusable-packaging offer creation failed: ${await packagingOfferResponse.text()}`);
  }
  const packagingOfferCreated = await packagingOfferResponse.json();
  timeline.push({ label: 'Reusable-packaging offer published', id: packagingOfferCreated.id, createdAt: packagingOfferCreated.created_at });

  const packagingMatch = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Match',
    schema_version: '0.2.0',
    id: buildId('MCH-PKG'),
    product_id: packagingProduct.id,
    offer_id: packagingOffer.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    status: 'accepted',
    matched_at: new Date(now.getTime() + 1000 * 60 * 60 * 9).toISOString(),
  };

  const packagingMatchResponse = await fetch(`${baseUrl}/api/v1/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packagingMatch),
  });
  if (!packagingMatchResponse.ok) {
    throw new Error(`Reusable-packaging match creation failed: ${await packagingMatchResponse.text()}`);
  }
  const packagingMatchCreated = await packagingMatchResponse.json();
  timeline.push({ label: 'Reusable-packaging match accepted', id: packagingMatchCreated.id, createdAt: packagingMatchCreated.created_at });

  const packagingTransfer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Transfer',
    schema_version: '0.2.0',
    id: buildId('TRF-PKG'),
    product_id: packagingProduct.id,
    match_id: packagingMatch.id,
    status: 'completed',
    handoff_at: new Date(now.getTime() + 1000 * 60 * 60 * 10).toISOString(),
    received_at: new Date(now.getTime() + 1000 * 60 * 60 * 16).toISOString(),
    route: { from_city: 'DEMO Munich', to_city: 'DEMO Berlin', mode: 'road' },
    traceability: {
      batch_id: packagingCycleId,
    },
    passport: {
      passport_id: packagingProduct.passport.passport_id,
      access_scope: 'role-based',
      visible_to: 'operator',
    },
  };

  const packagingTransferResponse = await fetch(`${baseUrl}/api/v1/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packagingTransfer),
  });
  if (!packagingTransferResponse.ok) {
    throw new Error(`Reusable-packaging transfer creation failed: ${await packagingTransferResponse.text()}`);
  }
  const packagingTransferCreated = await packagingTransferResponse.json();
  timeline.push({ label: 'Reusable-packaging transfer completed', id: packagingTransferCreated.id, createdAt: packagingTransferCreated.created_at });

  // --- Municipal-reuse flow (Germany National Circular Economy Strategy signal —
  // municipal-node interoperability and reusable material identity, not a specific EU
  // passport regime, so this flow carries no passport/traceability regulatory fields) ---

  const municipalProductId = `PRD-DE-MUC-${now.getUTCFullYear()}-DEPOT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const municipalProduct = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'ProductDNA',
    schema_version: '0.2.0',
    id: municipalProductId,
    product_category: 'furniture-office',
    name: 'Refurbished Office Chairs — Municipal Reuse Depot Batch',
    condition: 'fair',
    lifecycle_stage: 'refurbished',
    quantity: { value: 18, unit: 'piece' },
    origin_city: 'DEMO Munich',
    current_city: 'DEMO Munich',
    available_from: now.toISOString(),
    reuse_potential: 'Refurbished by the DEMO Munich municipal reuse depot ahead of redistribution to a partner city hub.',
  };

  const municipalProductResponse = await fetch(`${baseUrl}/api/v1/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(municipalProduct),
  });
  if (!municipalProductResponse.ok) {
    throw new Error(`Municipal-reuse product creation failed: ${await municipalProductResponse.text()}`);
  }
  const municipalProductCreated = await municipalProductResponse.json();
  timeline.push({ label: 'Municipal-reuse product registered', id: municipalProductCreated.id, createdAt: municipalProductCreated.created_at });

  const municipalOffer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Offer',
    schema_version: '0.2.0',
    id: buildId('OFR-MUN'),
    product_id: municipalProduct.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    quantity: { value: 18, unit: 'piece' },
    status: 'open',
    available_until: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    terms: 'Municipal reuse depot redistribution to partner city hub',
  };

  const municipalOfferResponse = await fetch(`${baseUrl}/api/v1/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(municipalOffer),
  });
  if (!municipalOfferResponse.ok) {
    throw new Error(`Municipal-reuse offer creation failed: ${await municipalOfferResponse.text()}`);
  }
  const municipalOfferCreated = await municipalOfferResponse.json();
  timeline.push({ label: 'Municipal-reuse offer published', id: municipalOfferCreated.id, createdAt: municipalOfferCreated.created_at });

  const municipalMatch = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Match',
    schema_version: '0.2.0',
    id: buildId('MCH-MUN'),
    product_id: municipalProduct.id,
    offer_id: municipalOffer.id,
    from_city: 'DEMO Munich',
    to_city: 'DEMO Berlin',
    status: 'accepted',
    matched_at: new Date(now.getTime() + 1000 * 60 * 60 * 11).toISOString(),
  };

  const municipalMatchResponse = await fetch(`${baseUrl}/api/v1/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(municipalMatch),
  });
  if (!municipalMatchResponse.ok) {
    throw new Error(`Municipal-reuse match creation failed: ${await municipalMatchResponse.text()}`);
  }
  const municipalMatchCreated = await municipalMatchResponse.json();
  timeline.push({ label: 'Municipal-reuse match accepted', id: municipalMatchCreated.id, createdAt: municipalMatchCreated.created_at });

  const municipalTransfer = {
    '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.2.0.jsonld',
    '@type': 'Transfer',
    schema_version: '0.2.0',
    id: buildId('TRF-MUN'),
    product_id: municipalProduct.id,
    match_id: municipalMatch.id,
    status: 'completed',
    handoff_at: new Date(now.getTime() + 1000 * 60 * 60 * 12).toISOString(),
    received_at: new Date(now.getTime() + 1000 * 60 * 60 * 20).toISOString(),
    route: { from_city: 'DEMO Munich', to_city: 'DEMO Berlin', mode: 'road' },
  };

  const municipalTransferResponse = await fetch(`${baseUrl}/api/v1/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(municipalTransfer),
  });
  if (!municipalTransferResponse.ok) {
    throw new Error(`Municipal-reuse transfer creation failed: ${await municipalTransferResponse.text()}`);
  }
  const municipalTransferCreated = await municipalTransferResponse.json();
  timeline.push({ label: 'Municipal-reuse transfer completed', id: municipalTransferCreated.id, createdAt: municipalTransferCreated.created_at });

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
