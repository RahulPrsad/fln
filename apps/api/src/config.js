export function getRuntimeConfig(env = process.env) {
  const defaultCorsOrigins = 'http://127.0.0.1:5173,http://localhost:5173';

  return {
    environment: env.SMARTFLN_ENV ?? 'development',
    host: env.SMARTFLN_API_HOST ?? '127.0.0.1',
    port: Number.parseInt(env.SMARTFLN_API_PORT ?? env.PORT ?? '8080', 10),
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
    r2AccountId: env.SMARTFLN_R2_ACCOUNT_ID ?? '',
    r2AccessKeyId: env.SMARTFLN_R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: env.SMARTFLN_R2_SECRET_ACCESS_KEY ?? '',
    r2EndpointUrl: env.SMARTFLN_R2_ENDPOINT_URL ?? '',
    ocrProvider: env.SMARTFLN_OCR_PROVIDER ?? 'disabled',
    openaiApiKey: env.SMARTFLN_OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? '',
    openaiBaseUrl: env.SMARTFLN_OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiOcrModel: env.SMARTFLN_OPENAI_OCR_MODEL ?? 'gpt-5.5',
    openaiImageDetail: env.SMARTFLN_OPENAI_IMAGE_DETAIL ?? 'high',
    ocrRequestTimeoutMs: Number.parseInt(env.SMARTFLN_OCR_REQUEST_TIMEOUT_MS ?? '20000', 10),
    exportRetentionDays: Number.parseInt(env.SMARTFLN_EXPORT_RETENTION_DAYS ?? '7', 10),
    rateLimitWindowMs: Number.parseInt(env.SMARTFLN_RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    rateLimitMax: Number.parseInt(env.SMARTFLN_RATE_LIMIT_MAX ?? '300', 10),
    smsProvider: env.SMARTFLN_SMS_PROVIDER ?? 'disabled',
    twilioAccountSid: env.SMARTFLN_TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: env.SMARTFLN_TWILIO_AUTH_TOKEN ?? '',
    twilioFromNumber: env.SMARTFLN_TWILIO_FROM_NUMBER ?? '',
    emailProvider: env.SMARTFLN_EMAIL_PROVIDER ?? 'disabled',
    resendApiKey: env.SMARTFLN_RESEND_API_KEY ?? '',
    emailFrom: env.SMARTFLN_EMAIL_FROM ?? '',
    sentryDsn: env.SMARTFLN_SENTRY_DSN ?? '',
    corsOrigins: (env.SMARTFLN_CORS_ORIGINS ?? defaultCorsOrigins)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    seedDemoUsers: env.SMARTFLN_SEED_DEMO_USERS !== 'false'
  };
}
