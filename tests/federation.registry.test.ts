import { describe, expect, it } from 'bun:test';
import { resolveNodeApiEndpoint } from '../src/federation/registry';

describe('federation registry helpers', () => {
  it('appends the API prefix when PUBLIC_BASE_URL is a site origin', () => {
    expect(resolveNodeApiEndpoint('https://loop-api.urbnia.com')).toBe('https://loop-api.urbnia.com/api/v1');
    expect(resolveNodeApiEndpoint('https://loop-api.urbnia.com/')).toBe('https://loop-api.urbnia.com/api/v1');
  });

  it('preserves already-prefixed API roots', () => {
    expect(resolveNodeApiEndpoint('https://loop-api.urbnia.com/api/v1')).toBe('https://loop-api.urbnia.com/api/v1');
    expect(resolveNodeApiEndpoint('https://loop-api.urbnia.com/api/v1/')).toBe('https://loop-api.urbnia.com/api/v1');
  });
});
