import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export function createTokenService(config) {
  function signAccessToken({ user, permissions, sessionId }) {
    return jwt.sign(
      {
        type: 'access',
        tenant_id: user.tenantId,
        school_ids: user.schoolIds,
        roles: user.roles,
        permissions,
        session_id: sessionId
      },
      config.jwtSecret,
      {
        subject: user.id,
        audience: 'smartfln-api',
        issuer: 'smartfln',
        expiresIn: config.accessTokenTtl,
        jwtid: randomUUID()
      }
    );
  }

  function signRefreshToken({ user, sessionId, refreshTokenId }) {
    return jwt.sign(
      {
        type: 'refresh',
        tenant_id: user.tenantId,
        session_id: sessionId
      },
      config.jwtSecret,
      {
        subject: user.id,
        audience: 'smartfln-api',
        issuer: 'smartfln',
        expiresIn: config.refreshTokenTtl,
        jwtid: refreshTokenId
      }
    );
  }

  function verifyToken(token) {
    return jwt.verify(token, config.jwtSecret, {
      audience: 'smartfln-api',
      issuer: 'smartfln'
    });
  }

  return {
    signAccessToken,
    signRefreshToken,
    verifyToken
  };
}
