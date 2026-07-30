import { describe, expect, it } from 'bun:test';
import { setNoStore, setNoStoreIfUnset, setPublicShortCache } from '../src/httpCache';

describe('httpCache helpers', () => {
  it('sets public max-age and no-store headers', () => {
    const headers: Record<string, string> = {};
    const reply = { header(k: string, v: string) { headers[k.toLowerCase()] = v; return reply; } } as any;
    setPublicShortCache(reply, 30);
    expect(headers['cache-control']).toBe('public, max-age=30');
    setNoStore(reply);
    expect(headers['cache-control']).toBe('no-store');
  });

  it('setNoStoreIfUnset skips when Cache-Control already set', () => {
    const headers: Record<string, string> = {
      'cache-control': 'public, max-age=30',
    };
    const reply = {
      header(k: string, v: string) {
        headers[k.toLowerCase()] = v;
        return reply;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
    } as any;
    setNoStoreIfUnset(reply);
    expect(headers['cache-control']).toBe('public, max-age=30');
  });

  it('setNoStoreIfUnset sets no-store when header absent', () => {
    const headers: Record<string, string> = {};
    const reply = {
      header(k: string, v: string) {
        headers[k.toLowerCase()] = v;
        return reply;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
    } as any;
    setNoStoreIfUnset(reply);
    expect(headers['cache-control']).toBe('no-store');
  });
});
