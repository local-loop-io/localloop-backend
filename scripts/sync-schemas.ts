#!/usr/bin/env bun
// Copies canonical schemas from the sibling loop-protocol repo into
// src/schemas/, so localloop-backend never hand-maintains a drifted duplicate.
// `bun run sync:schemas` refreshes the copies; `bun run check:schemas` (used in
// tests/CI) fails closed if the copies and the canonical source disagree.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_BASE = join(REPO_ROOT, 'loop-protocol', 'schemas');
const SOURCE_CORE_DP = join(REPO_ROOT, 'loop-protocol', 'profiles', 'core-dp', 'schemas');
const DEST_BASE = join(import.meta.dirname, '..', 'src', 'schemas');
const DEST_CORE_DP = join(DEST_BASE, 'core-dp');

const BASE_SCHEMAS = [
  'material-dna.schema.json',
  'product-dna.schema.json',
  'offer.schema.json',
  'match.schema.json',
  'transfer.schema.json',
  'material-status.schema.json',
  'transaction.schema.json',
  'loopsignal.schema.json',
  'node-info.schema.json',
  'handshake.schema.json',
  'federate-accepted.schema.json',
];

const CORE_DP_SCHEMAS = [
  'error.schema.json',
  'evidence-entry.schema.json',
  'search-contract.schema.json',
  'envelope.schema.json',
  'peer-key-trust.schema.json',
  'trust-store.schema.json',
  'choreography-message.schema.json',
  'dna-operation.schema.json',
  'epcis-mapping.schema.json',
];

// Canonical base schemas that are deliberately NOT copied into the backend:
// loopcoin is reserved/unimplemented (see loop-protocol/schemas/README.md).
const BASE_SCHEMAS_NOT_COPIED = ['loopcoin.schema.json'];

type Mode = 'sync' | 'check';

function run(mode: Mode): boolean {
  if (!existsSync(SOURCE_BASE)) {
    // Without the sibling protocol checkout (e.g. backend-only CI) there is
    // nothing to compare against. The full gate runs in
    // .github/workflows/protocol-parity.yml, which checks out all three repos.
    // Only report success when the caller explicitly allows the skip, so a
    // misconfigured local checkout cannot pass the gate vacuously.
    if (process.env.SCHEMA_SYNC_ALLOW_MISSING === '1') {
      console.log('[sync-schemas] SKIP: loop-protocol sibling checkout unavailable (SCHEMA_SYNC_ALLOW_MISSING=1).');
      return true;
    }
    console.error(`[sync-schemas] loop-protocol sibling checkout not found at ${SOURCE_BASE}. Clone it next to this repo, or set SCHEMA_SYNC_ALLOW_MISSING=1 to skip.`);
    return false;
  }

  let drift = false;

  // Self-check for the base schema directory (same reason as the core-dp one
  // below): material-status.schema.json was missing from BASE_SCHEMAS and so
  // was never drift-checked even though the backend validates against it.
  const actualBaseFiles = readdirSync(SOURCE_BASE).filter((name) => name.endsWith('.schema.json'));
  const baseMissingFromManifest = actualBaseFiles.filter((name) => !BASE_SCHEMAS.includes(name) && !BASE_SCHEMAS_NOT_COPIED.includes(name));
  const baseMissingFromDisk = BASE_SCHEMAS.filter((name) => !actualBaseFiles.includes(name));
  for (const name of baseMissingFromManifest) {
    console.error(`[sync-schemas] MANIFEST DRIFT: ${name} exists in loop-protocol/schemas/ but is missing from BASE_SCHEMAS (or BASE_SCHEMAS_NOT_COPIED) in scripts/sync-schemas.ts`);
    drift = true;
  }
  for (const name of baseMissingFromDisk) {
    console.error(`[sync-schemas] MANIFEST DRIFT: ${name} is listed in BASE_SCHEMAS but no longer exists in loop-protocol/schemas/`);
    drift = true;
  }

  // Self-check: catch a future new file landing in loop-protocol's core-dp
  // schemas directory that CORE_DP_SCHEMAS hasn't been told about yet — the
  // per-file loop below can only ever compare files already in this list, so
  // an omission here would otherwise never be flagged (see epcis-mapping.schema.json,
  // which drifted undetected for this exact reason).
  if (existsSync(SOURCE_CORE_DP)) {
    const actualCoreDpFiles = readdirSync(SOURCE_CORE_DP).filter((name) => name.endsWith('.schema.json'));
    const missingFromManifest = actualCoreDpFiles.filter((name) => !CORE_DP_SCHEMAS.includes(name));
    const missingFromDisk = CORE_DP_SCHEMAS.filter((name) => !actualCoreDpFiles.includes(name));
    if (missingFromManifest.length > 0 || missingFromDisk.length > 0) {
      for (const name of missingFromManifest) {
        console.error(`[sync-schemas] MANIFEST DRIFT: ${name} exists in loop-protocol/profiles/core-dp/schemas/ but is missing from CORE_DP_SCHEMAS in scripts/sync-schemas.ts`);
      }
      for (const name of missingFromDisk) {
        console.error(`[sync-schemas] MANIFEST DRIFT: ${name} is listed in CORE_DP_SCHEMAS but no longer exists in loop-protocol/profiles/core-dp/schemas/`);
      }
      drift = true;
    }
  }

  const jobs = [
    ...BASE_SCHEMAS.map((name) => ({ src: join(SOURCE_BASE, name), dest: join(DEST_BASE, name) })),
    ...CORE_DP_SCHEMAS.map((name) => ({ src: join(SOURCE_CORE_DP, name), dest: join(DEST_CORE_DP, name) })),
  ];

  for (const { src, dest } of jobs) {
    if (!existsSync(src)) {
      console.error(`[sync-schemas] MISSING canonical source: ${src}`);
      drift = true;
      continue;
    }
    const content = readFileSync(src, 'utf8');

    if (mode === 'check') {
      if (!existsSync(dest) || readFileSync(dest, 'utf8') !== content) {
        console.error(`[sync-schemas] DRIFT: ${dest} does not match ${src}`);
        drift = true;
      }
      continue;
    }

    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    console.log(`[sync-schemas] synced ${dest}`);
  }

  if (drift) {
    if (mode === 'check') {
      console.error('[sync-schemas] Backend schema copies are out of sync with loop-protocol. Run `bun run sync:schemas`.');
    }
    return false;
  }

  if (mode === 'check') {
    console.log('[sync-schemas] OK — backend schemas match loop-protocol canonical source.');
  }
  return true;
}

const mode: Mode = process.argv.includes('--check') ? 'check' : 'sync';
const ok = run(mode);
if (!ok) {
  process.exit(1);
}
