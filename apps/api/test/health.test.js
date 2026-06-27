import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withTestServer(assertion) {
  const server = createServer({
    environment: 'test',
    serviceName: 'smartfln-api',
    version: '0.1.0'
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    await assertion(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /health/live returns a healthy API response', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health/live`, {
      headers: { 'X-Request-ID': 'req_test_live' }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.service, 'smartfln-api');
    assert.equal(body.data.environment, 'test');
    assert.equal(body.meta.requestId, 'req_test_live');
  });
});

test('GET /health/ready returns a readiness response', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.version, '0.1.0');
  });
});

test('GET /version returns service version metadata', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/version`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.service, 'smartfln-api');
    assert.equal(body.data.version, '0.1.0');
  });
});

test('GET /metrics returns request counters and security headers are set', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(typeof body.data.totalRequests, 'number');
  });
});

test('unknown routes use the standard error envelope', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/unknown`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'RESOURCE_NOT_FOUND');
    assert.equal(typeof body.error.requestId, 'string');
  });
});
