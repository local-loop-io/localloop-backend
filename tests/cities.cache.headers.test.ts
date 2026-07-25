import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerCityRoutes } from '../src/routes/cities';

describe('city routes Cache-Control', () => {
  it('returns Cache-Control: no-store on GET /api/cities', async () => {
    const app = Fastify({ logger: false });
    const sampleCity = {
      slug: 'demo-city',
      name: 'DEMO City',
      country: 'N/A',
      center: { type: 'Point' as const, coordinates: [0, 0] as [number, number] },
      created_at: new Date().toISOString(),
    };
    await registerCityRoutes(app, {
      listCities: async () => [sampleCity],
      listCitiesGeoJson: async () => ({ type: 'FeatureCollection', features: [] }),
      getCity: async () => sampleCity,
    });

    const response = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results[0].slug).toBe('demo-city');
  });
});
