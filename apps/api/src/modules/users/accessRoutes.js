import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../../common/http.js';

export function createAccessRouter({ store, requireAuth }) {
  const router = Router();

  router.get(
    '/roles',
    requireAuth,
    asyncHandler(async (request, response) => {
      sendSuccess(response, await store.listRoles());
    })
  );

  router.get(
    '/permissions',
    requireAuth,
    asyncHandler(async (request, response) => {
      sendSuccess(response, await store.listPermissions());
    })
  );

  return router;
}
