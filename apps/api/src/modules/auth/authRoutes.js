import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../../common/http.js';

export function createAuthRouter({ authService, requireAuth }) {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (request, response) => {
      const result = await authService.login(request.body, request);
      sendSuccess(response, result);
    })
  );

  router.post(
    '/otp/request',
    asyncHandler(async (request, response) => {
      const result = await authService.requestOtp(request.body);
      sendSuccess(response, result);
    })
  );

  router.post(
    '/otp/verify',
    asyncHandler(async (request, response) => {
      const result = await authService.verifyOtp(request.body, request);
      sendSuccess(response, result);
    })
  );

  router.post(
    '/refresh',
    asyncHandler(async (request, response) => {
      const result = await authService.refresh(request.body, request);
      sendSuccess(response, result);
    })
  );

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (request, response) => {
      await authService.logout(request.auth.sessionId, request.auth.user, request);
      sendSuccess(response, { status: 'logged_out' });
    })
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (request, response) => {
      const user = await authService.getCurrentUser(request.auth.user);
      sendSuccess(response, user);
    })
  );

  return router;
}
