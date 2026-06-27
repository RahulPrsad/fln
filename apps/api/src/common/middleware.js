import { randomUUID } from 'node:crypto';
import { ApiError } from './http.js';

export function cors(config) {
  const allowedOrigins = new Set(config.corsOrigins ?? []);

  return function corsMiddleware(request, response, next) {
    const origin = request.header('Origin');

    if (!origin) {
      next();
      return;
    }

    if (!allowedOrigins.has(origin)) {
      next(new ApiError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed.'));
      return;
    }

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID, X-Correlation-ID'
    );
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.status(204).send();
      return;
    }

    next();
  };
}

export function requestContext(request, response, next) {
  const requestId = request.header('X-Request-ID') ?? randomUUID();
  const correlationId = request.header('X-Correlation-ID') ?? requestId;

  response.locals.requestId = requestId;
  response.locals.correlationId = correlationId;
  response.setHeader('X-Request-ID', requestId);
  response.setHeader('X-Correlation-ID', correlationId);
  response.setHeader('X-API-Version', 'v1');
  next();
}

export function notFound(request, response, next) {
  next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'The requested endpoint does not exist.'));
}

export function errorHandler(error, request, response, next) {
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? 'INTERNAL_ERROR';
  const message = statusCode >= 500 ? 'An unexpected error occurred.' : error.message;

  response.status(statusCode).json({
    error: {
      code,
      message,
      details: error.details ?? [],
      requestId: response.locals.requestId,
      correlationId: response.locals.correlationId
    }
  });
}
