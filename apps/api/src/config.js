export function getRuntimeConfig(env = process.env) {
  const defaultCorsOrigins = 'http://127.0.0.1:5173,http://localhost:5173';

  return {
    environment: env.SMARTFLN_ENV ?? 'development',
    host: env.SMARTFLN_API_HOST ?? '127.0.0.1',
    port: Number.parseInt(env.SMARTFLN_API_PORT ?? '8080', 10),
    serviceName: env.SMARTFLN_SERVICE_NAME ?? 'smartfln-api',
    logLevel: env.SMARTFLN_LOG_LEVEL ?? 'info',
    version: '0.1.0',
    jwtSecret: env.SMARTFLN_JWT_SECRET ?? 'dev-only-smartfln-secret-change-me',
    qrSigningSecret: env.SMARTFLN_QR_SIGNING_SECRET ?? 'dev-only-qr-secret-change-me',
    accessTokenTtl: env.SMARTFLN_ACCESS_TOKEN_TTL ?? '15m',
    refreshTokenTtl: env.SMARTFLN_REFRESH_TOKEN_TTL ?? '7d',
    storeProvider: env.SMARTFLN_STORE_PROVIDER ?? 'memory',
    mongoUri: env.SMARTFLN_MONGO_URI ?? 'mongodb://127.0.0.1:27017/smartfln',
    mongoDbName: env.SMARTFLN_MONGO_DB_NAME ?? 'smartfln',
    publicAppUrl: env.SMARTFLN_PUBLIC_APP_URL ?? 'http://127.0.0.1:5173',
    publicApiUrl: env.SMARTFLN_PUBLIC_API_URL ?? 'http://127.0.0.1:8080',
    objectStorageProvider: env.SMARTFLN_OBJECT_STORAGE_PROVIDER ?? 'local',
    objectStorageBucket: env.SMARTFLN_OBJECT_STORAGE_BUCKET ?? 'smartfln-local',
    exportRetentionDays: Number.parseInt(env.SMARTFLN_EXPORT_RETENTION_DAYS ?? '7', 10),
    rateLimitWindowMs: Number.parseInt(env.SMARTFLN_RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    rateLimitMax: Number.parseInt(env.SMARTFLN_RATE_LIMIT_MAX ?? '300', 10),
    corsOrigins: (env.SMARTFLN_CORS_ORIGINS ?? defaultCorsOrigins)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    seedDemoUsers: env.SMARTFLN_SEED_DEMO_USERS !== 'false'
  };
}
