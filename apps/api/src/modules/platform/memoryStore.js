import { randomUUID } from 'node:crypto';
import { createSeedData } from './seedData.js';

function clone(value) {
  return structuredClone(value);
}

export function createMemoryStore(seed = createSeedData()) {
  const tenants = new Map(seed.tenants.map((tenant) => [tenant.id, tenant]));
  const schools = new Map(seed.schools.map((school) => [school.id, school]));
  const users = new Map(seed.users.map((user) => [user.id, user]));
  const roles = new Map(seed.roles.map((role) => [role.key, role]));
  const permissions = new Map(seed.permissions.map((permission) => [permission.key, permission]));
  const sessions = new Map();
  const otpChallenges = new Map();
  const auditEvents = [];

  return {
    demoPassword: seed.demoPassword,
    async findUserByEmail(email) {
      const normalized = email?.trim().toLowerCase();
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
        id: randomUUID(),
        userId,
        tenantId,
        deviceId,
        refreshTokenId,
        status: 'active',
        createdAt: new Date().toISOString(),
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
        session.revokedAt = new Date().toISOString();
      }
    },
    async createOtpChallenge({ phone, code, expiresAt }) {
      const challenge = {
        id: randomUUID(),
        phone,
        code,
        status: 'active',
        createdAt: new Date().toISOString(),
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
        challenge.consumedAt = new Date().toISOString();
      }
    },
    async appendAuditEvent(event) {
      const auditEvent = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...event
      };
      auditEvents.push(auditEvent);
      return clone(auditEvent);
    },
    async listAuditEvents() {
      return auditEvents.map(clone);
    }
  };
}
