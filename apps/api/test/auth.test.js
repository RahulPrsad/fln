import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withTestServer(assertion) {
  const server = createServer({
    environment: 'test',
    serviceName: 'smartfln-api',
    version: '0.1.0',
    jwtSecret: 'test-secret'
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

async function postJson(url, body, token = null) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

async function login(baseUrl) {
  const { response, body } = await postJson(`${baseUrl}/api/v1/auth/login`, {
    email: 'teacher@smartfln.local',
    password: 'SmartFLN@123',
    deviceId: 'test-device'
  });

  assert.equal(response.status, 200);
  assert.equal(body.data.user.roles.includes('teacher'), true);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(typeof body.data.refreshToken, 'string');
  return body.data;
}

test('email login returns access token, refresh token, and scoped user', async () => {
  await withTestServer(async (baseUrl) => {
    const result = await login(baseUrl);

    assert.equal(result.user.email, 'teacher@smartfln.local');
    assert.equal(result.user.tenantId, 'ten_demo');
    assert.equal(result.user.permissions.includes('scan:create'), true);
  });
});

test('protected current-user endpoint requires bearer token', async () => {
  await withTestServer(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/v1/auth/me`);
    const unauthorizedBody = await unauthorized.json();

    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorizedBody.error.code, 'AUTHENTICATION_REQUIRED');

    const result = await login(baseUrl);
    const authorized = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${result.accessToken}` }
    });
    const authorizedBody = await authorized.json();

    assert.equal(authorized.status, 200);
    assert.equal(authorizedBody.data.id, 'usr_teacher_demo');
    assert.equal(authorizedBody.data.permissions.includes('review:write'), true);
  });
});

test('OTP request and verify creates a teacher session', async () => {
  await withTestServer(async (baseUrl) => {
    const requested = await postJson(`${baseUrl}/api/v1/auth/otp/request`, {
      phone: '+910000000001'
    });

    assert.equal(requested.response.status, 200);
    assert.equal(requested.body.data.devOtp, '123456');

    const verified = await postJson(`${baseUrl}/api/v1/auth/otp/verify`, {
      challengeId: requested.body.data.challengeId,
      code: '123456',
      deviceId: 'otp-device'
    });

    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.data.user.id, 'usr_teacher_demo');
    assert.equal(typeof verified.body.data.accessToken, 'string');
  });
});

test('refresh token can obtain a new access token', async () => {
  await withTestServer(async (baseUrl) => {
    const result = await login(baseUrl);
    const refreshed = await postJson(`${baseUrl}/api/v1/auth/refresh`, {
      refreshToken: result.refreshToken
    });

    assert.equal(refreshed.response.status, 200);
    assert.equal(typeof refreshed.body.data.accessToken, 'string');
    assert.equal(refreshed.body.data.user.id, result.user.id);

    const replayed = await postJson(`${baseUrl}/api/v1/auth/refresh`, {
      refreshToken: result.refreshToken
    });
    assert.equal(replayed.response.status, 401);
    assert.equal(replayed.body.error.code, 'REFRESH_TOKEN_INVALID');
  });
});

test('logout revokes the current session', async () => {
  await withTestServer(async (baseUrl) => {
    const result = await login(baseUrl);
    const loggedOut = await postJson(`${baseUrl}/api/v1/auth/logout`, {}, result.accessToken);

    assert.equal(loggedOut.response.status, 200);
    assert.equal(loggedOut.body.data.status, 'logged_out');

    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${result.accessToken}` }
    });
    const body = await afterLogout.json();

    assert.equal(afterLogout.status, 401);
    assert.equal(body.error.code, 'TOKEN_EXPIRED');
  });
});

test('tenant, roles, and permissions endpoints are protected', async () => {
  await withTestServer(async (baseUrl) => {
    const result = await login(baseUrl);
    const headers = { Authorization: `Bearer ${result.accessToken}` };

    const tenant = await fetch(`${baseUrl}/api/v1/tenants/current`, { headers });
    const tenantBody = await tenant.json();
    assert.equal(tenant.status, 200);
    assert.equal(tenantBody.data.id, 'ten_demo');

    const roles = await fetch(`${baseUrl}/api/v1/roles`, { headers });
    const rolesBody = await roles.json();
    assert.equal(roles.status, 200);
    assert.equal(rolesBody.data.some((role) => role.key === 'teacher'), true);

    const permissions = await fetch(`${baseUrl}/api/v1/permissions`, { headers });
    const permissionsBody = await permissions.json();
    assert.equal(permissions.status, 200);
    assert.equal(permissionsBody.data.some((permission) => permission.key === 'scan:create'), true);
  });
});

test('configured browser origins receive CORS headers', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health/live`, {
      headers: {
        Origin: 'http://127.0.0.1:5173'
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  });
});
