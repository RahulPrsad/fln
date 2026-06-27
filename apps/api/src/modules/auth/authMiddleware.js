import { ApiError } from '../../common/http.js';

export function createAuthMiddleware({ store, tokenService }) {
  return async function requireAuth(request, response, next) {
    try {
      const header = request.header('Authorization');
      if (!header?.startsWith('Bearer ')) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Bearer token is required.');
      }

      const token = header.slice('Bearer '.length);
      const payload = tokenService.verifyToken(token);
      if (payload.type !== 'access') {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Access token is required.');
      }

      const session = await store.findSessionById(payload.session_id);
      if (!session || session.status !== 'active') {
        throw new ApiError(401, 'TOKEN_EXPIRED', 'Session is no longer active.');
      }

      const user = await store.findUserById(payload.sub);
      if (!user) {
        throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Authenticated user no longer exists.');
      }

      request.auth = {
        user,
        sessionId: session.id,
        permissions: payload.permissions ?? []
      };
      next();
    } catch (error) {
      next(error.statusCode ? error : new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Token is invalid or expired.'));
    }
  };
}
