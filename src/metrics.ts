const counters = new Map<string, number>();
const startedAt = new Date();

export type MetricKey =
  | 'loop_material_created'
  | 'loop_offer_created'
  | 'loop_match_created'
  | 'loop_transfer_created'
  | 'loop_event_emitted';

export function incrementMetric(key: MetricKey, amount = 1) {
  const current = counters.get(key) ?? 0;
  counters.set(key, current + amount);
}

export function getMetricsSnapshot() {
  const metrics: Record<string, number> = {};
  for (const [key, value] of counters.entries()) {
    metrics[key] = value;
  }
  const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds,
    metrics,
  };
}
