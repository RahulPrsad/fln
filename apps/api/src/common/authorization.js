import { ApiError } from './http.js';

export function hasPermission(auth, ...permissions) {
  const granted = new Set(auth?.permissions ?? []);
  return permissions.some((permission) => granted.has(permission));
}

export function requirePermission(...permissions) {
  return function permissionMiddleware(request, response, next) {
    if (!hasPermission(request.auth, ...permissions)) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }

    next();
  };
}

export function canManageRoster(auth) {
  return hasPermission(auth, 'school:manage', 'roster:manage');
}

export function canAccessSchool(auth, schoolId) {
  return canManageRoster(auth) || (auth?.user?.schoolIds ?? []).includes(schoolId);
}

export function assertSchoolAccess(auth, schoolId) {
  if (!canAccessSchool(auth, schoolId)) {
    throw new ApiError(403, 'FORBIDDEN', 'School is outside the authenticated user scope.');
  }
}
