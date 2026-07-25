import { describe, expect, it } from 'bun:test';
import { setNoStore, setPublicShortCache } from '../src/httpCache';

describe('httpCache helpers', () => {
  it('sets public max-age and no-store headers', () => {
    const headers: Record<string, string> = {};
    const reply = { header(k: string, v: string) { headers[k.toLowerCase()] = v; return reply; } } as any;
    setPublicShortCache(reply, 30);
    expect(headers['cache-control']).toBe('public, max-age=30');
    setNoStore(reply);
    expect(headers['cache-control']).toBe('no-store');
  });
});
