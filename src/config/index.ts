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

  // Firebase Admin SDK
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '')
      .replace(/^["']|["']$/g, '')   // Render bazen tırnakları literal saklar, temizle
      .replace(/\\n/g, '\n'),         // \n → gerçek satır sonu
  },

  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },

  // Haremaltin.com historical data backfill
  // Set HAREMALTIN_CF_CLEARANCE from browser DevTools (Application → Cookies)
  haremaltin: {
    cfClearance: process.env.HAREMALTIN_CF_CLEARANCE || '',
  },
} as const;

export type Config = typeof config;
