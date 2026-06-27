import { Router } from 'express';
import { assertSchoolAccess, canManageRoster } from '../../common/authorization.js';
import { ApiError, asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { optionalString, requiredString } from '../../common/validation.js';
import { getVisibleSchoolIds } from '../roster/access.js';

export function createSchoolRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const schools = await store.listSchools({
        tenantId: request.auth.user.tenantId,
        schoolIds: await getVisibleSchoolIds(request, store)
      });
      sendSuccess(response, schools);
    })
  );

  router.post(
    '/',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const school = await store.createSchool({
        tenantId: request.auth.user.tenantId,
        name: requiredString(request.body.name, 'name'),
        code: requiredString(request.body.code, 'code'),
        city: optionalString(request.body.city),
        state: optionalString(request.body.state),
        address: optionalString(request.body.address),
        metadata: request.body.metadata ?? {}
      });
      sendCreated(response, school);
    })
  );

  router.get(
    '/:schoolId',
    asyncHandler(async (request, response) => {
      const school = await store.findSchoolById(request.params.schoolId, request.auth.user.tenantId);
      if (!school) {
        throw new ApiError(404, 'SCHOOL_NOT_FOUND', 'School was not found.');
      }
      assertSchoolAccess(request.auth, school.id);
      sendSuccess(response, school);
    })
  );

  router.patch(
    '/:schoolId',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      assertSchoolAccess(request.auth, request.params.schoolId);
      const school = await store.updateSchool(request.params.schoolId, request.auth.user.tenantId, request.body);
      sendSuccess(response, school);
    })
  );

  router.post(
    '/:schoolId/archive',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      assertSchoolAccess(request.auth, request.params.schoolId);
      const school = await store.archiveSchool(request.params.schoolId, request.auth.user.tenantId);
      sendSuccess(response, school);
    })
  );

  return router;
}
