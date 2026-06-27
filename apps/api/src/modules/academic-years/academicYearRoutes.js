import { Router } from 'express';
import { ApiError, asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { optionalString, requireDateOrder, requiredString } from '../../common/validation.js';

export function createAcademicYearRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await store.listAcademicYears({ tenantId: request.auth.user.tenantId }));
    })
  );

  router.post(
    '/',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const startDate = requiredString(request.body.startDate, 'startDate');
      const endDate = requiredString(request.body.endDate, 'endDate');
      requireDateOrder(startDate, endDate);
      const academicYear = await store.createAcademicYear({
        tenantId: request.auth.user.tenantId,
        name: requiredString(request.body.name, 'name'),
        startDate,
        endDate,
        status: optionalString(request.body.status) || 'planned'
      });
      sendCreated(response, academicYear);
    })
  );

  router.get(
    '/:academicYearId',
    asyncHandler(async (request, response) => {
      const academicYear = await store.findAcademicYearById(request.params.academicYearId, request.auth.user.tenantId);
      if (!academicYear) {
        throw new ApiError(404, 'ACADEMIC_YEAR_NOT_FOUND', 'Academic year was not found.');
      }
      sendSuccess(response, academicYear);
    })
  );

  router.patch(
    '/:academicYearId',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const academicYear = await store.updateAcademicYear(
        request.params.academicYearId,
        request.auth.user.tenantId,
        request.body
      );
      sendSuccess(response, academicYear);
    })
  );

  router.post(
    '/:academicYearId/close',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      sendSuccess(response, await store.closeAcademicYear(request.params.academicYearId, request.auth.user.tenantId));
    })
  );

  return router;
}
