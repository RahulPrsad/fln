import bcrypt from 'bcryptjs';

const tenantId = 'ten_demo';
const schoolId = 'sch_demo';
const academicYearId = 'ay_demo_2026_2027';
const classSectionId = 'cls_demo_1a';

export function createSeedData() {
  const password = 'SmartFLN@123';

  return {
    tenants: [
      {
        id: tenantId,
        name: 'SmartFLN Demo Tenant',
        type: 'demo',
        status: 'active',
        defaultTimezone: 'Asia/Calcutta'
      }
    ],
    schools: [
      {
        id: schoolId,
        tenantId,
        name: 'SmartFLN Demo School',
        code: 'DEMO',
        city: 'Patna',
        state: 'Bihar',
        address: 'Demo campus',
        status: 'active',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    academicYears: [
      {
        id: academicYearId,
        tenantId,
        name: '2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    classSections: [
      {
        id: classSectionId,
        tenantId,
        schoolId,
        academicYearId,
        gradeLevel: 1,
        sectionName: 'A',
        medium: 'English',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    roles: [
      {
        id: 'role_teacher',
        key: 'teacher',
        name: 'Teacher',
        permissions: ['assessment:read', 'scan:create', 'review:write', 'result:read']
      },
      {
        id: 'role_school_admin',
        key: 'school_admin',
        name: 'School Admin',
        permissions: [
          'school:manage',
          'roster:manage',
          'user:manage',
          'assessment:manage',
          'result:read',
          'audit:read'
        ]
      }
    ],
    permissions: [
      { key: 'assessment:read', description: 'Read assigned assessments' },
      { key: 'assessment:manage', description: 'Create and manage assessments' },
      { key: 'scan:create', description: 'Create paper scan uploads' },
      { key: 'review:write', description: 'Review doubtful answers' },
      { key: 'result:read', description: 'Read assessment results' },
      { key: 'school:manage', description: 'Manage school setup' },
      { key: 'roster:manage', description: 'Manage class rosters and imports' },
      { key: 'user:manage', description: 'Manage users and roles' },
      { key: 'audit:read', description: 'Read audit logs' }
    ],
    users: [
      {
        id: 'usr_teacher_demo',
        tenantId,
        schoolIds: [schoolId],
        displayName: 'Anita Teacher',
        email: 'teacher@smartfln.local',
        phone: '+910000000001',
        status: 'active',
        roles: ['teacher'],
        passwordHash: bcrypt.hashSync(password, 10)
      },
      {
        id: 'usr_admin_demo',
        tenantId,
        schoolIds: [schoolId],
        displayName: 'Rahul Admin',
        email: 'admin@smartfln.local',
        phone: '+910000000002',
        status: 'active',
        roles: ['school_admin'],
        passwordHash: bcrypt.hashSync(password, 10)
      }
    ],
    teacherAssignments: [
      {
        id: 'ta_demo_teacher_1a',
        tenantId,
        schoolId,
        classSectionId,
        userId: 'usr_teacher_demo',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ],
    students: [
      {
        id: 'stu_demo_001',
        tenantId,
        schoolId,
        externalStudentId: 'DEMO-001',
        admissionNumber: 'ADM-001',
        displayName: 'Aarav Kumar',
        dateOfBirth: '2019-06-12',
        gender: 'male',
        status: 'active',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'stu_demo_002',
        tenantId,
        schoolId,
        externalStudentId: 'DEMO-002',
        admissionNumber: 'ADM-002',
        displayName: 'Saanvi Singh',
        dateOfBirth: '2019-09-20',
        gender: 'female',
        status: 'active',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    enrollments: [
      {
        id: 'enr_demo_001',
        tenantId,
        studentId: 'stu_demo_001',
        classSectionId,
        academicYearId,
        rollNumber: '1',
        status: 'active',
        startDate: '2026-04-01',
        endDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'enr_demo_002',
        tenantId,
        studentId: 'stu_demo_002',
        classSectionId,
        academicYearId,
        rollNumber: '2',
        status: 'active',
        startDate: '2026-04-01',
        endDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    demoPassword: password
  };
}
