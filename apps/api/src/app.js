import express from 'express';
import { getRuntimeConfig } from './config.js';
import { buildHealthPayload } from './health.js';
import { cors, errorHandler, notFound, requestContext } from './common/middleware.js';
import { sendSuccess } from './common/http.js';
import { createAuditService } from './modules/audit/auditService.js';
import { createAuthMiddleware } from './modules/auth/authMiddleware.js';
import { createAuthRouter } from './modules/auth/authRoutes.js';
import { createAuthService } from './modules/auth/authService.js';
import { createTokenService } from './modules/auth/tokenService.js';
import { createMemoryStore } from './modules/platform/memoryStore.js';
import { createAccessRouter } from './modules/users/accessRoutes.js';
import { createTenantRouter } from './modules/tenants/tenantRoutes.js';

export function createApp(overrides = {}) {
  const config = { ...getRuntimeConfig(), ...overrides };
  const store = overrides.store ?? createMemoryStore();
  const tokenService = createTokenService(config);
  const auditService = createAuditService(store);
  const authService = createAuthService({ store, tokenService, auditService, config });
  const requireAuth = createAuthMiddleware({ store, tokenService });
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(cors(config));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health/live', (request, response) => {
    sendSuccess(response, buildHealthPayload(config));
  });

  app.get('/health/ready', (request, response) => {
    sendSuccess(response, buildHealthPayload(config));
  });

  app.get('/version', (request, response) => {
    sendSuccess(response, {
      service: config.serviceName,
      environment: config.environment,
      version: config.version
    });
  });

  app.use('/api/v1/auth', createAuthRouter({ authService, requireAuth }));
  app.use('/api/v1/tenants', createTenantRouter({ store, requireAuth }));
  app.use('/api/v1', createAccessRouter({ store, requireAuth }));

  app.use(notFound);
  app.use(errorHandler);

  return { app, config, store };
}
