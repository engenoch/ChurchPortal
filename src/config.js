import process from 'node:process';

// Node 20.12+ can load a .env file without any dependency. It is optional.
try {
  process.loadEnvFile();
} catch {
  /* no .env file — use defaults */
}

const bool = (value, fallback) =>
  value === undefined ? fallback : !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  host: process.env.HOST ?? '127.0.0.1',
  port: int(process.env.PORT, 3000),

  databasePath: process.env.DATABASE_PATH ?? './data/church.db',

  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  apiKey: process.env.API_KEY || null,

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: int(process.env.RATE_LIMIT_MAX, 300),
  },

  cache: {
    ttlSeconds: int(process.env.CACHE_TTL_SECONDS, 30),
    maxEntries: int(process.env.CACHE_MAX_ENTRIES, 500),
  },

  requestLog: bool(process.env.REQUEST_LOG, true),
  bodyLimit: process.env.BODY_LIMIT ?? '100kb',
  trustProxy: int(process.env.TRUST_PROXY, 0),
};

export default config;
