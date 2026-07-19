#!/usr/bin/env bun
// Copies canonical schemas from the sibling loop-protocol repo into
// src/schemas/, so localloop-backend never hand-maintains a drifted duplicate.
// `bun run sync:schemas` refreshes the copies; `bun run check:schemas` (used in
// tests/CI) fails closed if the copies and the canonical source disagree.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  'transaction.schema.json',
  'loopsignal.schema.json',
  'node-info.schema.json',
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
];

type Mode = 'sync' | 'check';

function run(mode: Mode): boolean {
  if (!existsSync(SOURCE_BASE)) {
    // Mirrors scripts/check-protocol-parity.sh: without the sibling protocol
    // checkout (e.g. backend-only CI) there is nothing to compare against.
    // The full gate runs in .github/workflows/protocol-parity.yml, which
    // checks out all three repos.
    console.log('[sync-schemas] SKIP: loop-protocol sibling checkout unavailable.');
    return true;
  }

  let drift = false;
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
