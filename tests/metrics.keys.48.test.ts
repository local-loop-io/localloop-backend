import { describe, expect, it } from 'bun:test';
import { getMetricsSnapshot } from '../src/metrics';
describe('metrics keys cycle 48', () => {
  it('emits a stable non-empty key set', () => {
    const snap = getMetricsSnapshot();
    expect(Object.keys(snap.metrics).length).toBeGreaterThanOrEqual(12);
    expect(snap.metrics).toHaveProperty('loop_material_created');
  });
});
