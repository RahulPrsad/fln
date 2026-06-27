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

async function requestJson(url, { method = 'GET', token = null, body = null } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { response, body: await response.json() };
}

async function login(baseUrl, email = 'admin@smartfln.local') {
  const { response, body } = await requestJson(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    body: {
      email,
      password: 'SmartFLN@123',
      deviceId: 'workflow-test'
    }
  });

  assert.equal(response.status, 200);
  return body.data.accessToken;
}

test('complete paper assessment workflow from authoring to export', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl);

    const concepts = await requestJson(`${baseUrl}/api/v1/concepts`, { token });
    assert.equal(concepts.response.status, 200);
    assert.equal(concepts.body.data.some((concept) => concept.id === 'con_counting'), true);

    const assessment = await requestJson(`${baseUrl}/api/v1/assessments`, {
      method: 'POST',
      token,
      body: {
        schoolId: 'sch_demo',
        academicYearId: 'ay_demo_2026_2027',
        classSectionId: 'cls_demo_1a',
        title: 'Workflow Smoke Test',
        subject: 'Mathematics',
        gradeLevel: 1
      }
    });
    assert.equal(assessment.response.status, 201);

    const mcq = await requestJson(`${baseUrl}/api/v1/assessments/${assessment.body.data.id}/questions`, {
      method: 'POST',
      token,
      body: {
        type: 'mcq',
        prompt: 'What comes after 2?',
        options: ['1', '2', '3'],
        answerKey: '3',
        maxMarks: 1,
        conceptIds: ['con_counting']
      }
    });
    assert.equal(mcq.response.status, 201);

    const numeric = await requestJson(`${baseUrl}/api/v1/assessments/${assessment.body.data.id}/questions`, {
      method: 'POST',
      token,
      body: {
        type: 'numeric',
        prompt: '2 + 2 = ?',
        answerKey: '4',
        maxMarks: 1,
        conceptIds: ['con_addition']
      }
    });
    assert.equal(numeric.response.status, 201);

    const matching = await requestJson(`${baseUrl}/api/v1/assessments/${assessment.body.data.id}/questions`, {
      method: 'POST',
      token,
      body: {
        type: 'matching',
        prompt: 'Match number to word',
        answerKey: { '1': 'one' },
        maxMarks: 1,
        conceptIds: ['con_vocabulary'],
        autoScoreEligible: false
      }
    });
    assert.equal(matching.response.status, 201);

    const published = await requestJson(`${baseUrl}/api/v1/assessments/${assessment.body.data.id}/publish`, {
      method: 'POST',
      token,
      body: {}
    });
    assert.equal(published.response.status, 200);
    assert.equal(published.body.data.assessment.status, 'published');

    const paperBatch = await requestJson(`${baseUrl}/api/v1/paper-batches`, {
      method: 'POST',
      token,
      body: {
        assessmentId: assessment.body.data.id,
        classSectionId: 'cls_demo_1a'
      }
    });
    assert.equal(paperBatch.response.status, 201);
    assert.equal(paperBatch.body.data.paperInstances.length, 2);

    const firstPaperPage = paperBatch.body.data.paperInstances[0].pages[0];
    const qr = await requestJson(`${baseUrl}/api/v1/paper-pages/${firstPaperPage.id}/qr`, { token });
    assert.equal(qr.response.status, 200);
    assert.equal(qr.body.data.paperPageId, firstPaperPage.id);

    const scanBatch = await requestJson(`${baseUrl}/api/v1/scan-batches`, {
      method: 'POST',
      token,
      body: {
        assessmentId: assessment.body.data.id,
        classSectionId: 'cls_demo_1a'
      }
    });
    assert.equal(scanBatch.response.status, 201);

    const scanPage = await requestJson(`${baseUrl}/api/v1/scan-batches/${scanBatch.body.data.id}/pages`, {
      method: 'POST',
      token,
      body: {
        qrPayload: qr.body.data,
        imageQuality: 0.78,
        answers: {
          [mcq.body.data.id]: '3',
          [numeric.body.data.id]: '4',
          [matching.body.data.id]: { '1': 'one' }
        }
      }
    });
    assert.equal(scanPage.response.status, 201);
    assert.equal(scanPage.body.data.status, 'processed');
    assert.equal(scanPage.body.data.pipeline.includes('qr_decoded'), true);

    const reviewTasks = await requestJson(`${baseUrl}/api/v1/review-tasks?status=pending`, { token });
    assert.equal(reviewTasks.response.status, 200);
    assert.equal(reviewTasks.body.data.length >= 1, true);

    const reviewed = await requestJson(`${baseUrl}/api/v1/review-tasks/${reviewTasks.body.data[0].id}/decision`, {
      method: 'POST',
      token,
      body: {
        decision: 'accepted',
        awardedMarks: reviewTasks.body.data[0].question.maxMarks,
        finalAnswer: reviewTasks.body.data[0].crop.recognizedAnswer
      }
    });
    assert.equal(reviewed.response.status, 200);
    assert.equal(reviewed.body.data.task.status, 'resolved');

    const results = await requestJson(`${baseUrl}/api/v1/assessments/${assessment.body.data.id}/results`, { token });
    assert.equal(results.response.status, 200);
    assert.equal(results.body.data.length, 1);
    assert.equal(results.body.data[0].awardedMarks > 0, true);

    const analytics = await requestJson(`${baseUrl}/api/v1/analytics/assessments/${assessment.body.data.id}/summary`, {
      token
    });
    assert.equal(analytics.response.status, 200);
    assert.equal(analytics.body.data.summary.studentsProcessed, 1);
    assert.equal(analytics.body.data.concepts.length >= 1, true);

    const exportJob = await requestJson(`${baseUrl}/api/v1/exports`, {
      method: 'POST',
      token,
      body: {
        assessmentId: assessment.body.data.id,
        classSectionId: 'cls_demo_1a',
        exportType: 'class_result_csv'
      }
    });
    assert.equal(exportJob.response.status, 201);
    assert.equal(exportJob.body.data.status, 'ready');
    assert.equal(exportJob.body.data.content.includes('studentId,awardedMarks,totalMarks'), true);
  });
});

test('teacher can scan and review but cannot author assessments', async () => {
  await withTestServer(async (baseUrl) => {
    const token = await login(baseUrl, 'teacher@smartfln.local');

    const denied = await requestJson(`${baseUrl}/api/v1/assessments`, {
      method: 'POST',
      token,
      body: {
        schoolId: 'sch_demo',
        academicYearId: 'ay_demo_2026_2027',
        classSectionId: 'cls_demo_1a',
        title: 'Denied',
        subject: 'Mathematics',
        gradeLevel: 1
      }
    });
    assert.equal(denied.response.status, 403);

    const assessments = await requestJson(`${baseUrl}/api/v1/assessments`, { token });
    assert.equal(assessments.response.status, 200);
    assert.equal(assessments.body.data.some((item) => item.id === 'asm_demo_math_baseline'), true);
  });
});
