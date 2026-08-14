import { describe, expect, it } from 'bun:test';
import { createInterestJobHandler, getConnection } from '../src/queue';

describe('queue handlers', () => {
  it('ignores unrelated jobs', async () => {
    const handler = createInterestJobHandler({
      insertInterestEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    });

    const result = await handler({ name: 'other', data: {} });
    expect(result.status).toBe('ignored');
  });

  it('flags invalid interest payloads', async () => {
    const handler = createInterestJobHandler({
      insertInterestEvent: async () => ({ id: 1, created_at: new Date().toISOString() }),
    });

    const result = await handler({ name: 'interest:created', data: {} });
    expect(result.status).toBe('invalid');
  });

  it('logs interest events', async () => {
    const calls: Array<{ interestId: number; eventType: string }> = [];
    const handler = createInterestJobHandler({
      insertInterestEvent: async (input) => {
        calls.push({ interestId: input.interestId, eventType: input.eventType });
        return { id: 1, created_at: new Date().toISOString() };
      },
    });

    const result = await handler({
      name: 'interest:created',
      data: { id: 42, created_at: '2025-01-01T00:00:00Z' },
    });

    expect(result.status).toBe('logged');
    expect(calls[0].interestId).toBe(42);
    expect(calls[0].eventType).toBe('created');
  });

  it('does not crash the process when the Redis connection emits an error', () => {
    // Node throws an unhandled 'error' event synchronously when an
    // EventEmitter has zero listeners for it. getConnection() must register
    // one so a transient Redis blip can't take the whole API process down.
    const connection = getConnection();
    let thrown: unknown;
    try {
      connection.emit('error', new Error('synthetic redis error'));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeUndefined();
    connection.disconnect();
  });
});
