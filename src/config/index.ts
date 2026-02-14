export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5050', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/valora_dev',

  // API
  apiKey: process.env.API_KEY || 'vla_8C36F8B39E4340BCAD1AD20F6F7E2186',

  // Rate Limiting
  rateLimit: {
    ipPoints: parseInt(process.env.RATE_LIMIT_IP_POINTS || '100', 10),
    apiKeyPoints: parseInt(process.env.RATE_LIMIT_API_KEY_POINTS || '300', 10),
    expensivePoints: parseInt(process.env.RATE_LIMIT_EXPENSIVE_POINTS || '20', 10),
  },

  // Caching
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
    maxStaleSeconds: parseInt(process.env.MAX_STALE_SECONDS || '900', 10), // 15 minutes
  },

  // Refresh
  refresh: {
    metalsCron: process.env.METALS_REFRESH_CRON || '*/5 * * * *',
    fxCron: process.env.FX_REFRESH_CRON || '*/10 * * * *',
    cooldownMs: parseInt(process.env.COOLDOWN_MS || '10000', 10),
  },

  // JWT Authentication
  jwtSecret: process.env.JWT_SECRET || 'valora-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
} as const;

export type Config = typeof config;
