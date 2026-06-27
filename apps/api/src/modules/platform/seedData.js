import bcrypt from 'bcryptjs';

const tenantId = 'ten_demo';
const schoolId = 'sch_demo';

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
        status: 'active'
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
        permissions: ['school:manage', 'user:manage', 'assessment:manage', 'result:read', 'audit:read']
      }
    ],
    permissions: [
      { key: 'assessment:read', description: 'Read assigned assessments' },
      { key: 'assessment:manage', description: 'Create and manage assessments' },
      { key: 'scan:create', description: 'Create paper scan uploads' },
      { key: 'review:write', description: 'Review doubtful answers' },
      { key: 'result:read', description: 'Read assessment results' },
      { key: 'school:manage', description: 'Manage school setup' },
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
    demoPassword: password
  };
}
