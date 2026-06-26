export function buildHealthPayload(config, status = 'ok') {
  return {
    status,
    service: config.serviceName,
    environment: config.environment,
    version: config.version,
    timestamp: new Date().toISOString()
  };
}
