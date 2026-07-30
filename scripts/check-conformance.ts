#!/usr/bin/env bun
/**
 * Three-way conformance gate: localloop-backend <-> loop-protocol <-> docs hub.
 *
 *   A. Backend schema copies must equal the canonical loop-protocol schemas
 *      (delegates to scripts/sync-schemas.ts --check).
 *   B. The docs-hub mirror (localloop-site/public/projects/loop-protocol) must
 *      carry byte-identical copies of the canonical schemas/, contexts/,
 *      docs/audit/, openapi.json, and SPECIFICATION.md. Skipped with a notice
 *      when the sibling site checkout is unavailable (e.g. backend-only CI).
 *   C. Every path+method in loop-protocol/openapi.json must be registered in
 *      the built Fastify app (spec-required endpoints may not drift).
 *
 * Exit code 1 when any check fails. Run via `bun run check:conformance`;
 * exercised in tests/conformance.test.ts and .github/workflows/protocol-parity.yml.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BACKEND_ROOT = join(import.meta.dirname, '..');
const REPO_ROOT = join(BACKEND_ROOT, '..');
const PROTOCOL_ROOT = join(REPO_ROOT, 'loop-protocol');
const SITE_MIRROR = join(REPO_ROOT, 'localloop-site', 'public', 'projects', 'loop-protocol');

let failures = 0;
const ok = (msg: string) => console.log(`[conformance] OK: ${msg}`);
const skip = (msg: string) => console.log(`[conformance] SKIP: ${msg}`);
const fail = (msg: string) => {
  console.error(`[conformance] FAIL: ${msg}`);
  failures += 1;
};

// --- Check A: backend schema copies ------------------------------------------
{
  const result = Bun.spawnSync(['bun', 'run', join(BACKEND_ROOT, 'scripts', 'sync-schemas.ts'), '--check']);
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  if (result.exitCode !== 0) {
    fail('backend schema copies drifted from loop-protocol canonical source');
  } else {
    ok('backend schema copies match loop-protocol');
  }
}

// --- Check B: docs-hub mirror -------------------------------------------------
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function compareFile(canonical: string, mirror: string, label: string) {
  if (!existsSync(mirror)) {
    fail(`${label}: missing from docs-hub mirror (${mirror})`);
    return;
  }
  if (readFileSync(canonical, 'utf8') !== readFileSync(mirror, 'utf8')) {
    fail(`${label}: docs-hub mirror drifted from canonical (${mirror})`);
  }
}

if (!existsSync(PROTOCOL_ROOT)) {
  skip('loop-protocol sibling checkout unavailable');
} else if (!existsSync(SITE_MIRROR)) {
  skip('docs-hub mirror unavailable (localloop-site sibling checkout missing)');
} else {
  let checked = 0;
  for (const rel of ['openapi.json', 'SPECIFICATION.md']) {
    compareFile(join(PROTOCOL_ROOT, rel), join(SITE_MIRROR, rel), rel);
    checked += 1;
  }
  for (const dir of ['schemas', 'contexts', 'docs/audit']) {
    const canonicalDir = join(PROTOCOL_ROOT, dir);
    for (const file of walk(canonicalDir)) {
      const rel = file.slice(canonicalDir.length + 1);
      compareFile(file, join(SITE_MIRROR, dir, rel), `${dir}/${rel}`);
      checked += 1;
    }
  }
  if (failures === 0) {
    ok(`docs-hub mirror matches canonical protocol artifacts (${checked} files)`);
  }
}

// --- Check C: spec route surface ----------------------------------------------
if (!existsSync(PROTOCOL_ROOT)) {
  skip('route-surface check requires loop-protocol sibling checkout');
} else {
  const openapi = JSON.parse(readFileSync(join(PROTOCOL_ROOT, 'openapi.json'), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const { buildServer } = await import('../src/server');
  const { pool } = await import('../src/db/pool');
  const app = await buildServer({ logger: false });
  await app.ready();

  const missing: string[] = [];
  for (const [path, operations] of Object.entries(openapi.paths)) {
    for (const method of Object.keys(operations)) {
      const url = path.replace(/\{([^}]+)\}/g, ':$1');
      if (!app.hasRoute({ method: method.toUpperCase() as never, url })) {
        missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }

  await app.close();
  await pool.end();

  if (missing.length > 0) {
    fail(`spec-required endpoints not implemented: ${missing.join(', ')}`);
  } else {
    ok(`all ${Object.keys(openapi.paths).length} openapi.json paths are implemented by the backend`);
  }
}

if (failures > 0) {
  console.error(`[conformance] ${failures} check(s) failed`);
  process.exit(1);
}
console.log('[conformance] all checks passed');
