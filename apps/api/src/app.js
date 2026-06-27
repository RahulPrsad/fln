import express from 'express';
import { getRuntimeConfig } from './config.js';
import { buildHealthPayload } from './health.js';
import { cors, errorHandler, notFound, requestContext } from './common/middleware.js';
import { sendSuccess } from './common/http.js';
import { requirePermission } from './common/authorization.js';
import { createAuditService } from './modules/audit/auditService.js';
import { createAcademicYearRouter } from './modules/academic-years/academicYearRoutes.js';
import { createAuthMiddleware } from './modules/auth/authMiddleware.js';
import { createAuthRouter } from './modules/auth/authRoutes.js';
import { createAuthService } from './modules/auth/authService.js';
import { createTokenService } from './modules/auth/tokenService.js';
import { createClassSectionRouter } from './modules/class-sections/classSectionRoutes.js';
import { createEnrollmentRouter } from './modules/enrollments/enrollmentRoutes.js';
import { createRosterImportRouter } from './modules/imports/rosterImportRoutes.js';
import { createMemoryStore } from './modules/platform/memoryStore.js';
import { createSchoolRouter } from './modules/schools/schoolRoutes.js';
import { createStudentRouter } from './modules/students/studentRoutes.js';
import { createAccessRouter } from './modules/users/accessRoutes.js';
import { createTenantRouter } from './modules/tenants/tenantRoutes.js';

export function createApp(overrides = {}) {
  const config = { ...getRuntimeConfig(), ...overrides };
  const store = overrides.store ?? createMemoryStore();
  const tokenService = createTokenService(config);
  const auditService = createAuditService(store);
  const authService = createAuthService({ store, tokenService, auditService, config });
  const requireAuth = createAuthMiddleware({ store, tokenService });
  const requireManageRoster = requirePermission('school:manage', 'roster:manage');
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
  app.use('/api/v1/schools', createSchoolRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1/academic-years', createAcademicYearRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1/class-sections', createClassSectionRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1/students/imports', createRosterImportRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1/students', createStudentRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1/enrollments', createEnrollmentRouter({ store, requireAuth, requireManageRoster }));
  app.use('/api/v1', createAccessRouter({ store, requireAuth }));

  app.use(notFound);
  app.use(errorHandler);

  return { app, config, store };
}
