import { afterEach, describe, expect, it } from 'bun:test';

const originalEnv = { ...process.env };

const loadConfig = async (env: Record<string, string>) => {
  process.env = { ...originalEnv, ...env };
  return import(`../src/config.ts?case=${Math.random()}`);
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('production config security checks', () => {
  it('rejects known development default secrets in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:change-me@localhost:55432/localloop',
        MINIO_SECRET_KEY: 'strong-minio-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects empty DATABASE_URL password in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:@localhost:55432/localloop',
        MINIO_SECRET_KEY: 'strong-minio-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects malformed DATABASE_URL in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'not-a-valid-database-url',
        MINIO_SECRET_KEY: 'strong-minio-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('allows strong secrets in production', async () => {
    const module = await loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
      MINIO_SECRET_KEY: 'strong-minio-secret',
    });

    expect(module.config.databaseUrl).toContain('VeryStrongPass123');
  });

  it('does not fail on non-production NODE_ENV values', async () => {
    const module = await loadConfig({
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgresql://localloop:change-me@localhost:55432/localloop',
      MINIO_SECRET_KEY: 'change-me',
    });

    expect(module.config.databaseUrl).toContain('change-me');
  });
});
