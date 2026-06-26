import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { getRuntimeConfig } from './config.js';
import { buildHealthPayload } from './health.js';

function sendJson(response, statusCode, payload, requestId) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-ID': requestId
  });
  response.end(JSON.stringify(payload));
}

function resolvePath(request) {
  const host = request.headers.host ?? 'localhost';
  return new URL(request.url ?? '/', `http://${host}`).pathname;
}

export function createServer(overrides = {}) {
  const config = { ...getRuntimeConfig(), ...overrides };

  return http.createServer((request, response) => {
    const requestId = request.headers['x-request-id'] ?? randomUUID();
    const path = resolvePath(request);

    if (request.method === 'GET' && path === '/health/live') {
      sendJson(response, 200, { data: buildHealthPayload(config), meta: { requestId } }, requestId);
      return;
    }

    if (request.method === 'GET' && path === '/health/ready') {
      sendJson(response, 200, { data: buildHealthPayload(config), meta: { requestId } }, requestId);
      return;
    }

    if (request.method === 'GET' && path === '/version') {
      sendJson(
        response,
        200,
        {
          data: {
            service: config.serviceName,
            environment: config.environment,
            version: config.version
          },
          meta: { requestId }
        },
        requestId
      );
      return;
    }

    sendJson(
      response,
      404,
      {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested endpoint does not exist.',
          requestId
        }
      },
      requestId
    );
  });
}
