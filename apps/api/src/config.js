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
    accessTokenTtl: env.SMARTFLN_ACCESS_TOKEN_TTL ?? '15m',
    refreshTokenTtl: env.SMARTFLN_REFRESH_TOKEN_TTL ?? '7d',
    mongoUri: env.SMARTFLN_MONGO_URI ?? 'mongodb://127.0.0.1:27017/smartfln',
    corsOrigins: (env.SMARTFLN_CORS_ORIGINS ?? defaultCorsOrigins)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    seedDemoUsers: env.SMARTFLN_SEED_DEMO_USERS !== 'false'
  };
}
