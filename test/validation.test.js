const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInterest } = require('../src/validation');

test('valid interest payload passes', () => {
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
  assert.equal(result.ok, true);
  assert.equal(result.data.name, 'Jane Doe');
});

test('missing consentPublic fails', () => {
  const payload = {
    name: 'Jane Doe',
  };

  const result = validateInterest(payload);
  assert.equal(result.ok, false);
});

test('honeypot triggers spam detection', () => {
  const payload = {
    name: 'Jane Doe',
    consentPublic: true,
    honey: 'bots',
  };

  const result = validateInterest(payload);
  assert.equal(result.ok, false);
  assert.ok(result.errors.formErrors.includes('Spam detected.'));
});
