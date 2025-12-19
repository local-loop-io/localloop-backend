import { describe, expect, it } from 'bun:test';
import { validateInterest } from '../src/validation';

describe('validateInterest', () => {
  it('accepts a valid payload', () => {
    const payload = {
      name: 'Jane Doe',
      organization: 'Circular Labs',
      role: 'Ops Lead',
      country: 'DE',
      city: 'Munich',
      website: 'https://example.com',
      email: 'jane@example.com',
      message: 'Interested in pilots.',
      shareEmail: true,
      consentPublic: true,
    };

    const result = validateInterest(payload);
    expect(result.ok).toBe(true);
  });

  it('rejects missing consent', () => {
    const result = validateInterest({ name: 'Jane Doe' });
    expect(result.ok).toBe(false);
  });

  it('rejects honeypot', () => {
    const result = validateInterest({ name: 'Jane Doe', consentPublic: true, honey: 'bot' });
    expect(result.ok).toBe(false);
  });
});
