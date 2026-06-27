export function sendSuccess(response, data, meta = {}) {
  response.status(meta.statusCode ?? 200).json({
    data,
    meta: {
      requestId: response.locals.requestId,
      correlationId: response.locals.correlationId,
      apiVersion: 'v1',
      ...meta.extra
    }
  });
}

export function sendCreated(response, data, meta = {}) {
  sendSuccess(response, data, { ...meta, statusCode: 201 });
}

export function sendAccepted(response, data, meta = {}) {
  sendSuccess(response, data, { ...meta, statusCode: 202 });
}

export class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
