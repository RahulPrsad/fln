import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withTestServer(assertion) {
  const server = createServer({
    environment: 'test',
    serviceName: 'smartfln-api',
    version: '0.1.0',
    jwtSecret: 'test-secret'
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    await assertion(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestJson(url, { method = 'GET', body = null, token = null } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { response, body: await response.json() };
}

async function login(baseUrl, email) {
  const { response, body } = await requestJson(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    body: {
      email,
      password: 'SmartFLN@123',
      deviceId: 'roster-test'
    }
  });

  assert.equal(response.status, 200);
  return body.data.accessToken;
}

test('admin can create school, academic year, class section, student, and enrollment', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl, 'admin@smartfln.local');

    const school = await requestJson(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      token,
      body: {
        name: 'North Star Primary',
        code: 'NSP',
        city: 'Patna',
        state: 'Bihar'
      }
    });
    assert.equal(school.response.status, 201);
    assert.equal(school.body.data.tenantId, 'ten_demo');

    const academicYear = await requestJson(`${baseUrl}/api/v1/academic-years`, {
      method: 'POST',
      token,
      body: {
        name: '2027-2028',
        startDate: '2027-04-01',
        endDate: '2028-03-31',
        status: 'active'
      }
    });
    assert.equal(academicYear.response.status, 201);
    assert.equal(academicYear.body.data.tenantId, 'ten_demo');

    const classSection = await requestJson(`${baseUrl}/api/v1/class-sections`, {
      method: 'POST',
      token,
      body: {
        schoolId: school.body.data.id,
        academicYearId: academicYear.body.data.id,
        gradeLevel: 2,
        sectionName: 'B',
        medium: 'Hindi'
      }
    });
    assert.equal(classSection.response.status, 201);
    assert.equal(classSection.body.data.schoolId, school.body.data.id);

    const student = await requestJson(`${baseUrl}/api/v1/students`, {
      method: 'POST',
      token,
      body: {
        schoolId: school.body.data.id,
        displayName: 'Maya Sharma',
        externalStudentId: 'NSP-001',
        admissionNumber: 'ADM-NSP-001'
      }
    });
    assert.equal(student.response.status, 201);
    assert.equal(student.body.data.tenantId, 'ten_demo');

    const enrollment = await requestJson(`${baseUrl}/api/v1/students/${student.body.data.id}/enrollments`, {
      method: 'POST',
      token,
      body: {
        classSectionId: classSection.body.data.id,
        academicYearId: academicYear.body.data.id,
        rollNumber: '7'
      }
    });
    assert.equal(enrollment.response.status, 201);
    assert.equal(enrollment.body.data.classSectionId, classSection.body.data.id);

    const roster = await requestJson(`${baseUrl}/api/v1/class-sections/${classSection.body.data.id}/students`, {
      token
    });
    assert.equal(roster.response.status, 200);
    assert.equal(roster.body.data.some((item) => item.id === student.body.data.id), true);
  });
});

test('teacher can see assigned class and cannot write roster setup', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl, 'teacher@smartfln.local');

    const classes = await requestJson(`${baseUrl}/api/v1/class-sections`, { token });
    assert.equal(classes.response.status, 200);
    assert.equal(classes.body.data.length, 1);
    assert.equal(classes.body.data[0].id, 'cls_demo_1a');

    const students = await requestJson(`${baseUrl}/api/v1/class-sections/cls_demo_1a/students`, { token });
    assert.equal(students.response.status, 200);
    assert.equal(students.body.data.some((item) => item.id === 'stu_demo_001'), true);

    const denied = await requestJson(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      token,
      body: {
        name: 'Denied School',
        code: 'DENIED'
      }
    });
    assert.equal(denied.response.status, 403);
    assert.equal(denied.body.error.code, 'FORBIDDEN');
  });
});

test('roster import reports row errors and duplicate warnings before commit', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl, 'admin@smartfln.local');

    const importJob = await requestJson(`${baseUrl}/api/v1/students/imports`, {
      method: 'POST',
      token,
      body: {
        schoolId: 'sch_demo',
        academicYearId: 'ay_demo_2026_2027',
        classSectionId: 'cls_demo_1a',
        rows: [
          {
            displayName: 'Ira Das',
            externalStudentId: 'IMP-001',
            admissionNumber: 'IMP-A-001',
            rollNumber: '21'
          },
          {
            displayName: 'Existing Aarav',
            externalStudentId: 'DEMO-001',
            admissionNumber: 'IMP-A-002',
            rollNumber: '22'
          },
          {
            externalStudentId: 'IMP-MISSING-NAME',
            admissionNumber: 'IMP-A-003',
            rollNumber: '23'
          }
        ]
      }
    });

    assert.equal(importJob.response.status, 201);
    assert.equal(importJob.body.data.summary.totalRows, 3);
    assert.equal(importJob.body.data.summary.errorRows, 1);
    assert.equal(importJob.body.data.summary.warningRows, 1);
    assert.equal(importJob.body.data.rows[2].errors[0].code, 'DISPLAY_NAME_REQUIRED');
    assert.equal(importJob.body.data.rows[1].warnings[0].code, 'POSSIBLE_DUPLICATE_STUDENT');

    const rejectedCommit = await requestJson(`${baseUrl}/api/v1/students/imports/${importJob.body.data.id}/commit`, {
      method: 'POST',
      token,
      body: {}
    });
    assert.equal(rejectedCommit.response.status, 409);
    assert.equal(rejectedCommit.body.error.code, 'IMPORT_HAS_ERRORS');
  });
});

test('admin can commit a validated CSV roster import', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl, 'admin@smartfln.local');

    const importJob = await requestJson(`${baseUrl}/api/v1/students/imports`, {
      method: 'POST',
      token,
      body: {
        schoolId: 'sch_demo',
        academicYearId: 'ay_demo_2026_2027',
        classSectionId: 'cls_demo_1a',
        csvText:
          'displayName,externalStudentId,admissionNumber,rollNumber\nNaina Roy,CSV-001,CSV-A-001,31\nKabir Das,CSV-002,CSV-A-002,32'
      }
    });

    assert.equal(importJob.response.status, 201);
    assert.equal(importJob.body.data.summary.errorRows, 0);

    const committed = await requestJson(`${baseUrl}/api/v1/students/imports/${importJob.body.data.id}/commit`, {
      method: 'POST',
      token,
      body: {}
    });

    assert.equal(committed.response.status, 200);
    assert.equal(committed.body.data.status, 'committed');
    assert.equal(committed.body.data.commitSummary.createdStudents, 2);

    const roster = await requestJson(`${baseUrl}/api/v1/class-sections/cls_demo_1a/students`, { token });
    assert.equal(roster.body.data.some((student) => student.externalStudentId === 'CSV-001'), true);
    assert.equal(roster.body.data.some((student) => student.externalStudentId === 'CSV-002'), true);
  });
});
