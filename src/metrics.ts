import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const counters = new Map<string, number>();

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
const PACKAGE_VERSION = readPackageVersion();

const startedAt = new Date();

export type MetricKey =
  | 'loop_material_created'
  | 'loop_product_created'
  | 'loop_material_status_updated'
  | 'loop_offer_created'
  | 'loop_match_created'
  | 'loop_transfer_created'
  | 'loop_transaction_created'
  | 'loop_event_emitted'
  | 'loop_event_relayed'
  | 'federation_handshake'
  | 'federation_announcement_received'
  | 'federation_offer_received'
  | 'queue_job_failed';

export function incrementMetric(key: MetricKey, amount = 1) {
  const current = counters.get(key) ?? 0;
  counters.set(key, current + amount);
}

const ALL_METRIC_KEYS: MetricKey[] = [
  'loop_material_created',
  'loop_product_created',
  'loop_material_status_updated',
  'loop_offer_created',
  'loop_match_created',
  'loop_transfer_created',
  'loop_transaction_created',
  'loop_event_emitted',
  'loop_event_relayed',
  'federation_handshake',
  'federation_announcement_received',
  'federation_offer_received',
  'queue_job_failed',
];

export function getMetricsSnapshot() {
  const metrics: Record<string, number> = {};
  for (const key of ALL_METRIC_KEYS) {
    metrics[key] = counters.get(key) ?? 0;
  }
  const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds,
    metrics,
    version: PACKAGE_VERSION,
  };
}
