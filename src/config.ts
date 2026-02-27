import { z } from 'zod';

const booleanFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const isProduction = process.env.NODE_ENV === 'production';

// Validate that required secrets are set in production
const validateProductionSecrets = () => {
  const requiredSecrets = ['DATABASE_URL', 'MINIO_SECRET_KEY'];
  const missing = requiredSecrets.filter((key) => !process.env[key]);
  if (isProduction && missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(', ')}. ` +
      'These must be explicitly set and cannot use defaults.'
    );
  }
};

validateProductionSecrets();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(8088),
  DATABASE_URL: isProduction
    ? z.string().min(1, 'DATABASE_URL is required in production')
    : z.string().default('postgresql://localloop:localloop_dev@localhost:55432/localloop'),
  DATABASE_SSL: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().default(10),
  PUBLIC_LIMIT: z.coerce.number().default(100),
  ALLOWED_ORIGINS: z.string().default('https://local-loop-io.github.io'),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  RATE_LIMIT_WRITE_MAX: z.coerce.number().default(20),
  RATE_LIMIT_WINDOW: z.string().default('15 minutes'),
  RATE_LIMIT_WRITE_WINDOW: z.string().default('15 minutes'),
  SSE_KEEPALIVE_MS: z.coerce.number().default(25000),
  SSE_MAX_CLIENTS: z.coerce.number().default(200),
  BODY_LIMIT: z.coerce.number().default(1048576),
  RUN_MIGRATIONS: z.string().optional(),
  SEARCH_REFRESH_ON_WRITE: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6381'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9200),
  MINIO_ACCESS_KEY: z.string().default('localloop'),
  MINIO_SECRET_KEY: isProduction
    ? z.string().min(1, 'MINIO_SECRET_KEY is required in production')
    : z.string().default('localloop_dev_secret'),
  MINIO_BUCKET: z.string().default('localloop-assets'),
  MINIO_USE_SSL: z.string().optional(),
  PUBLIC_BASE_URL: z.string().default('https://loop-api.urbnia.com'),
  NODE_ID: z.string().default('lab-hub.loop'),
  NODE_NAME: z.string().default('LocalLoop Lab Hub'),
  NODE_CAPABILITIES: z.string().default('material-registry,lab-relay'),
  AUTH_TRUSTED_ORIGINS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  AUTH_ENABLED: z.string().optional(),
  API_KEY: z.string().optional(),
  API_KEY_ENABLED: z.string().optional(),
  WORKER_ENABLED: z.string().optional(),
  PAYMENTS_ENABLED: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

const weakSecrets = new Set([
  'change-me',
  'password',
  'secret',
  'default',
]);

const hasWeakDatabasePassword = (databaseUrl: string) => {
  try {
    const password = new URL(databaseUrl).password;
    if (!password) return true;
    return weakSecrets.has(password.toLowerCase());
  } catch {
    return true;
  }
};

const ensureSecureProductionConfig = () => {
  if (parsed.NODE_ENV.toLowerCase() !== 'production') return;

  if (weakSecrets.has(parsed.MINIO_SECRET_KEY.toLowerCase())) {
    throw new Error('Insecure MINIO_SECRET_KEY for production');
  }
  if (hasWeakDatabasePassword(parsed.DATABASE_URL)) {
    throw new Error('Insecure database password in DATABASE_URL for production');
  }
  if (booleanFromEnv(parsed.AUTH_ENABLED, false)) {
    if (!parsed.BETTER_AUTH_SECRET || weakSecrets.has(parsed.BETTER_AUTH_SECRET.toLowerCase())) {
      throw new Error('Insecure BETTER_AUTH_SECRET for production when auth is enabled');
    }
  }
  if (booleanFromEnv(parsed.API_KEY_ENABLED, false)) {
    if (!parsed.API_KEY || weakSecrets.has(parsed.API_KEY.toLowerCase())) {
      throw new Error('Insecure API_KEY for production when API key protection is enabled');
    }
  }
};

ensureSecureProductionConfig();

export const config = {
  port: parsed.PORT,
  databaseUrl: parsed.DATABASE_URL,
  databaseSsl: booleanFromEnv(parsed.DATABASE_SSL, false),
  dbPoolSize: parsed.DB_POOL_SIZE,
  publicLimit: parsed.PUBLIC_LIMIT,
  allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
  rateLimitMax: parsed.RATE_LIMIT_MAX,
  rateLimitWriteMax: parsed.RATE_LIMIT_WRITE_MAX,
  rateLimitWindow: parsed.RATE_LIMIT_WINDOW,
  rateLimitWriteWindow: parsed.RATE_LIMIT_WRITE_WINDOW,
  sseKeepAliveMs: parsed.SSE_KEEPALIVE_MS,
  sseMaxClients: parsed.SSE_MAX_CLIENTS,
  bodyLimit: parsed.BODY_LIMIT,
  runMigrations: booleanFromEnv(parsed.RUN_MIGRATIONS, true),
  refreshSearchOnWrite: booleanFromEnv(parsed.SEARCH_REFRESH_ON_WRITE, true),
  redisUrl: parsed.REDIS_URL,
  minio: {
    endpoint: parsed.MINIO_ENDPOINT,
    port: parsed.MINIO_PORT,
    accessKey: parsed.MINIO_ACCESS_KEY,
    secretKey: parsed.MINIO_SECRET_KEY,
    bucket: parsed.MINIO_BUCKET,
    useSSL: booleanFromEnv(parsed.MINIO_USE_SSL, false),
  },
  publicBaseUrl: parsed.PUBLIC_BASE_URL,
  auth: {
    enabled: booleanFromEnv(parsed.AUTH_ENABLED, false),
    secret: parsed.BETTER_AUTH_SECRET,
    trustedOrigins: (parsed.AUTH_TRUSTED_ORIGINS || parsed.ALLOWED_ORIGINS)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    apiKey: parsed.API_KEY,
    apiKeyEnabled: booleanFromEnv(parsed.API_KEY_ENABLED, false),
  },
  node: {
    id: parsed.NODE_ID,
    name: parsed.NODE_NAME,
    capabilities: parsed.NODE_CAPABILITIES.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },
  workerEnabled: booleanFromEnv(parsed.WORKER_ENABLED, false),
  paymentsEnabled: booleanFromEnv(parsed.PAYMENTS_ENABLED, false),
};
