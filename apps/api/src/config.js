export function getRuntimeConfig(env = process.env) {
  return {
    environment: env.SMARTFLN_ENV ?? 'development',
    host: env.SMARTFLN_API_HOST ?? '127.0.0.1',
    port: Number.parseInt(env.SMARTFLN_API_PORT ?? '8080', 10),
    serviceName: env.SMARTFLN_SERVICE_NAME ?? 'smartfln-api',
    logLevel: env.SMARTFLN_LOG_LEVEL ?? 'info',
    version: '0.1.0'
  };
}
