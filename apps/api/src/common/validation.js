import { ApiError } from './http.js';

export function requiredString(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} is required.`);
  }
  return normalized;
}

export function optionalString(value) {
  return String(value ?? '').trim();
}

export function requiredNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${fieldName} must be a number.`);
  }
  return number;
}

export function requireDateOrder(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'startDate and endDate are required.');
  }
  if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'startDate must be before endDate.');
  }
}
