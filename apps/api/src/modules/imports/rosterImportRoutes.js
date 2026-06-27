import { Router } from 'express';
import { assertSchoolAccess } from '../../common/authorization.js';
import { ApiError, asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { requiredString } from '../../common/validation.js';
import { createRosterImportService } from './rosterImportService.js';

export function createRosterImportRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();
  const rosterImportService = createRosterImportService(store);

  router.use(requireAuth);
  router.use(requireManageRoster);

  router.post(
    '/',
    asyncHandler(async (request, response) => {
      const schoolId = requiredString(request.body.schoolId, 'schoolId');
      assertSchoolAccess(request.auth, schoolId);
      const importJob = await rosterImportService.validate({
        tenantId: request.auth.user.tenantId,
        schoolId,
        academicYearId: requiredString(request.body.academicYearId, 'academicYearId'),
        classSectionId: requiredString(request.body.classSectionId, 'classSectionId'),
        createdByUserId: request.auth.user.id,
        body: request.body
      });
      sendCreated(response, importJob);
    })
  );

  router.get(
    '/:importId',
    asyncHandler(async (request, response) => {
      const importJob = await store.findRosterImportById(request.params.importId, request.auth.user.tenantId);
      if (!importJob) {
        throw new ApiError(404, 'IMPORT_NOT_FOUND', 'Roster import was not found.');
      }
      sendSuccess(response, importJob);
    })
  );

  router.post(
    '/:importId/commit',
    asyncHandler(async (request, response) => {
      const importJob = await store.findRosterImportById(request.params.importId, request.auth.user.tenantId);
      if (!importJob) {
        throw new ApiError(404, 'IMPORT_NOT_FOUND', 'Roster import was not found.');
      }
      sendSuccess(response, await rosterImportService.commit(importJob));
    })
  );

  return router;
}
