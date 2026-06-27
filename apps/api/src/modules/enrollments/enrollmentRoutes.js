import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../../common/http.js';
import { optionalString } from '../../common/validation.js';

export function createEnrollmentRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();

  router.use(requireAuth);
  router.use(requireManageRoster);

  router.patch(
    '/:enrollmentId',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await store.updateEnrollment(request.params.enrollmentId, request.auth.user.tenantId, request.body)
      );
    })
  );

  router.post(
    '/:enrollmentId/withdraw',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await store.withdrawEnrollment(
          request.params.enrollmentId,
          request.auth.user.tenantId,
          optionalString(request.body.endDate) || new Date().toISOString().slice(0, 10)
        )
      );
    })
  );

  return router;
}
