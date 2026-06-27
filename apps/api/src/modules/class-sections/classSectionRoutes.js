import { Router } from 'express';
import { assertSchoolAccess, canManageRoster } from '../../common/authorization.js';
import { asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { optionalString, requiredNumber, requiredString } from '../../common/validation.js';
import { assertClassSectionAccess, getVisibleSchoolIds } from '../roster/access.js';

export function createClassSectionRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const classSections = await store.listClassSections({
        tenantId: request.auth.user.tenantId,
        schoolIds: await getVisibleSchoolIds(request, store),
        assignedTeacherId: canManageRoster(request.auth) ? null : request.auth.user.id
      });
      sendSuccess(response, classSections);
    })
  );

  router.post(
    '/',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      assertSchoolAccess(request.auth, request.body.schoolId);
      const classSection = await store.createClassSection({
        tenantId: request.auth.user.tenantId,
        schoolId: requiredString(request.body.schoolId, 'schoolId'),
        academicYearId: requiredString(request.body.academicYearId, 'academicYearId'),
        gradeLevel: requiredNumber(request.body.gradeLevel, 'gradeLevel'),
        sectionName: requiredString(request.body.sectionName, 'sectionName'),
        medium: optionalString(request.body.medium)
      });
      sendCreated(response, classSection);
    })
  );

  router.get(
    '/:classSectionId',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await assertClassSectionAccess(request, store, request.params.classSectionId));
    })
  );

  router.patch(
    '/:classSectionId',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const classSection = await assertClassSectionAccess(request, store, request.params.classSectionId);
      assertSchoolAccess(request.auth, classSection.schoolId);
      sendSuccess(
        response,
        await store.updateClassSection(request.params.classSectionId, request.auth.user.tenantId, request.body)
      );
    })
  );

  router.post(
    '/:classSectionId/archive',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const classSection = await assertClassSectionAccess(request, store, request.params.classSectionId);
      assertSchoolAccess(request.auth, classSection.schoolId);
      sendSuccess(response, await store.archiveClassSection(request.params.classSectionId, request.auth.user.tenantId));
    })
  );

  router.get(
    '/:classSectionId/students',
    asyncHandler(async (request, response) => {
      await assertClassSectionAccess(request, store, request.params.classSectionId);
      sendSuccess(
        response,
        await store.listStudents({
          tenantId: request.auth.user.tenantId,
          classSectionId: request.params.classSectionId,
          status: 'active'
        })
      );
    })
  );

  router.get(
    '/:classSectionId/teachers',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const classSection = await assertClassSectionAccess(request, store, request.params.classSectionId);
      assertSchoolAccess(request.auth, classSection.schoolId);
      sendSuccess(
        response,
        await store.listTeacherAssignments({
          tenantId: request.auth.user.tenantId,
          classSectionId: request.params.classSectionId
        })
      );
    })
  );

  router.post(
    '/:classSectionId/teachers',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const classSection = await assertClassSectionAccess(request, store, request.params.classSectionId);
      assertSchoolAccess(request.auth, classSection.schoolId);
      const assignment = await store.assignTeacherToClassSection({
        tenantId: request.auth.user.tenantId,
        schoolId: classSection.schoolId,
        classSectionId: request.params.classSectionId,
        userId: requiredString(request.body.userId, 'userId')
      });
      sendCreated(response, assignment);
    })
  );

  router.delete(
    '/:classSectionId/teachers/:userId',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const classSection = await assertClassSectionAccess(request, store, request.params.classSectionId);
      assertSchoolAccess(request.auth, classSection.schoolId);
      await store.removeTeacherAssignment({
        tenantId: request.auth.user.tenantId,
        classSectionId: request.params.classSectionId,
        userId: request.params.userId
      });
      sendSuccess(response, { status: 'removed' });
    })
  );

  return router;
}
