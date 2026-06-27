import { ApiError } from '../../common/http.js';
import { parseCsv } from './csvParser.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeUpper(value) {
  return normalize(value).toUpperCase();
}

function summarize(rows) {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length
  };
}

function getRows(body) {
  if (Array.isArray(body.rows)) {
    return body.rows;
  }

  if (body.csvText) {
    return parseCsv(body.csvText);
  }

  return [];
}

async function findExistingStudent(store, tenantId, schoolId, row) {
  if (row.externalStudentId) {
    const student = await store.findStudentByExternalId({
      tenantId,
      schoolId,
      externalStudentId: row.externalStudentId
    });
    if (student) {
      return student;
    }
  }

  if (row.admissionNumber) {
    return store.findStudentByAdmissionNumber({
      tenantId,
      schoolId,
      admissionNumber: row.admissionNumber
    });
  }

  return null;
}

export function createRosterImportService(store) {
  return {
    async validate({ tenantId, schoolId, academicYearId, classSectionId, createdByUserId, body }) {
      const school = await store.findSchoolById(schoolId, tenantId);
      const academicYear = await store.findAcademicYearById(academicYearId, tenantId);
      const classSection = await store.findClassSectionById(classSectionId, tenantId);

      if (!school || !academicYear || !classSection || classSection.schoolId !== schoolId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Import context is invalid.');
      }

      const sourceRows = getRows(body);
      if (sourceRows.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'At least one roster row is required.');
      }

      const seenExternalIds = new Set();
      const seenAdmissionNumbers = new Set();
      const seenRollNumbers = new Set();
      const existingEnrollments = await store.listEnrollments({
        tenantId,
        classSectionId,
        status: 'active'
      });
      const usedRollNumbers = new Set(existingEnrollments.map((enrollment) => normalizeUpper(enrollment.rollNumber)));

      const rows = [];
      for (const [index, rawRow] of sourceRows.entries()) {
        const row = {
          displayName: normalize(rawRow.displayName ?? rawRow.name ?? rawRow.studentName),
          externalStudentId: normalize(rawRow.externalStudentId ?? rawRow.externalId ?? rawRow.studentId),
          admissionNumber: normalize(rawRow.admissionNumber ?? rawRow.admissionNo),
          rollNumber: normalize(rawRow.rollNumber ?? rawRow.rollNo),
          dateOfBirth: normalize(rawRow.dateOfBirth ?? rawRow.dob),
          gender: normalize(rawRow.gender)
        };
        const errors = [];
        const warnings = [];

        if (!row.displayName) {
          errors.push({ code: 'DISPLAY_NAME_REQUIRED', message: 'Student display name is required.' });
        }

        const externalKey = normalizeUpper(row.externalStudentId);
        if (externalKey) {
          if (seenExternalIds.has(externalKey)) {
            warnings.push({
              code: 'DUPLICATE_EXTERNAL_ID_IN_IMPORT',
              message: 'External student id is repeated in this import.'
            });
          }
          seenExternalIds.add(externalKey);
        }

        const admissionKey = normalizeUpper(row.admissionNumber);
        if (admissionKey) {
          if (seenAdmissionNumbers.has(admissionKey)) {
            warnings.push({
              code: 'DUPLICATE_ADMISSION_NUMBER_IN_IMPORT',
              message: 'Admission number is repeated in this import.'
            });
          }
          seenAdmissionNumbers.add(admissionKey);
        }

        const rollKey = normalizeUpper(row.rollNumber);
        if (rollKey) {
          if (seenRollNumbers.has(rollKey)) {
            warnings.push({ code: 'DUPLICATE_ROLL_IN_IMPORT', message: 'Roll number is repeated in this import.' });
          }
          if (usedRollNumbers.has(rollKey)) {
            warnings.push({ code: 'ROLL_ALREADY_ENROLLED', message: 'Roll number already exists in this class.' });
          }
          seenRollNumbers.add(rollKey);
        }

        const existingStudent = await findExistingStudent(store, tenantId, schoolId, row);
        if (existingStudent) {
          warnings.push({
            code: 'POSSIBLE_DUPLICATE_STUDENT',
            message: 'A student with this external id or admission number already exists.',
            studentId: existingStudent.id
          });
        }

        rows.push({
          rowNumber: index + 2,
          data: row,
          errors,
          warnings
        });
      }

      return store.createRosterImport({
        tenantId,
        schoolId,
        academicYearId,
        classSectionId,
        sourceType: body.csvText ? 'csv' : 'json',
        createdByUserId,
        rows,
        summary: summarize(rows)
      });
    },
    async commit(importJob) {
      if (importJob.status === 'committed') {
        return importJob;
      }
      if (importJob.summary.errorRows > 0) {
        throw new ApiError(409, 'IMPORT_HAS_ERRORS', 'Import cannot be committed while row errors exist.');
      }

      let createdStudents = 0;
      let reusedStudents = 0;
      let createdEnrollments = 0;

      for (const row of importJob.rows) {
        let student = await findExistingStudent(store, importJob.tenantId, importJob.schoolId, row.data);
        if (student) {
          reusedStudents += 1;
        } else {
          student = await store.createStudent({
            tenantId: importJob.tenantId,
            schoolId: importJob.schoolId,
            ...row.data
          });
          createdStudents += 1;
        }

        const enrollment = await store.createEnrollment({
          tenantId: importJob.tenantId,
          studentId: student.id,
          classSectionId: importJob.classSectionId,
          academicYearId: importJob.academicYearId,
          rollNumber: row.data.rollNumber
        });
        if (enrollment.createdAt === enrollment.updatedAt) {
          createdEnrollments += 1;
        }
      }

      return store.updateRosterImport(importJob.id, importJob.tenantId, {
        status: 'committed',
        committedAt: new Date().toISOString(),
        commitSummary: {
          createdStudents,
          reusedStudents,
          createdEnrollments
        }
      });
    }
  };
}
