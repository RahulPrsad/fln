import { ApiError } from '../../common/http.js';
import { canAccessSchool, canManageRoster } from '../../common/authorization.js';

export async function getVisibleSchoolIds(request, store) {
  if (canManageRoster(request.auth)) {
    return null;
  }

  return request.auth.user.schoolIds ?? [];
}

export async function assertClassSectionAccess(request, store, classSectionId) {
  const section = await store.findClassSectionById(classSectionId, request.auth.user.tenantId);
  if (!section) {
    throw new ApiError(404, 'CLASS_SECTION_NOT_FOUND', 'Class section was not found.');
  }

  if (canAccessSchool(request.auth, section.schoolId)) {
    return section;
  }

  const assignments = await store.listTeacherAssignments({
    tenantId: request.auth.user.tenantId,
    classSectionId,
    userId: request.auth.user.id
  });
  if (assignments.length === 0) {
    throw new ApiError(403, 'FORBIDDEN', 'Class section is outside the authenticated user scope.');
  }

  return section;
}

export async function assertStudentAccess(request, store, studentId) {
  const student = await store.findStudentById(studentId, request.auth.user.tenantId);
  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student was not found.');
  }

  if (canAccessSchool(request.auth, student.schoolId)) {
    return student;
  }

  const enrollments = await store.listEnrollments({
    tenantId: request.auth.user.tenantId,
    studentId,
    status: 'active'
  });
  for (const enrollment of enrollments) {
    const assignments = await store.listTeacherAssignments({
      tenantId: request.auth.user.tenantId,
      classSectionId: enrollment.classSectionId,
      userId: request.auth.user.id
    });
    if (assignments.length > 0) {
      return student;
    }
  }

  throw new ApiError(403, 'FORBIDDEN', 'Student is outside the authenticated user scope.');
}
