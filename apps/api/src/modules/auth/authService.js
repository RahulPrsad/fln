import { randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../common/http.js';

function sanitizeUser(user, permissions = []) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    schoolIds: user.schoolIds,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    roles: user.roles,
    permissions
  };
}

export function createAuthService({ store, tokenService, auditService, config }) {
  async function issueSession(user, request, { deviceId = null, action = 'auth.login' } = {}) {
    if (user.status !== 'active') {
      throw new ApiError(403, 'FORBIDDEN', 'User account is not active.');
    }

    const tenant = await store.findTenantById(user.tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new ApiError(403, 'TENANT_SUSPENDED', 'Tenant is not active.');
    }

    const permissions = await store.getRolePermissions(user.roles);
    const refreshTokenId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const session = await store.createSession({
      userId: user.id,
      tenantId: user.tenantId,
      deviceId,
      refreshTokenId,
      expiresAt
    });

    const accessToken = tokenService.signAccessToken({ user, permissions, sessionId: session.id });
    const refreshToken = tokenService.signRefreshToken({ user, sessionId: session.id, refreshTokenId });

    await auditService.record({
      actorUserId: user.id,
      tenantId: user.tenantId,
      action,
      entityType: 'user',
      entityId: user.id,
      details: { sessionId: session.id },
      request
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: sanitizeUser(user, permissions)
    };
  }

  return {
    async login({ email, password, deviceId }, request) {
      if (!email || !password) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required.');
      }

      const user = await store.findUserByEmail(email);
      const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!user || !validPassword) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Invalid email or password.');
      }

      return issueSession(user, request, { deviceId });
    },
    async requestOtp({ phone }) {
      if (!phone) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Phone number is required.');
      }

      const user = await store.findUserByPhone(phone);
      if (!user) {
        throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'No active user exists for this phone number.');
      }

      const code = config.environment === 'production' ? String(randomInt(100000, 999999)) : '123456';
      const challenge = await store.createOtpChallenge({
        phone,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });

      return {
        challengeId: challenge.id,
        expiresAt: challenge.expiresAt,
        deliveryChannel: 'sms',
        devOtp: config.environment === 'production' ? undefined : code
      };
    },
    async verifyOtp({ challengeId, code, deviceId }, request) {
      const challenge = await store.findOtpChallenge(challengeId);
      if (!challenge || challenge.status !== 'active') {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'OTP challenge is invalid.');
      }
      if (new Date(challenge.expiresAt).getTime() < Date.now()) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'OTP challenge has expired.');
      }
      if (challenge.code !== code) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'OTP code is incorrect.');
      }

      await store.consumeOtpChallenge(challenge.id);
      const user = await store.findUserByPhone(challenge.phone);
      if (!user) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'OTP user no longer exists.');
      }

      return issueSession(user, request, { deviceId });
    },
    async refresh({ refreshToken }, request) {
      if (!refreshToken) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Refresh token is required.');
      }

      const payload = tokenService.verifyToken(refreshToken);
      if (payload.type !== 'refresh') {
        throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid.');
      }

      const session = await store.findSessionById(payload.session_id);
      if (!session || session.status !== 'active') {
        throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Session is no longer active.');
      }
      if (session.refreshTokenId !== payload.jti) {
        throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token does not match the active session.');
      }
      if (new Date(session.expiresAt).getTime() < Date.now()) {
        await store.revokeSession(session.id);
        throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'Session has expired.');
      }

      const user = await store.findUserById(payload.sub);
      if (!user) {
        throw new ApiError(401, 'REFRESH_TOKEN_INVALID', 'User no longer exists.');
      }

      await store.revokeSession(session.id);
      return issueSession(user, request, { deviceId: session.deviceId, action: 'auth.refresh' });
    },
    async logout(sessionId, user, request) {
      await store.revokeSession(sessionId);
      await auditService.record({
        actorUserId: user.id,
        tenantId: user.tenantId,
        action: 'auth.logout',
        entityType: 'session',
        entityId: sessionId,
        request
      });
    },
    async getCurrentUser(user) {
      const permissions = await store.getRolePermissions(user.roles);
      return sanitizeUser(user, permissions);
    }
  };
}
