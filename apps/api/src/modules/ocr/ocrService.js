function clampScore(value, fallback = 0.4) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Number(Math.max(0, Math.min(1, number)).toFixed(2));
}

function stripCodeFence(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseModelJson(text) {
  const clean = stripCodeFence(text);
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') {
    return payload.output_text;
  }

  const parts = [];
  for (const item of payload?.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') {
        parts.push(content.text);
      } else if (typeof content.output_text === 'string') {
        parts.push(content.output_text);
      }
    }
  }

  const choiceText = payload?.choices?.[0]?.message?.content;
  if (typeof choiceText === 'string') {
    parts.push(choiceText);
  }

  return parts.join('\n').trim();
}

function isImageDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(String(value ?? ''));
}

function buildPrompt(question) {
  const options = (question.options ?? []).length > 0 ? `\nOptions: ${question.options.join(', ')}` : '';
  const answerShape =
    question.type === 'matching'
      ? 'For matching questions, answer may be a JSON object such as {"1":"one"}.'
      : 'For all other questions, answer should be a short string.';

  return [
    'You are SmartFLN OCR/HTR for primary school handwritten answer boxes.',
    'Read only the student handwriting or selected option visible inside this cropped answer region.',
    'Ignore printed borders, ruled lines, question text, noise, and shadows.',
    'If the handwriting is blank or unreadable, return an empty answer with confidence below 0.4.',
    'Return only compact JSON with keys: answer, confidence, notes.',
    answerShape,
    `Question type: ${question.type}`,
    `Question: ${question.prompt}${options}`
  ].join('\n');
}

function disabledResult(model, status = 'not_configured') {
  return {
    recognizedAnswer: '',
    recognitionConfidence: 0.4,
    recognizedBy: `ocr-${status}:${model}`,
    ocrProviderStatus: status,
    needsReview: true
  };
}

function normalizeModelServiceResult(payload, model) {
  const first = payload?.results?.[0] ?? payload;
  return {
    recognizedAnswer: first.recognizedAnswer ?? first.answer ?? '',
    recognitionConfidence: clampScore(first.confidence ?? first.recognitionConfidence),
    recognizedBy: first.modelName ? `${first.modelName}:${first.modelVersion ?? 'dev'}` : `model_service:${model}`,
    ocrProviderStatus: first.providerStatus ?? 'ok',
    ocrNotes: String(first.diagnostics?.summary ?? first.notes ?? '').slice(0, 240)
  };
}

export function createOcrService(config) {
  const provider = config.ocrProvider;
  const model = provider === 'model_service' ? 'smartfln-model-service' : config.openaiOcrModel;

  return {
    providerName: provider,
    async recognizeAnswer({ question, cropImageDataUrl }) {
      if (!isImageDataUrl(cropImageDataUrl)) {
        return disabledResult(model, 'missing_crop');
      }

      if (provider === 'model_service') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.ocrRequestTimeoutMs);
        try {
          const response = await fetch(`${config.modelServiceUrl}/v1/infer`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scanPageId: 'single-crop',
              assessmentId: question.assessmentId ?? 'unknown',
              studentId: 'unknown',
              crops: [
                {
                  questionId: question.id,
                  questionType: question.type,
                  prompt: question.prompt,
                  answerKey: question.answerKey,
                  imageDataUrl: cropImageDataUrl
                }
              ]
            })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            return {
              ...disabledResult(model, 'provider_error'),
              ocrError: payload.error ?? `Model service returned ${response.status}`
            };
          }
          return normalizeModelServiceResult(payload, model);
        } catch (error) {
          return {
            ...disabledResult(model, error.name === 'AbortError' ? 'timeout' : 'provider_error'),
            ocrError: error.name === 'AbortError' ? 'Model service timed out.' : 'Model service request failed.'
          };
        } finally {
          clearTimeout(timeout);
        }
      }

      if (provider !== 'openai') {
        return disabledResult(model, 'disabled');
      }

      if (!config.openaiApiKey) {
        return disabledResult(model, 'not_configured');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.ocrRequestTimeoutMs);

      try {
        const response = await fetch(`${config.openaiBaseUrl}/responses`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'input_text', text: buildPrompt(question) },
                  { type: 'input_image', image_url: cropImageDataUrl, detail: config.openaiImageDetail }
                ]
              }
            ],
            max_output_tokens: 180
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            ...disabledResult(model, 'provider_error'),
            ocrError: payload.error?.message ?? `OCR provider returned ${response.status}`
          };
        }

        const parsed = parseModelJson(extractOutputText(payload));
        if (!parsed) {
          return {
            ...disabledResult(model, 'parse_error'),
            ocrRawText: extractOutputText(payload).slice(0, 500)
          };
        }

        return {
          recognizedAnswer: parsed.answer ?? '',
          recognitionConfidence: clampScore(parsed.confidence),
          recognizedBy: `openai:${model}`,
          ocrProviderStatus: 'ok',
          ocrNotes: String(parsed.notes ?? '').slice(0, 240)
        };
      } catch (error) {
        return {
          ...disabledResult(model, error.name === 'AbortError' ? 'timeout' : 'provider_error'),
          ocrError: error.name === 'AbortError' ? 'OCR provider timed out.' : 'OCR provider request failed.'
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
