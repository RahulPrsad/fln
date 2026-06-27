import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createOcrService } from '../src/modules/ocr/ocrService.js';

test('model_service OCR provider maps local model results into answer recognition', async () => {
  const modelServer = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/infer') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const payload = JSON.parse(body);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          scanPageId: payload.scanPageId,
          results: [
            {
              questionId: payload.crops[0].questionId,
              recognizedAnswer: '5',
              confidence: 0.91,
              modelName: 'smartfln-test-htr',
              modelVersion: '0.0.1',
              providerStatus: 'ok',
              diagnostics: { summary: 'test model result' }
            }
          ]
        })
      );
    });
  });

  await new Promise((resolve) => modelServer.listen(0, '127.0.0.1', resolve));
  const { port } = modelServer.address();

  try {
    const service = createOcrService({
      ocrProvider: 'model_service',
      modelServiceUrl: `http://127.0.0.1:${port}`,
      ocrRequestTimeoutMs: 5000
    });
    const result = await service.recognizeAnswer({
      question: {
        id: 'q_demo_2',
        type: 'numeric',
        prompt: 'Solve 2 + 3.',
        answerKey: '5'
      },
      cropImageDataUrl: 'data:image/jpeg;base64,SGVsbG8='
    });

    assert.equal(result.recognizedAnswer, '5');
    assert.equal(result.recognitionConfidence, 0.91);
    assert.equal(result.recognizedBy, 'smartfln-test-htr:0.0.1');
    assert.equal(result.ocrProviderStatus, 'ok');
  } finally {
    await new Promise((resolve, reject) => {
      modelServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
