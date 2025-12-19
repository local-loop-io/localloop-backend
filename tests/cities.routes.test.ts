import { describe, expect, it } from 'bun:test';
import Fastify from 'fastify';
import { registerCityRoutes } from '../src/routes/cities';

const buildApp = () => {
  const app = Fastify({ logger: false });

  const sampleCity = {
    slug: 'demo-city',
    name: 'DEMO City',
    country: 'N/A',
    center: { type: 'Point', coordinates: [0, 0] as [number, number] },
    created_at: new Date().toISOString(),
  };

  const deps = {
    listCities: async () => [sampleCity],
    listCitiesGeoJson: async () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: sampleCity.center,
          properties: {
            slug: sampleCity.slug,
            name: sampleCity.name,
            country: sampleCity.country,
            created_at: sampleCity.created_at,
            distance_m: null,
          },
        },
      ],
    }),
    getCity: async (slug: string) => (slug === sampleCity.slug ? sampleCity : null),
  };

  return { app, deps };
};

describe('city routes', () => {
  it('lists cities', async () => {
    const { app, deps } = buildApp();
    await registerCityRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/cities' });
    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].slug).toBe('demo-city');
  });

  it('returns geojson list', async () => {
    const { app, deps } = buildApp();
    await registerCityRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/cities/geojson' });
    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.type).toBe('FeatureCollection');
    expect(payload.features).toHaveLength(1);
  });

  it('rejects invalid bbox query', async () => {
    const { app, deps } = buildApp();
    await registerCityRoutes(app, deps);

    const response = await app.inject({ method: 'GET', url: '/api/cities?bbox=bad' });
    expect(response.statusCode).toBe(400);
  });
});
