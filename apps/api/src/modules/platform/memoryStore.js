import { randomUUID } from 'node:crypto';
import { createSeedData } from './seedData.js';
import { ApiError } from '../../common/http.js';

function clone(value) {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function activeOnly(record) {
  return record.status !== 'archived';
}

function sameTenant(record, tenantId) {
  return record?.tenantId === tenantId;
}

function byTenant(collection, tenantId) {
  return [...collection.values()].filter((record) => sameTenant(record, tenantId));
}

function findUniqueBy(collection, predicate, message) {
  const match = [...collection.values()].find(predicate);
  if (match) {
    throw new ApiError(409, 'RESOURCE_CONFLICT', message);
  }
}

export function createMemoryStore(seed = createSeedData()) {
  const tenants = new Map(seed.tenants.map((tenant) => [tenant.id, tenant]));
  const schools = new Map((seed.schools ?? []).map((school) => [school.id, school]));
  const academicYears = new Map((seed.academicYears ?? []).map((year) => [year.id, year]));
  const classSections = new Map((seed.classSections ?? []).map((section) => [section.id, section]));
  const users = new Map(seed.users.map((user) => [user.id, user]));
  const roles = new Map(seed.roles.map((role) => [role.key, role]));
  const permissions = new Map(seed.permissions.map((permission) => [permission.key, permission]));
  const teacherAssignments = new Map(
    (seed.teacherAssignments ?? []).map((assignment) => [assignment.id, assignment])
  );
  const students = new Map((seed.students ?? []).map((student) => [student.id, student]));
  const enrollments = new Map((seed.enrollments ?? []).map((enrollment) => [enrollment.id, enrollment]));
  const rosterImports = new Map();
  const sessions = new Map();
  const otpChallenges = new Map();
  const auditEvents = [];

  function getTenantResource(collection, id, tenantId, code = 'RESOURCE_NOT_FOUND') {
    const record = collection.get(id);
    if (!record || !sameTenant(record, tenantId)) {
      throw new ApiError(404, code, 'Requested resource was not found.');
    }

    return record;
  }

  function ensureSchool(tenantId, schoolId) {
    return getTenantResource(schools, schoolId, tenantId, 'SCHOOL_NOT_FOUND');
  }

  function ensureAcademicYear(tenantId, academicYearId) {
    return getTenantResource(academicYears, academicYearId, tenantId, 'ACADEMIC_YEAR_NOT_FOUND');
  }

  function ensureClassSection(tenantId, classSectionId) {
    return getTenantResource(classSections, classSectionId, tenantId, 'CLASS_SECTION_NOT_FOUND');
  }

  function ensureStudent(tenantId, studentId) {
    return getTenantResource(students, studentId, tenantId, 'STUDENT_NOT_FOUND');
  }

  function ensureEnrollment(tenantId, enrollmentId) {
    return getTenantResource(enrollments, enrollmentId, tenantId, 'ENROLLMENT_NOT_FOUND');
  }

  return {
    demoPassword: seed.demoPassword,
    async findUserByEmail(email) {
      const normalized = normalize(email).toLowerCase();
      const user = [...users.values()].find((item) => item.email.toLowerCase() === normalized);
      return user ? clone(user) : null;
    },
    async findUserByPhone(phone) {
      const user = [...users.values()].find((item) => item.phone === phone);
      return user ? clone(user) : null;
    },
    async findUserById(id) {
      const user = users.get(id);
      return user ? clone(user) : null;
    },
    async findTenantById(id) {
      const tenant = tenants.get(id);
      return tenant ? clone(tenant) : null;
    },
    async listRoles() {
      return [...roles.values()].map(clone);
    },
    async listPermissions() {
      return [...permissions.values()].map(clone);
    },
    async getRolePermissions(roleKeys) {
      return [...new Set(roleKeys.flatMap((key) => roles.get(key)?.permissions ?? []))];
    },
    async createSession({ userId, tenantId, deviceId, refreshTokenId, expiresAt }) {
      const session = {
        id: createId('ses'),
        userId,
        tenantId,
        deviceId,
        refreshTokenId,
        status: 'active',
        createdAt: now(),
        expiresAt
      };
      sessions.set(session.id, session);
      return clone(session);
    },
    async findSessionById(id) {
      const session = sessions.get(id);
      return session ? clone(session) : null;
    },
    async revokeSession(id) {
      const session = sessions.get(id);
      if (session) {
        session.status = 'revoked';
        session.revokedAt = now();
      }
    },
    async createOtpChallenge({ phone, code, expiresAt }) {
      const challenge = {
        id: createId('otp'),
        phone,
        code,
        status: 'active',
        createdAt: now(),
        expiresAt
      };
      otpChallenges.set(challenge.id, challenge);
      return clone(challenge);
    },
    async findOtpChallenge(id) {
      const challenge = otpChallenges.get(id);
      return challenge ? clone(challenge) : null;
    },
    async consumeOtpChallenge(id) {
      const challenge = otpChallenges.get(id);
      if (challenge) {
        challenge.status = 'consumed';
        challenge.consumedAt = now();
      }
    },
    async appendAuditEvent(event) {
      const auditEvent = {
        id: createId('aud'),
        createdAt: now(),
        ...event
      };
      auditEvents.push(auditEvent);
      return clone(auditEvent);
    },
    async listAuditEvents() {
      return auditEvents.map(clone);
    },

    async listSchools({ tenantId, schoolIds = null, includeArchived = false } = {}) {
      return byTenant(schools, tenantId)
        .filter((school) => includeArchived || activeOnly(school))
        .filter((school) => !schoolIds || schoolIds.includes(school.id))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(clone);
    },
    async findSchoolById(id, tenantId) {
      const school = schools.get(id);
      return school && sameTenant(school, tenantId) ? clone(school) : null;
    },
    async createSchool({ tenantId, name, code, city = '', state = '', address = '', metadata = {} }) {
      findUniqueBy(
        schools,
        (school) => school.tenantId === tenantId && normalizeUpper(school.code) === normalizeUpper(code),
        'School code already exists for this tenant.'
      );
      const school = {
        id: createId('sch'),
        tenantId,
        name: normalize(name),
        code: normalizeUpper(code),
        address: normalize(address),
        city: normalize(city),
        state: normalize(state),
        status: 'active',
        metadata,
        createdAt: now(),
        updatedAt: now()
      };
      schools.set(school.id, school);
      return clone(school);
    },
    async updateSchool(id, tenantId, patch) {
      const school = ensureSchool(tenantId, id);
      if (patch.code && normalizeUpper(patch.code) !== normalizeUpper(school.code)) {
        findUniqueBy(
          schools,
          (item) =>
            item.id !== id &&
            item.tenantId === tenantId &&
            normalizeUpper(item.code) === normalizeUpper(patch.code),
          'School code already exists for this tenant.'
        );
      }
      Object.assign(school, {
        ...patch,
        code: patch.code ? normalizeUpper(patch.code) : school.code,
        updatedAt: now()
      });
      return clone(school);
    },
    async archiveSchool(id, tenantId) {
      const school = ensureSchool(tenantId, id);
      school.status = 'archived';
      school.updatedAt = now();
      return clone(school);
    },

    async listAcademicYears({ tenantId, includeClosed = true } = {}) {
      return byTenant(academicYears, tenantId)
        .filter((year) => includeClosed || year.status !== 'closed')
        .sort((left, right) => left.startDate.localeCompare(right.startDate))
        .map(clone);
    },
    async findAcademicYearById(id, tenantId) {
      const year = academicYears.get(id);
      return year && sameTenant(year, tenantId) ? clone(year) : null;
    },
    async createAcademicYear({ tenantId, name, startDate, endDate, status = 'planned' }) {
      findUniqueBy(
        academicYears,
        (year) => year.tenantId === tenantId && normalizeUpper(year.name) === normalizeUpper(name),
        'Academic year name already exists for this tenant.'
      );
      const academicYear = {
        id: createId('ay'),
        tenantId,
        name: normalize(name),
        startDate,
        endDate,
        status,
        createdAt: now(),
        updatedAt: now()
      };
      academicYears.set(academicYear.id, academicYear);
      return clone(academicYear);
    },
    async updateAcademicYear(id, tenantId, patch) {
      const academicYear = ensureAcademicYear(tenantId, id);
      Object.assign(academicYear, patch, { updatedAt: now() });
      return clone(academicYear);
    },
    async closeAcademicYear(id, tenantId) {
      const academicYear = ensureAcademicYear(tenantId, id);
      academicYear.status = 'closed';
      academicYear.updatedAt = now();
      return clone(academicYear);
    },

    async listClassSections({ tenantId, schoolIds = null, assignedTeacherId = null, includeArchived = false } = {}) {
      let allowedClassIds = null;
      if (assignedTeacherId) {
        allowedClassIds = new Set(
          [...teacherAssignments.values()]
            .filter(
              (assignment) =>
                assignment.tenantId === tenantId &&
                assignment.userId === assignedTeacherId &&
                assignment.status === 'active'
            )
            .map((assignment) => assignment.classSectionId)
        );
      }

      return byTenant(classSections, tenantId)
        .filter((section) => includeArchived || activeOnly(section))
        .filter((section) => !schoolIds || schoolIds.includes(section.schoolId))
        .filter((section) => !allowedClassIds || allowedClassIds.has(section.id))
        .sort((left, right) => `${left.gradeLevel}${left.sectionName}`.localeCompare(`${right.gradeLevel}${right.sectionName}`))
        .map(clone);
    },
    async findClassSectionById(id, tenantId) {
      const section = classSections.get(id);
      return section && sameTenant(section, tenantId) ? clone(section) : null;
    },
    async createClassSection({ tenantId, schoolId, academicYearId, gradeLevel, sectionName, medium = '' }) {
      ensureSchool(tenantId, schoolId);
      ensureAcademicYear(tenantId, academicYearId);
      findUniqueBy(
        classSections,
        (section) =>
          section.tenantId === tenantId &&
          section.schoolId === schoolId &&
          section.academicYearId === academicYearId &&
          Number(section.gradeLevel) === Number(gradeLevel) &&
          normalizeUpper(section.sectionName) === normalizeUpper(sectionName) &&
          section.status !== 'archived',
        'Class section already exists for this school and academic year.'
      );
      const section = {
        id: createId('cls'),
        tenantId,
        schoolId,
        academicYearId,
        gradeLevel: Number(gradeLevel),
        sectionName: normalizeUpper(sectionName),
        medium: normalize(medium),
        status: 'active',
        createdAt: now(),
        updatedAt: now()
      };
      classSections.set(section.id, section);
      return clone(section);
    },
    async updateClassSection(id, tenantId, patch) {
      const section = ensureClassSection(tenantId, id);
      Object.assign(section, {
        ...patch,
        gradeLevel: patch.gradeLevel ? Number(patch.gradeLevel) : section.gradeLevel,
        sectionName: patch.sectionName ? normalizeUpper(patch.sectionName) : section.sectionName,
        updatedAt: now()
      });
      return clone(section);
    },
    async archiveClassSection(id, tenantId) {
      const section = ensureClassSection(tenantId, id);
      section.status = 'archived';
      section.updatedAt = now();
      return clone(section);
    },
    async listTeacherAssignments({ tenantId, classSectionId = null, userId = null } = {}) {
      return byTenant(teacherAssignments, tenantId)
        .filter((assignment) => assignment.status === 'active')
        .filter((assignment) => !classSectionId || assignment.classSectionId === classSectionId)
        .filter((assignment) => !userId || assignment.userId === userId)
        .map(clone);
    },
    async assignTeacherToClassSection({ tenantId, schoolId, classSectionId, userId }) {
      ensureClassSection(tenantId, classSectionId);
      const user = users.get(userId);
      if (!user || user.tenantId !== tenantId || !user.roles.includes('teacher')) {
        throw new ApiError(404, 'TEACHER_NOT_FOUND', 'Teacher was not found in this tenant.');
      }
      const existing = [...teacherAssignments.values()].find(
        (assignment) =>
          assignment.tenantId === tenantId &&
          assignment.classSectionId === classSectionId &&
          assignment.userId === userId &&
          assignment.status === 'active'
      );
      if (existing) {
        return clone(existing);
      }
      const assignment = {
        id: createId('ta'),
        tenantId,
        schoolId,
        classSectionId,
        userId,
        status: 'active',
        createdAt: now()
      };
      teacherAssignments.set(assignment.id, assignment);
      return clone(assignment);
    },
    async removeTeacherAssignment({ tenantId, classSectionId, userId }) {
      const assignment = [...teacherAssignments.values()].find(
        (item) =>
          item.tenantId === tenantId &&
          item.classSectionId === classSectionId &&
          item.userId === userId &&
          item.status === 'active'
      );
      if (assignment) {
        assignment.status = 'removed';
        assignment.removedAt = now();
      }
    },

    async listStudents({ tenantId, schoolIds = null, classSectionId = null, studentIds = null, status = null } = {}) {
      let allowedStudentIds = null;
      if (classSectionId) {
        allowedStudentIds = new Set(
          [...enrollments.values()]
            .filter(
              (enrollment) =>
                enrollment.tenantId === tenantId &&
                enrollment.classSectionId === classSectionId &&
                enrollment.status === 'active'
            )
            .map((enrollment) => enrollment.studentId)
        );
      } else if (studentIds) {
        allowedStudentIds = new Set(studentIds);
      }

      return byTenant(students, tenantId)
        .filter((student) => !schoolIds || schoolIds.includes(student.schoolId))
        .filter((student) => !allowedStudentIds || allowedStudentIds.has(student.id))
        .filter((student) => !status || student.status === status)
        .sort((left, right) => left.displayName.localeCompare(right.displayName))
        .map(clone);
    },
    async findStudentById(id, tenantId) {
      const student = students.get(id);
      return student && sameTenant(student, tenantId) ? clone(student) : null;
    },
    async findStudentByExternalId({ tenantId, schoolId, externalStudentId }) {
      const external = normalizeUpper(externalStudentId);
      if (!external) {
        return null;
      }
      const student = [...students.values()].find(
        (item) =>
          item.tenantId === tenantId &&
          item.schoolId === schoolId &&
          normalizeUpper(item.externalStudentId) === external &&
          item.status !== 'archived'
      );
      return student ? clone(student) : null;
    },
    async findStudentByAdmissionNumber({ tenantId, schoolId, admissionNumber }) {
      const admission = normalizeUpper(admissionNumber);
      if (!admission) {
        return null;
      }
      const student = [...students.values()].find(
        (item) =>
          item.tenantId === tenantId &&
          item.schoolId === schoolId &&
          normalizeUpper(item.admissionNumber) === admission &&
          item.status !== 'archived'
      );
      return student ? clone(student) : null;
    },
    async createStudent({
      tenantId,
      schoolId,
      externalStudentId = '',
      admissionNumber = '',
      displayName,
      dateOfBirth = '',
      gender = '',
      metadata = {}
    }) {
      ensureSchool(tenantId, schoolId);
      if (externalStudentId) {
        findUniqueBy(
          students,
          (student) =>
            student.tenantId === tenantId &&
            student.schoolId === schoolId &&
            normalizeUpper(student.externalStudentId) === normalizeUpper(externalStudentId) &&
            student.status !== 'archived',
          'External student id already exists for this school.'
        );
      }
      if (admissionNumber) {
        findUniqueBy(
          students,
          (student) =>
            student.tenantId === tenantId &&
            student.schoolId === schoolId &&
            normalizeUpper(student.admissionNumber) === normalizeUpper(admissionNumber) &&
            student.status !== 'archived',
          'Admission number already exists for this school.'
        );
      }

      const student = {
        id: createId('stu'),
        tenantId,
        schoolId,
        externalStudentId: normalize(externalStudentId),
        admissionNumber: normalize(admissionNumber),
        displayName: normalize(displayName),
        dateOfBirth: normalize(dateOfBirth),
        gender: normalize(gender),
        status: 'active',
        metadata,
        createdAt: now(),
        updatedAt: now()
      };
      students.set(student.id, student);
      return clone(student);
    },
    async updateStudent(id, tenantId, patch) {
      const student = ensureStudent(tenantId, id);
      Object.assign(student, {
        ...patch,
        externalStudentId:
          patch.externalStudentId === undefined ? student.externalStudentId : normalize(patch.externalStudentId),
        admissionNumber:
          patch.admissionNumber === undefined ? student.admissionNumber : normalize(patch.admissionNumber),
        displayName: patch.displayName === undefined ? student.displayName : normalize(patch.displayName),
        updatedAt: now()
      });
      return clone(student);
    },
    async archiveStudent(id, tenantId) {
      const student = ensureStudent(tenantId, id);
      student.status = 'archived';
      student.updatedAt = now();
      return clone(student);
    },

    async listEnrollments({ tenantId, studentId = null, classSectionId = null, status = null } = {}) {
      return byTenant(enrollments, tenantId)
        .filter((enrollment) => !studentId || enrollment.studentId === studentId)
        .filter((enrollment) => !classSectionId || enrollment.classSectionId === classSectionId)
        .filter((enrollment) => !status || enrollment.status === status)
        .map(clone);
    },
    async findEnrollmentById(id, tenantId) {
      const enrollment = enrollments.get(id);
      return enrollment && sameTenant(enrollment, tenantId) ? clone(enrollment) : null;
    },
    async createEnrollment({
      tenantId,
      studentId,
      classSectionId,
      academicYearId,
      rollNumber = '',
      startDate = new Date().toISOString().slice(0, 10)
    }) {
      const student = ensureStudent(tenantId, studentId);
      const section = ensureClassSection(tenantId, classSectionId);
      ensureAcademicYear(tenantId, academicYearId);
      if (student.schoolId !== section.schoolId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Student and class section must belong to the same school.');
      }

      const existingSameClass = [...enrollments.values()].find(
        (enrollment) =>
          enrollment.tenantId === tenantId &&
          enrollment.studentId === studentId &&
          enrollment.classSectionId === classSectionId &&
          enrollment.academicYearId === academicYearId &&
          enrollment.status === 'active'
      );
      if (existingSameClass) {
        return clone(existingSameClass);
      }

      findUniqueBy(
        enrollments,
        (enrollment) =>
          enrollment.tenantId === tenantId &&
          enrollment.studentId === studentId &&
          enrollment.academicYearId === academicYearId &&
          enrollment.status === 'active',
        'Student already has an active enrollment for this academic year.'
      );

      if (rollNumber) {
        findUniqueBy(
          enrollments,
          (enrollment) =>
            enrollment.tenantId === tenantId &&
            enrollment.classSectionId === classSectionId &&
            normalizeUpper(enrollment.rollNumber) === normalizeUpper(rollNumber) &&
            enrollment.status === 'active',
          'Roll number already exists in this class section.'
        );
      }

      const enrollment = {
        id: createId('enr'),
        tenantId,
        studentId,
        classSectionId,
        academicYearId,
        rollNumber: normalize(rollNumber),
        status: 'active',
        startDate,
        endDate: null,
        createdAt: now(),
        updatedAt: now()
      };
      enrollments.set(enrollment.id, enrollment);
      return clone(enrollment);
    },
    async updateEnrollment(id, tenantId, patch) {
      const enrollment = ensureEnrollment(tenantId, id);
      Object.assign(enrollment, {
        ...patch,
        rollNumber: patch.rollNumber === undefined ? enrollment.rollNumber : normalize(patch.rollNumber),
        updatedAt: now()
      });
      return clone(enrollment);
    },
    async withdrawEnrollment(id, tenantId, endDate = new Date().toISOString().slice(0, 10)) {
      const enrollment = ensureEnrollment(tenantId, id);
      enrollment.status = 'withdrawn';
      enrollment.endDate = endDate;
      enrollment.updatedAt = now();
      return clone(enrollment);
    },

    async createRosterImport(importJob) {
      const job = {
        id: createId('imp'),
        status: 'validated',
        createdAt: now(),
        updatedAt: now(),
        ...importJob
      };
      rosterImports.set(job.id, job);
      return clone(job);
    },
    async findRosterImportById(id, tenantId) {
      const job = rosterImports.get(id);
      return job && sameTenant(job, tenantId) ? clone(job) : null;
    },
    async updateRosterImport(id, tenantId, patch) {
      const job = getTenantResource(rosterImports, id, tenantId, 'IMPORT_NOT_FOUND');
      Object.assign(job, patch, { updatedAt: now() });
      return clone(job);
    }
  };
}
