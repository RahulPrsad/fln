import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../../common/http.js';

export function createTenantRouter({ store, requireAuth }) {
  const router = Router();

  router.get(
    '/current',
    requireAuth,
    asyncHandler(async (request, response) => {
      const tenant = await store.findTenantById(request.auth.user.tenantId);
      sendSuccess(response, tenant);
    })
  );

  return router;
}
