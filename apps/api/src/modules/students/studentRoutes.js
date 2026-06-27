import { Router } from 'express';
import { assertSchoolAccess, canManageRoster } from '../../common/authorization.js';
import { asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { optionalString, requiredString } from '../../common/validation.js';
import { assertClassSectionAccess, assertStudentAccess, getVisibleSchoolIds } from '../roster/access.js';

async function getTeacherVisibleStudentIds(request, store) {
  const sections = await store.listClassSections({
    tenantId: request.auth.user.tenantId,
    assignedTeacherId: request.auth.user.id
  });
  const studentIds = new Set();
  for (const section of sections) {
    const enrollments = await store.listEnrollments({
      tenantId: request.auth.user.tenantId,
      classSectionId: section.id,
      status: 'active'
    });
    enrollments.forEach((enrollment) => studentIds.add(enrollment.studentId));
  }
  return [...studentIds];
}

export function createStudentRouter({ store, requireAuth, requireManageRoster }) {
  const router = Router();

  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      if (request.query.classSectionId) {
        await assertClassSectionAccess(request, store, request.query.classSectionId);
        sendSuccess(
          response,
          await store.listStudents({
            tenantId: request.auth.user.tenantId,
            classSectionId: request.query.classSectionId,
            status: request.query.status ?? 'active'
          })
        );
        return;
      }

      sendSuccess(
        response,
        await store.listStudents({
          tenantId: request.auth.user.tenantId,
          schoolIds: await getVisibleSchoolIds(request, store),
          studentIds: canManageRoster(request.auth) ? null : await getTeacherVisibleStudentIds(request, store),
          status: request.query.status ?? null
        })
      );
    })
  );

  router.post(
    '/',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const schoolId = requiredString(request.body.schoolId, 'schoolId');
      assertSchoolAccess(request.auth, schoolId);
      const student = await store.createStudent({
        tenantId: request.auth.user.tenantId,
        schoolId,
        externalStudentId: optionalString(request.body.externalStudentId),
        admissionNumber: optionalString(request.body.admissionNumber),
        displayName: requiredString(request.body.displayName, 'displayName'),
        dateOfBirth: optionalString(request.body.dateOfBirth),
        gender: optionalString(request.body.gender),
        metadata: request.body.metadata ?? {}
      });
      sendCreated(response, student);
    })
  );

  router.get(
    '/:studentId',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await assertStudentAccess(request, store, request.params.studentId));
    })
  );

  router.patch(
    '/:studentId',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const student = await assertStudentAccess(request, store, request.params.studentId);
      assertSchoolAccess(request.auth, student.schoolId);
      sendSuccess(response, await store.updateStudent(request.params.studentId, request.auth.user.tenantId, request.body));
    })
  );

  router.post(
    '/:studentId/archive',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const student = await assertStudentAccess(request, store, request.params.studentId);
      assertSchoolAccess(request.auth, student.schoolId);
      sendSuccess(response, await store.archiveStudent(request.params.studentId, request.auth.user.tenantId));
    })
  );

  router.get(
    '/:studentId/enrollments',
    asyncHandler(async (request, response) => {
      await assertStudentAccess(request, store, request.params.studentId);
      sendSuccess(
        response,
        await store.listEnrollments({
          tenantId: request.auth.user.tenantId,
          studentId: request.params.studentId
        })
      );
    })
  );

  router.post(
    '/:studentId/enrollments',
    requireManageRoster,
    asyncHandler(async (request, response) => {
      const student = await assertStudentAccess(request, store, request.params.studentId);
      assertSchoolAccess(request.auth, student.schoolId);
      const enrollment = await store.createEnrollment({
        tenantId: request.auth.user.tenantId,
        studentId: request.params.studentId,
        classSectionId: requiredString(request.body.classSectionId, 'classSectionId'),
        academicYearId: requiredString(request.body.academicYearId, 'academicYearId'),
        rollNumber: optionalString(request.body.rollNumber),
        startDate: optionalString(request.body.startDate) || new Date().toISOString().slice(0, 10)
      });
      sendCreated(response, enrollment);
    })
  );

  return router;
}
