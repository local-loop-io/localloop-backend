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
        STORAGE_SECRET_KEY: 'strong-storage-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects empty DATABASE_URL password in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects malformed DATABASE_URL in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'not-a-valid-database-url',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects REDIS_URL without password in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
        REDIS_URL: 'redis://localhost:6381',
      }),
    ).rejects.toThrow('Insecure REDIS_URL for production');
  });

  it('rejects a short but not-blocklisted DATABASE_URL password in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:12345678@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
        REDIS_URL: 'redis://:StrongRedisPass456!@localhost:6381',
      }),
    ).rejects.toThrow('Insecure database password in DATABASE_URL for production');
  });

  it('rejects a short STORAGE_SECRET_KEY in production', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'short1',
        REDIS_URL: 'redis://:StrongRedisPass456!@localhost:6381',
      }),
    ).rejects.toThrow('Insecure STORAGE_SECRET_KEY for production');
  });

  it('rejects a weak BETTER_AUTH_SECRET in production when auth is enabled', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
        REDIS_URL: 'redis://:StrongRedisPass456!@localhost:6381',
        AUTH_ENABLED: 'true',
        BETTER_AUTH_SECRET: 'short1',
      }),
    ).rejects.toThrow('Insecure BETTER_AUTH_SECRET for production when auth is enabled');
  });

  it('rejects a weak API_KEY in production when API key protection is enabled', async () => {
    await expect(
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
        STORAGE_SECRET_KEY: 'strong-storage-secret',
        REDIS_URL: 'redis://:StrongRedisPass456!@localhost:6381',
        API_KEY_ENABLED: 'true',
        API_KEY: 'short1',
      }),
    ).rejects.toThrow('Insecure API_KEY for production when API key protection is enabled');
  });

  it('allows strong secrets in production', async () => {
    const module = await loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localloop:VeryStrongPass123!@localhost:55432/localloop',
      STORAGE_SECRET_KEY: 'strong-storage-secret',
      REDIS_URL: 'redis://:StrongRedisPass456!@localhost:6381',
    });

    expect(module.config.databaseUrl).toContain('VeryStrongPass123');
  });

  it('does not fail on non-production NODE_ENV values', async () => {
    const module = await loadConfig({
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgresql://localloop:change-me@localhost:55432/localloop',
      STORAGE_SECRET_KEY: 'change-me',
    });

    expect(module.config.databaseUrl).toContain('change-me');
  });
});
