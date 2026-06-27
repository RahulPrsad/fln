import { randomUUID } from 'node:crypto';
import { ApiError } from './http.js';

const metricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  statusCounts: new Map(),
  routeCounts: new Map()
};

export function getMetricsSnapshot() {
  return {
    uptimeSeconds: Math.floor((Date.now() - metricsState.startedAt) / 1000),
    totalRequests: metricsState.totalRequests,
    statusCounts: Object.fromEntries(metricsState.statusCounts),
    routeCounts: Object.fromEntries(metricsState.routeCounts)
  };
}

export function securityHeaders(request, response, next) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (request.secure || request.header('X-Forwarded-Proto') === 'https') {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function rateLimit(config) {
  const buckets = new Map();

  return function rateLimitMiddleware(request, response, next) {
    if (request.path === '/health/live' || request.path === '/health/ready') {
      next();
      return;
    }

    const key = `${request.ip}:${request.auth?.user?.id ?? 'anonymous'}`;
    const current = buckets.get(key);
    const nowMs = Date.now();
    const windowMs = config.rateLimitWindowMs;
    if (!current || nowMs > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
      next();
      return;
    }

    current.count += 1;
    response.setHeader('X-RateLimit-Limit', String(config.rateLimitMax));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, config.rateLimitMax - current.count)));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));
    if (current.count > config.rateLimitMax) {
      next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please retry later.'));
      return;
    }

    next();
  };
}

export function metrics(request, response, next) {
  response.on('finish', () => {
    metricsState.totalRequests += 1;
    const statusKey = String(response.statusCode);
    const routeKey = `${request.method} ${request.route?.path ?? request.path}`;
    metricsState.statusCounts.set(statusKey, (metricsState.statusCounts.get(statusKey) ?? 0) + 1);
    metricsState.routeCounts.set(routeKey, (metricsState.routeCounts.get(routeKey) ?? 0) + 1);
  });
  next();
}

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
