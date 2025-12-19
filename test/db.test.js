const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../src/db');

test('insert and list interests', () => {
  const database = createDatabase(':memory:');
  const created = database.insertInterest({
    name: 'Alex',
    organization: 'Loop City',
    shareEmail: false,
    consentPublic: true,
  });

  assert.ok(created.id);
  const list = database.listInterests(10);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Alex');
});
