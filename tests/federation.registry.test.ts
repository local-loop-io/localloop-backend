import { afterAll, describe, expect, it } from 'bun:test';
import { probeDatabase } from './dbReady';
import Fastify from 'fastify';
import { resolveNodeApiEndpoint } from '../src/federation/registry';
import { registerFederationRoutes } from '../src/routes/federation';
import { pool } from '../src/db/pool';

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

const dbReady = await probeDatabase('federation.registry');

describe('Federation registry lab boundary (SPEC-COMPLIANCE)', () => {
  it('has no route to remove or directly write a node outside the handshake', async () => {
    const { buildServer } = await import('../src/server');
    const app = await buildServer({ logger: false });

    try {
      for (const { method, url } of [
        { method: 'DELETE' as const, url: '/api/v1/federation/nodes/node-a.loop' },
        { method: 'PUT' as const, url: '/api/v1/federation/nodes/node-a.loop' },
        { method: 'POST' as const, url: '/api/v1/federation/nodes' },
      ]) {
        const response = await app.inject({ method, url });
        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe('NOT_FOUND');
      }
    } finally {
      await app.close();
    }
  });

  describe('handshake upsert semantics (real registry)', () => {
    const testNodeId = `test-registry-${Date.now()}.loop`;


    afterAll(async () => {
      if (dbReady) {
        await pool.query('DELETE FROM federation_nodes WHERE node_id = $1', [testNodeId]);
      }
    });

    const handshakePayload = (name: string) => ({
      '@context': 'https://localloop.urbnia.com/projects/loop-protocol/contexts/loop-v0.1.1.jsonld',
      '@type': 'NodeHandshake',
      schema_version: '0.1.1',
      node_id: testNodeId,
      name,
      endpoint: 'https://node-under-test.example.com',
      capabilities: ['material-registry'],
      timestamp: new Date().toISOString(),
    });

    it.skipIf(!dbReady)('repeated handshakes for the same node_id upsert in place, not duplicate', async () => {

      const app = Fastify({ logger: false });
      await registerFederationRoutes(app);

      try {
        const first = await app.inject({
          method: 'POST',
          url: '/api/v1/federation/handshake',
          payload: handshakePayload('Node Under Test v1'),
        });
        expect(first.statusCode).toBe(202);

        const second = await app.inject({
          method: 'POST',
          url: '/api/v1/federation/handshake',
          payload: handshakePayload('Node Under Test v2'),
        });
        expect(second.statusCode).toBe(202);

        const { rows } = await pool.query('SELECT name FROM federation_nodes WHERE node_id = $1', [testNodeId]);
        expect(rows.length).toBe(1);
        expect(rows[0].name).toBe('Node Under Test v2');

        const listResponse = await app.inject({ method: 'GET', url: '/api/v1/federation/nodes' });
        const body = listResponse.json() as { nodes: Array<{ node_id: string }> };
        const matches = body.nodes.filter((node) => node.node_id === testNodeId);
        expect(matches.length).toBe(1);
      } finally {
        await app.close();
      }
    });
  });
});
