import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../../common/http.js';

const demoTenantId = 'ten_demo';
const demoSchoolId = 'sch_demo';
const demoAcademicYearId = 'ay_demo_2026_2027';
const demoClassSectionId = 'cls_demo_1a';

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

function clone(value) {
  return structuredClone(value);
}

function normalize(value) {
  return String(value ?? '').trim();
}

function checksum(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function buildPaperPageQrText(paperPageId) {
  return `SFLN:${paperPageId}:${checksum({ paperPageId }).slice(0, 8)}`;
}

function parsePaperPageQrText(qrText) {
  const value = normalize(qrText);
  const match = value.match(/^SFLN:(pp_[a-z0-9]+):([a-f0-9]{8})$/i);
  if (!match) {
    return null;
  }

  const paperPageId = match[1];
  const token = match[2].toLowerCase();
  if (token !== checksum({ paperPageId }).slice(0, 8)) {
    throw new ApiError(400, 'QR_INVALID', 'QR signature is invalid.');
  }
  return paperPageId;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createGaloisTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11d;
    }
  }
  for (let index = 255; index < 512; index += 1) {
    exp[index] = exp[index - 255];
  }
  return { exp, log };
}

const gf = createGaloisTables();

function gfMultiply(left, right) {
  if (left === 0 || right === 0) {
    return 0;
  }
  return gf.exp[gf.log[left] + gf.log[right]];
}

function polyMultiply(left, right) {
  const result = new Array(left.length + right.length - 1).fill(0);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^= gfMultiply(left[leftIndex], right[rightIndex]);
    }
  }
  return result;
}

function rsGenerator(degree) {
  let generator = [1];
  for (let index = 0; index < degree; index += 1) {
    generator = polyMultiply(generator, [1, gf.exp[index]]);
  }
  return generator;
}

function reedSolomon(data, degree) {
  const generator = rsGenerator(degree);
  const remainder = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }
  return remainder;
}

function appendBits(bits, value, length) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function encodeQrCodewords(text) {
  const bytes = [...Buffer.from(text, 'utf8')];
  if (bytes.length > 53) {
    throw new ApiError(500, 'QR_PAYLOAD_TOO_LARGE', 'QR payload is too large for the MVP QR template.');
  }

  const dataCodewordCount = 55;
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  const capacity = dataCodewordCount * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  const pads = [0xec, 0x11];
  for (let index = 0; data.length < dataCodewordCount; index += 1) {
    data.push(pads[index % 2]);
  }
  return [...data, ...reedSolomon(data, 15)];
}

function createQrMatrix(text) {
  const size = 29;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function set(x, y, dark, lock = true) {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    modules[y][x] = Boolean(dark);
    if (lock) {
      reserved[y][x] = true;
    }
  }

  function finder(x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        const dark =
          dx >= 0 &&
          dx <= 6 &&
          dy >= 0 &&
          dy <= 6 &&
          (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        set(xx, yy, dark, true);
      }
    }
  }

  function alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, distance === 2 || distance === 0, true);
      }
    }
  }

  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  alignment(22, 22);

  for (let index = 8; index < size - 8; index += 1) {
    set(index, 6, index % 2 === 0, true);
    set(6, index, index % 2 === 0, true);
  }
  set(8, size - 8, true, true);

  for (let index = 0; index <= 8; index += 1) {
    if (index !== 6) {
      set(8, index, false, true);
      set(index, 8, false, true);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, false, true);
    set(8, size - 1 - index, false, true);
  }

  const codewords = encodeQrCodewords(text);
  const dataBits = codewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1)
  );
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) {
      right -= 1;
    }
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (reserved[y][x]) {
          continue;
        }
        let dark = dataBits[bitIndex] === 1;
        bitIndex += 1;
        if ((x + y) % 2 === 0) {
          dark = !dark;
        }
        set(x, y, dark, true);
      }
    }
    upward = !upward;
  }

  const format = 0x77c4;
  function bit(index) {
    return ((format >>> index) & 1) === 1;
  }
  for (let index = 0; index <= 5; index += 1) set(8, index, bit(index), true);
  set(8, 7, bit(6), true);
  set(8, 8, bit(7), true);
  set(7, 8, bit(8), true);
  for (let index = 9; index < 15; index += 1) set(14 - index, 8, bit(index), true);
  for (let index = 0; index < 8; index += 1) set(size - 1 - index, 8, bit(index), true);
  for (let index = 8; index < 15; index += 1) set(8, size - 15 + index, bit(index), true);

  return modules;
}

function renderQrSvg(qrText, label = qrText) {
  const modules = createQrMatrix(qrText);
  const size = modules.length;
  const quiet = 4;
  const total = size + quiet * 2;
  const cells = modules
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1" />` : ''))
    )
    .join('');
  const escapedLabel = escapeHtml(label);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total + 4}" role="img" aria-label="SmartFLN QR ${escapedLabel}">
  <rect width="${total}" height="${total + 4}" fill="#fff"/>
  <g fill="#111827" shape-rendering="crispEdges">${cells}</g>
  <text x="${quiet}" y="${total + 2.7}" font-size="1.6" fill="#111827">${escapedLabel.slice(0, 26)}</text>
</svg>`;
}

function renderQuestion(question, index) {
  const options = (question.options ?? [])
    .map((option) => `<span class="option">${escapeHtml(option)}</span>`)
    .join('');
  return `<section class="question">
    <h2>Q${index + 1}. ${escapeHtml(question.prompt)}</h2>
    ${options ? `<div class="options">${options}</div>` : ''}
    <div class="answer-box"></div>
  </section>`;
}

function confidenceBand(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  return 'low';
}

function matchesAnswer(question, answer) {
  const normalizedAnswer = normalize(answer).toLowerCase();
  if (question.type === 'mcq') {
    return normalizedAnswer === normalize(question.answerKey).toLowerCase();
  }
  if (question.type === 'numeric') {
    return Number(normalizedAnswer) === Number(question.answerKey);
  }
  if (question.type === 'matching') {
    const expected = Object.entries(question.answerKey ?? {})
      .map(([left, right]) => `${left}:${right}`)
      .sort()
      .join('|');
    const received = Object.entries(answer ?? {})
      .map(([left, right]) => `${left}:${right}`)
      .sort()
      .join('|');
    return expected === received;
  }
  return normalizedAnswer === normalize(question.answerKey).toLowerCase();
}

function seedWorkflowData() {
  const concepts = [
    { id: 'con_counting', tenantId: demoTenantId, name: 'Counting', subject: 'Mathematics', gradeLevel: 1 },
    { id: 'con_addition', tenantId: demoTenantId, name: 'Addition', subject: 'Mathematics', gradeLevel: 1 },
    { id: 'con_shapes', tenantId: demoTenantId, name: 'Shapes', subject: 'Mathematics', gradeLevel: 1 },
    { id: 'con_vocabulary', tenantId: demoTenantId, name: 'Vocabulary', subject: 'English', gradeLevel: 1 }
  ];

  const assessment = {
    id: 'asm_demo_math_baseline',
    tenantId: demoTenantId,
    schoolId: demoSchoolId,
    academicYearId: demoAcademicYearId,
    classSectionId: demoClassSectionId,
    title: 'Grade 1 Math Baseline',
    subject: 'Mathematics',
    gradeLevel: 1,
    status: 'published',
    totalMarks: 5,
    createdAt: now(),
    updatedAt: now(),
    publishedAt: now()
  };

  const questions = [
    {
      id: 'q_demo_1',
      tenantId: demoTenantId,
      assessmentId: assessment.id,
      order: 1,
      type: 'mcq',
      prompt: 'Circle the number that comes after 4.',
      options: ['3', '4', '5', '6'],
      answerKey: '5',
      maxMarks: 1,
      conceptIds: ['con_counting'],
      autoScoreEligible: true
    },
    {
      id: 'q_demo_2',
      tenantId: demoTenantId,
      assessmentId: assessment.id,
      order: 2,
      type: 'numeric',
      prompt: 'Solve 2 + 3.',
      answerKey: '5',
      maxMarks: 1,
      conceptIds: ['con_addition'],
      autoScoreEligible: true
    },
    {
      id: 'q_demo_3',
      tenantId: demoTenantId,
      assessmentId: assessment.id,
      order: 3,
      type: 'short_text',
      prompt: 'Write the word for this shape: circle.',
      answerKey: 'circle',
      maxMarks: 1,
      conceptIds: ['con_shapes', 'con_vocabulary'],
      autoScoreEligible: true
    },
    {
      id: 'q_demo_4',
      tenantId: demoTenantId,
      assessmentId: assessment.id,
      order: 4,
      type: 'matching',
      prompt: 'Match the number to the word.',
      answerKey: { '1': 'one', '2': 'two' },
      maxMarks: 2,
      conceptIds: ['con_counting', 'con_vocabulary'],
      autoScoreEligible: false
    }
  ];

  const template = {
    id: 'tpl_demo_math_baseline_v1',
    tenantId: demoTenantId,
    assessmentId: assessment.id,
    version: 1,
    status: 'published',
    pageCount: 1,
    qrRegion: { x: 0.72, y: 0.04, width: 0.2, height: 0.16 },
    answerRegions: questions.map((question, index) => ({
      id: `reg_demo_${index + 1}`,
      questionId: question.id,
      pageNumber: 1,
      x: 0.08,
      y: 0.22 + index * 0.16,
      width: 0.84,
      height: 0.11
    })),
    createdAt: now()
  };

  return {
    concepts,
    assessments: [assessment],
    questions,
    templates: [template],
    paperBatches: [],
    paperInstances: [],
    paperPages: [],
    scanBatches: [],
    scanPages: [],
    answerCrops: [],
    reviewTasks: [],
    studentResults: [],
    exportJobs: []
  };
}

export function createWorkflowService(store) {
  const seed = seedWorkflowData();
  const concepts = new Map(seed.concepts.map((item) => [item.id, item]));
  const assessments = new Map(seed.assessments.map((item) => [item.id, item]));
  const questions = new Map(seed.questions.map((item) => [item.id, item]));
  const templates = new Map(seed.templates.map((item) => [item.id, item]));
  const paperBatches = new Map();
  const paperInstances = new Map();
  const paperPages = new Map();
  const scanBatches = new Map();
  const scanPages = new Map();
  const answerCrops = new Map();
  const reviewTasks = new Map();
  const studentResults = new Map();
  const exportJobs = new Map();
  let workflowLoaded = false;
  let workflowLoadPromise = null;

  function replaceMap(target, records = [], keySelector = (record) => record.id) {
    target.clear();
    for (const record of records) {
      target.set(keySelector(record), record);
    }
  }

  function snapshot() {
    return clone({
      concepts: [...concepts.values()],
      assessments: [...assessments.values()],
      questions: [...questions.values()],
      templates: [...templates.values()],
      paperBatches: [...paperBatches.values()],
      paperInstances: [...paperInstances.values()],
      paperPages: [...paperPages.values()],
      scanBatches: [...scanBatches.values()],
      scanPages: [...scanPages.values()],
      answerCrops: [...answerCrops.values()],
      reviewTasks: [...reviewTasks.values()],
      studentResults: [...studentResults.values()],
      exportJobs: [...exportJobs.values()]
    });
  }

  function hydrate(persistedState) {
    if (!persistedState) {
      return;
    }

    replaceMap(concepts, persistedState.concepts ?? seed.concepts);
    replaceMap(assessments, persistedState.assessments ?? seed.assessments);
    replaceMap(questions, persistedState.questions ?? seed.questions);
    replaceMap(templates, persistedState.templates ?? seed.templates);
    replaceMap(paperBatches, persistedState.paperBatches);
    replaceMap(paperInstances, persistedState.paperInstances);
    replaceMap(paperPages, persistedState.paperPages);
    replaceMap(scanBatches, persistedState.scanBatches);
    replaceMap(answerCrops, persistedState.answerCrops);
    replaceMap(reviewTasks, persistedState.reviewTasks);
    replaceMap(studentResults, persistedState.studentResults, (record) =>
      getResultKey(record.assessmentId, record.studentId)
    );
    replaceMap(exportJobs, persistedState.exportJobs);
  }

  async function ensureLoaded() {
    if (workflowLoaded) {
      return;
    }

    if (!workflowLoadPromise) {
      workflowLoadPromise = (async () => {
        if (typeof store.getWorkflowState === 'function') {
          hydrate(await store.getWorkflowState());
        }
        workflowLoaded = true;
      })().catch((error) => {
        workflowLoadPromise = null;
        throw error;
      });
    }

    await workflowLoadPromise;
  }

  async function persistWorkflow() {
    if (typeof store.saveWorkflowState === 'function') {
      await store.saveWorkflowState(snapshot());
    }
  }

  function ensureAssessment(tenantId, assessmentId) {
    const assessment = assessments.get(assessmentId);
    if (!assessment || assessment.tenantId !== tenantId) {
      throw new ApiError(404, 'ASSESSMENT_NOT_FOUND', 'Assessment was not found.');
    }
    return assessment;
  }

  function assessmentQuestions(tenantId, assessmentId) {
    return [...questions.values()]
      .filter((question) => question.tenantId === tenantId && question.assessmentId === assessmentId)
      .sort((left, right) => left.order - right.order);
  }

  function ensureTemplate(tenantId, assessmentId) {
    const template = [...templates.values()].find(
      (item) => item.tenantId === tenantId && item.assessmentId === assessmentId && item.status === 'published'
    );
    if (!template) {
      throw new ApiError(409, 'TEMPLATE_NOT_READY', 'Assessment template is not ready.');
    }
    return template;
  }

  function buildQrPayload({ tenantId, assessment, paperInstance, paperPage }) {
    const payload = {
      schema: 'smartfln.qr.v1',
      tenantId,
      schoolId: assessment.schoolId,
      assessmentId: assessment.id,
      paperInstanceId: paperInstance.id,
      paperPageId: paperPage.id,
      studentId: paperInstance.studentId,
      pageNumber: paperPage.pageNumber,
      templateVersion: paperPage.templateVersion
    };
    return { ...payload, checksum: checksum(payload) };
  }

  function validateQrPayload(payload) {
    if (!payload?.paperPageId || !payload?.paperInstanceId || !payload?.assessmentId) {
      throw new ApiError(400, 'QR_INVALID', 'QR payload is missing required identity fields.');
    }
    const { checksum: receivedChecksum, ...unsigned } = payload;
    if (checksum(unsigned) !== receivedChecksum) {
      throw new ApiError(400, 'QR_INVALID', 'QR checksum is invalid.');
    }
    return payload;
  }

  function resolveQrPayloadFromText(tenantId, qrText) {
    const paperPageId = parsePaperPageQrText(qrText);
    if (!paperPageId) {
      try {
        return validateQrPayload(JSON.parse(qrText));
      } catch {
        throw new ApiError(400, 'QR_INVALID', 'QR text is not a SmartFLN paper identity.');
      }
    }

    const page = paperPages.get(paperPageId);
    if (!page || page.tenantId !== tenantId) {
      throw new ApiError(404, 'PAPER_PAGE_NOT_FOUND', 'Paper page was not found for this QR.');
    }
    return page.qrPayload;
  }

  function getResultKey(assessmentId, studentId) {
    return `${assessmentId}:${studentId}`;
  }

  function calculateRecognition(question, providedAnswer, imageQuality = 0.92) {
    if (providedAnswer === undefined) {
      return {
        recognizedAnswer: '',
        recognitionConfidence: Number(Math.max(0.38, Math.min(0.58, imageQuality - 0.22)).toFixed(2)),
        recognizedBy: 'image-upload-htr-pending'
      };
    }

    const answer = providedAnswer ?? question.answerKey;
    const exact = matchesAnswer(question, answer);
    const typePenalty = question.type === 'matching' ? 0.2 : question.type === 'short_text' ? 0.08 : 0;
    const confidence = Math.max(0.45, Math.min(0.99, imageQuality - typePenalty - (exact ? 0 : 0.12)));
    return {
      recognizedAnswer: answer,
      recognitionConfidence: Number(confidence.toFixed(2)),
      recognizedBy: question.type === 'numeric' ? 'deterministic-numeric-htr' : `deterministic-${question.type}`
    };
  }

  function evaluateCrop(crop) {
    const question = questions.get(crop.questionId);
    const exact = matchesAnswer(question, crop.recognizedAnswer);
    const needsReview =
      crop.recognitionConfidence < 0.82 || !question.autoScoreEligible || (!exact && crop.recognitionConfidence < 0.9);
    return {
      awardedMarks: exact ? question.maxMarks : 0,
      maxMarks: question.maxMarks,
      evaluationConfidence: needsReview ? Math.min(crop.recognitionConfidence, 0.74) : crop.recognitionConfidence,
      confidenceBand: confidenceBand(needsReview ? 0.64 : crop.recognitionConfidence),
      needsReview,
      status: needsReview ? 'needs_review' : 'auto_scored'
    };
  }

  async function recomputeResult({ tenantId, assessmentId, studentId }) {
    const assessment = ensureAssessment(tenantId, assessmentId);
    const relatedCrops = [...answerCrops.values()].filter(
      (crop) => crop.tenantId === tenantId && crop.assessmentId === assessmentId && crop.studentId === studentId
    );
    const totalAwarded = relatedCrops.reduce((sum, crop) => sum + crop.awardedMarks, 0);
    const reviewPending = relatedCrops.some((crop) => crop.status === 'needs_review');
    const key = getResultKey(assessmentId, studentId);
    const result = {
      id: studentResults.get(key)?.id ?? id('res'),
      tenantId,
      assessmentId,
      classSectionId: assessment.classSectionId,
      studentId,
      status: reviewPending ? 'provisional' : 'ready',
      totalMarks: assessment.totalMarks,
      awardedMarks: totalAwarded,
      percentage: assessment.totalMarks > 0 ? Number(((totalAwarded / assessment.totalMarks) * 100).toFixed(1)) : 0,
      reviewPending,
      updatedAt: now()
    };
    studentResults.set(key, result);
    return clone(result);
  }

  async function processScanPage({ tenantId, scanPage, answers = {}, imageQuality = 0.92 }) {
    const qrPayload = validateQrPayload(scanPage.qrPayload);
    const paperPage = paperPages.get(qrPayload.paperPageId);
    const paperInstance = paperInstances.get(qrPayload.paperInstanceId);
    const assessment = ensureAssessment(tenantId, qrPayload.assessmentId);
    const template = ensureTemplate(tenantId, assessment.id);

    if (!paperPage || !paperInstance || paperInstance.studentId !== qrPayload.studentId) {
      throw new ApiError(400, 'IDENTITY_RESOLUTION_REQUIRED', 'Paper identity could not be resolved.');
    }

    Object.assign(scanPage, {
      status: 'processed',
      studentId: paperInstance.studentId,
      assessmentId: assessment.id,
      paperInstanceId: paperInstance.id,
      paperPageId: paperPage.id,
      pageNumber: paperPage.pageNumber,
      quality: {
        glare: imageQuality < 0.75,
        blurScore: Number((1 - imageQuality).toFixed(2)),
        pageDetected: true,
        perspectiveCorrected: true,
        shadowRemoved: imageQuality >= 0.7,
        qrConfidence: Number(Math.min(0.99, imageQuality + 0.04).toFixed(2)),
        cropConfidence: Number(Math.min(0.98, imageQuality + 0.02).toFixed(2))
      },
      pipeline: [
        'uploaded',
        'quality_checked',
        'qr_decoded',
        'page_rectified',
        'template_aligned',
        'answers_extracted',
        'answers_recognized',
        'evaluated'
      ],
      processedAt: now()
    });

    for (const region of template.answerRegions) {
      const question = questions.get(region.questionId);
      const recognition = calculateRecognition(question, answers[question.id], imageQuality);
      const crop = {
        id: id('crop'),
        tenantId,
        scanPageId: scanPage.id,
        assessmentId: assessment.id,
        studentId: paperInstance.studentId,
        questionId: question.id,
        answerRegionId: region.id,
        cropUri: `memory://crops/${scanPage.id}/${region.id}`,
        ...recognition,
        createdAt: now()
      };
      Object.assign(crop, evaluateCrop(crop));
      answerCrops.set(crop.id, crop);

      if (crop.needsReview) {
        const task = {
          id: id('rev'),
          tenantId,
          assessmentId: assessment.id,
          studentId: paperInstance.studentId,
          questionId: question.id,
          answerCropId: crop.id,
          status: 'pending',
          priority: crop.evaluationConfidence < 0.65 ? 'high' : 'normal',
          reason: question.autoScoreEligible ? 'low_confidence_or_mismatch' : 'manual_question_type',
          createdAt: now(),
          updatedAt: now()
        };
        reviewTasks.set(task.id, task);
      }
    }

    await recomputeResult({ tenantId, assessmentId: assessment.id, studentId: paperInstance.studentId });
    return scanPage;
  }

  return {
    async listConcepts({ tenantId }) {
      await ensureLoaded();
      return [...concepts.values()].filter((concept) => concept.tenantId === tenantId).map(clone);
    },
    async listAssessments({ tenantId, classSectionId = null }) {
      await ensureLoaded();
      return [...assessments.values()]
        .filter((assessment) => assessment.tenantId === tenantId)
        .filter((assessment) => !classSectionId || assessment.classSectionId === classSectionId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((assessment) => ({
          ...clone(assessment),
          questionCount: assessmentQuestions(tenantId, assessment.id).length
        }));
    },
    async getAssessment({ tenantId, assessmentId }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, assessmentId);
      return {
        ...clone(assessment),
        questions: assessmentQuestions(tenantId, assessmentId).map(clone),
        template: [...templates.values()].find((template) => template.assessmentId === assessmentId) ?? null
      };
    },
    async createAssessment({ tenantId, body }) {
      await ensureLoaded();
      const assessment = {
        id: id('asm'),
        tenantId,
        schoolId: body.schoolId,
        academicYearId: body.academicYearId,
        classSectionId: body.classSectionId,
        title: normalize(body.title),
        subject: normalize(body.subject),
        gradeLevel: Number(body.gradeLevel),
        status: 'draft',
        totalMarks: 0,
        createdAt: now(),
        updatedAt: now()
      };
      assessments.set(assessment.id, assessment);
      await persistWorkflow();
      return clone(assessment);
    },
    async addQuestion({ tenantId, assessmentId, body }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, assessmentId);
      const existingQuestions = assessmentQuestions(tenantId, assessmentId);
      const question = {
        id: id('q'),
        tenantId,
        assessmentId,
        order: existingQuestions.length + 1,
        type: normalize(body.type || 'short_text'),
        prompt: normalize(body.prompt),
        options: body.options ?? [],
        answerKey: body.answerKey,
        maxMarks: Number(body.maxMarks ?? 1),
        conceptIds: body.conceptIds ?? [],
        autoScoreEligible: body.autoScoreEligible !== false
      };
      questions.set(question.id, question);
      assessment.totalMarks = existingQuestions.reduce((sum, item) => sum + item.maxMarks, 0) + question.maxMarks;
      assessment.updatedAt = now();
      await persistWorkflow();
      return clone(question);
    },
    async publishAssessment({ tenantId, assessmentId }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, assessmentId);
      const items = assessmentQuestions(tenantId, assessmentId);
      if (items.length === 0) {
        throw new ApiError(409, 'ASSESSMENT_EMPTY', 'Assessment must have at least one question.');
      }
      const template = {
        id: id('tpl'),
        tenantId,
        assessmentId,
        version: 1,
        status: 'published',
        pageCount: 1,
        qrRegion: { x: 0.72, y: 0.04, width: 0.2, height: 0.16 },
        answerRegions: items.map((question, index) => ({
          id: id('reg'),
          questionId: question.id,
          pageNumber: 1,
          x: 0.08,
          y: 0.2 + index * 0.14,
          width: 0.84,
          height: 0.1
        })),
        createdAt: now()
      };
      templates.set(template.id, template);
      assessment.status = 'published';
      assessment.publishedAt = now();
      assessment.updatedAt = now();
      await persistWorkflow();
      return clone({ assessment, template });
    },
    async listPaperBatches({ tenantId }) {
      await ensureLoaded();
      return [...paperBatches.values()].filter((batch) => batch.tenantId === tenantId).map(clone);
    },
    async generatePaperBatch({ tenantId, createdByUserId, body }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, body.assessmentId);
      const template = ensureTemplate(tenantId, assessment.id);
      const students = await store.listStudents({
        tenantId,
        classSectionId: body.classSectionId ?? assessment.classSectionId,
        status: 'active'
      });
      const batch = {
        id: id('pb'),
        tenantId,
        assessmentId: assessment.id,
        classSectionId: body.classSectionId ?? assessment.classSectionId,
        status: 'ready',
        paperMode: body.paperMode ?? 'student_specific',
        createdByUserId,
        generatedAt: now(),
        studentCount: students.length
      };
      paperBatches.set(batch.id, batch);

      for (const student of students) {
        const instance = {
          id: id('pi'),
          tenantId,
          paperBatchId: batch.id,
          assessmentId: assessment.id,
          studentId: student.id,
          status: 'ready',
          pageCount: template.pageCount,
          generatedAt: now()
        };
        paperInstances.set(instance.id, instance);
        for (let pageNumber = 1; pageNumber <= template.pageCount; pageNumber += 1) {
          const page = {
            id: id('pp'),
            tenantId,
            paperBatchId: batch.id,
            paperInstanceId: instance.id,
            assessmentId: assessment.id,
            studentId: student.id,
            pageNumber,
            templateVersion: template.version,
            status: 'ready',
            generatedAt: now()
          };
          page.qrPayload = buildQrPayload({ tenantId, assessment, paperInstance: instance, paperPage: page });
          page.qrText = buildPaperPageQrText(page.id);
          paperPages.set(page.id, page);
        }
      }

      await persistWorkflow();
      return this.getPaperBatch({ tenantId, paperBatchId: batch.id });
    },
    async getPaperBatch({ tenantId, paperBatchId }) {
      await ensureLoaded();
      const batch = paperBatches.get(paperBatchId);
      if (!batch || batch.tenantId !== tenantId) {
        throw new ApiError(404, 'PAPER_BATCH_NOT_FOUND', 'Paper batch was not found.');
      }
      return {
        ...clone(batch),
        paperInstances: [...paperInstances.values()]
          .filter((instance) => instance.tenantId === tenantId && instance.paperBatchId === paperBatchId)
          .map((instance) => ({
            ...clone(instance),
            pages: [...paperPages.values()].filter((page) => page.paperInstanceId === instance.id).map(clone)
          }))
      };
    },
    async getPrintablePaperBatch({ tenantId, paperBatchId, studentId = null }) {
      await ensureLoaded();
      const batch = await this.getPaperBatch({ tenantId, paperBatchId });
      const assessment = ensureAssessment(tenantId, batch.assessmentId);
      const items = assessmentQuestions(tenantId, batch.assessmentId);
      const students = await store.listStudents({
        tenantId,
        classSectionId: batch.classSectionId,
        status: 'active'
      });
      const studentById = new Map(students.map((student) => [student.id, student]));
      const printableInstances = batch.paperInstances.filter((instance) => !studentId || instance.studentId === studentId);
      if (printableInstances.length === 0) {
        throw new ApiError(404, 'PAPER_INSTANCE_NOT_FOUND', 'Printable paper was not found for this student.');
      }

      const pages = printableInstances
        .map((instance) => {
          const student = studentById.get(instance.studentId);
          const page = instance.pages[0];
          const qrText = page.qrText ?? buildPaperPageQrText(page.id);
          return `<article class="paper">
            <div class="scan-corner top-left"></div>
            <div class="scan-corner top-right"></div>
            <div class="scan-corner bottom-left"></div>
            <div class="scan-corner bottom-right"></div>
            <header>
              <div>
                <p class="eyebrow">SmartFLN Printable Assessment</p>
                <h1>${escapeHtml(assessment.title)}</h1>
                <p>${escapeHtml(student?.displayName ?? instance.studentId)} · Page ${page.pageNumber}</p>
              </div>
              <div class="qr">${renderQrSvg(qrText, page.id)}</div>
            </header>
            <section class="identity-row">
              <span>Name: <b>${escapeHtml(student?.displayName ?? '')}</b></span>
              <span>Roll: <b>${escapeHtml(student?.externalStudentId ?? '')}</b></span>
              <span>Paper ID: <b>${escapeHtml(page.id)}</b></span>
            </section>
            ${items.map(renderQuestion).join('')}
          </article>`;
        })
        .join('');

      return {
        paperBatchId: batch.id,
        fileName: `${assessment.title.replaceAll(' ', '_')}_papers.html`,
        contentType: 'text/html',
        content: `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(assessment.title)} Papers</title>
  <style>
    body { margin: 0; color: #111827; font-family: Arial, sans-serif; background: #fff; }
    .paper { position: relative; width: 210mm; min-height: 297mm; padding: 16mm; page-break-after: always; border: 3px solid #111827; }
    .scan-corner { position: absolute; width: 17mm; height: 17mm; border-color: #111827; }
    .top-left { top: 6mm; left: 6mm; border-top: 4px solid; border-left: 4px solid; }
    .top-right { top: 6mm; right: 6mm; border-top: 4px solid; border-right: 4px solid; }
    .bottom-left { bottom: 6mm; left: 6mm; border-bottom: 4px solid; border-left: 4px solid; }
    .bottom-right { bottom: 6mm; right: 6mm; border-bottom: 4px solid; border-right: 4px solid; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
    .eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 10px; font-size: 15px; }
    .qr svg { width: 38mm; height: 42mm; }
    .identity-row { display: grid; grid-template-columns: 1.4fr 1fr 1.2fr; gap: 8px; margin: 10px 0 6px; font-size: 12px; }
    .identity-row span { border-bottom: 1px solid #111827; padding-bottom: 3px; }
    .question { margin-top: 14px; break-inside: avoid; }
    .options { display: flex; gap: 10px; margin-bottom: 10px; }
    .option { min-width: 36px; border: 1px solid #111827; border-radius: 999px; padding: 6px 10px; text-align: center; }
    .answer-box { min-height: 30mm; border: 1.5px solid #111827; border-radius: 4px; background: repeating-linear-gradient(#fff 0, #fff 8mm, #eef2f7 8.1mm); }
    @media print { .paper { page-break-after: always; } }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>${pages}</body>
</html>`
      };
    },
    async getPaperPageQr({ tenantId, paperPageId }) {
      await ensureLoaded();
      const page = paperPages.get(paperPageId);
      if (!page || page.tenantId !== tenantId) {
        throw new ApiError(404, 'PAPER_PAGE_NOT_FOUND', 'Paper page was not found.');
      }
      return clone({ ...page.qrPayload, qrText: page.qrText ?? buildPaperPageQrText(page.id) });
    },
    async getPaperPageQrSvg({ tenantId, paperPageId }) {
      await ensureLoaded();
      const payload = await this.getPaperPageQr({ tenantId, paperPageId });
      return {
        paperPageId,
        fileName: `${paperPageId}.svg`,
        contentType: 'image/svg+xml',
        content: renderQrSvg(payload.qrText, paperPageId)
      };
    },
    async resolveQrText({ tenantId, qrText }) {
      await ensureLoaded();
      const qrPayload = resolveQrPayloadFromText(tenantId, qrText);
      const page = paperPages.get(qrPayload.paperPageId);
      const instance = paperInstances.get(qrPayload.paperInstanceId);
      const assessment = ensureAssessment(tenantId, qrPayload.assessmentId);
      const students = await store.listStudents({ tenantId, studentIds: [qrPayload.studentId] });
      return clone({
        qrText,
        qrPayload,
        paperPage: page,
        paperInstance: instance,
        assessment: {
          id: assessment.id,
          title: assessment.title,
          classSectionId: assessment.classSectionId
        },
        student: students[0] ?? { id: qrPayload.studentId }
      });
    },
    async createScanBatch({ tenantId, createdByUserId, body }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, body.assessmentId);
      const batch = {
        id: id('sb'),
        tenantId,
        assessmentId: assessment.id,
        classSectionId: body.classSectionId ?? assessment.classSectionId,
        status: 'open',
        createdByUserId,
        createdAt: now(),
        updatedAt: now()
      };
      scanBatches.set(batch.id, batch);
      await persistWorkflow();
      return clone(batch);
    },
    async listScanBatches({ tenantId }) {
      await ensureLoaded();
      return [...scanBatches.values()].filter((batch) => batch.tenantId === tenantId).map(clone);
    },
    async getScanBatch({ tenantId, scanBatchId }) {
      await ensureLoaded();
      const batch = scanBatches.get(scanBatchId);
      if (!batch || batch.tenantId !== tenantId) {
        throw new ApiError(404, 'SCAN_BATCH_NOT_FOUND', 'Scan batch was not found.');
      }
      return {
        ...clone(batch),
        pages: [...scanPages.values()].filter((page) => page.scanBatchId === batch.id).map(clone)
      };
    },
    async uploadScanPage({ tenantId, scanBatchId, body }) {
      await ensureLoaded();
      const batch = scanBatches.get(scanBatchId);
      if (!batch || batch.tenantId !== tenantId) {
        throw new ApiError(404, 'SCAN_BATCH_NOT_FOUND', 'Scan batch was not found.');
      }
      const scanPage = {
        id: id('sp'),
        tenantId,
        scanBatchId,
        status: 'uploaded',
        qrPayload: body.qrPayload ?? resolveQrPayloadFromText(tenantId, body.qrText),
        qrText: body.qrText,
        scanMode: body.scanMode ?? 'web_scan',
        uploadedAt: now()
      };
      scanPages.set(scanPage.id, scanPage);
      await processScanPage({
        tenantId,
        scanPage,
        answers: body.answers ?? {},
        imageQuality: Number(body.imageQuality ?? 0.92)
      });
      batch.status = 'processing_complete';
      batch.updatedAt = now();
      await persistWorkflow();
      return clone(scanPage);
    },
    async listAnswerCrops({ tenantId, assessmentId }) {
      await ensureLoaded();
      return [...answerCrops.values()]
        .filter((crop) => crop.tenantId === tenantId && (!assessmentId || crop.assessmentId === assessmentId))
        .map(clone);
    },
    async listReviewTasks({ tenantId, status = null }) {
      await ensureLoaded();
      return [...reviewTasks.values()]
        .filter((task) => task.tenantId === tenantId && (!status || task.status === status))
        .map((task) => ({
          ...clone(task),
          crop: answerCrops.get(task.answerCropId) ? clone(answerCrops.get(task.answerCropId)) : null,
          question: questions.get(task.questionId) ? clone(questions.get(task.questionId)) : null
        }));
    },
    async decideReviewTask({ tenantId, taskId, body, reviewerUserId }) {
      await ensureLoaded();
      const task = reviewTasks.get(taskId);
      if (!task || task.tenantId !== tenantId) {
        throw new ApiError(404, 'REVIEW_TASK_NOT_FOUND', 'Review task was not found.');
      }
      const crop = answerCrops.get(task.answerCropId);
      const question = questions.get(task.questionId);
      crop.awardedMarks = Number(body.awardedMarks ?? crop.awardedMarks);
      crop.recognizedAnswer = body.finalAnswer ?? crop.recognizedAnswer;
      crop.evaluationConfidence = 1;
      crop.confidenceBand = 'teacher_verified';
      crop.status = 'teacher_reviewed';
      crop.needsReview = false;
      task.status = 'resolved';
      task.decision = body.decision ?? 'accepted';
      task.reviewerUserId = reviewerUserId;
      task.reviewedAt = now();
      task.updatedAt = now();
      await recomputeResult({ tenantId, assessmentId: task.assessmentId, studentId: task.studentId });
      await persistWorkflow();
      return clone({ task, crop, question });
    },
    async listResults({ tenantId, assessmentId }) {
      await ensureLoaded();
      ensureAssessment(tenantId, assessmentId);
      return [...studentResults.values()]
        .filter((result) => result.tenantId === tenantId && result.assessmentId === assessmentId)
        .map(clone);
    },
    async finalizeResults({ tenantId, assessmentId }) {
      await ensureLoaded();
      ensureAssessment(tenantId, assessmentId);
      const results = [...studentResults.values()].filter(
        (result) => result.tenantId === tenantId && result.assessmentId === assessmentId
      );
      for (const result of results) {
        if (!result.reviewPending) {
          result.status = 'finalized';
          result.finalizedAt = now();
        }
      }
      await persistWorkflow();
      return results.map(clone);
    },
    async getAnalytics({ tenantId, assessmentId }) {
      await ensureLoaded();
      const assessment = ensureAssessment(tenantId, assessmentId);
      const items = assessmentQuestions(tenantId, assessmentId);
      const crops = [...answerCrops.values()].filter(
        (crop) => crop.tenantId === tenantId && crop.assessmentId === assessmentId
      );
      const results = [...studentResults.values()].filter(
        (result) => result.tenantId === tenantId && result.assessmentId === assessmentId
      );
      const conceptMap = new Map([...concepts.values()].map((concept) => [concept.id, { ...concept, marks: 0, max: 0 }]));
      for (const crop of crops) {
        const question = items.find((item) => item.id === crop.questionId);
        for (const conceptId of question?.conceptIds ?? []) {
          const concept = conceptMap.get(conceptId);
          if (concept) {
            concept.marks += crop.awardedMarks;
            concept.max += crop.maxMarks;
          }
        }
      }
      return {
        assessment: clone(assessment),
        summary: {
          studentsProcessed: results.length,
          classAverage:
            results.length > 0
              ? Number((results.reduce((sum, result) => sum + result.percentage, 0) / results.length).toFixed(1))
              : 0,
          reviewPending: [...reviewTasks.values()].filter(
            (task) => task.tenantId === tenantId && task.assessmentId === assessmentId && task.status === 'pending'
          ).length,
          autoScoredAnswers: crops.filter((crop) => crop.status === 'auto_scored').length,
          reviewedAnswers: crops.filter((crop) => crop.status === 'teacher_reviewed').length
        },
        concepts: [...conceptMap.values()]
          .filter((concept) => concept.max > 0)
          .map((concept) => ({
            id: concept.id,
            name: concept.name,
            subject: concept.subject,
            score: Number(((concept.marks / concept.max) * 100).toFixed(1)),
            awardedMarks: concept.marks,
            maxMarks: concept.max
          }))
      };
    },
    async createExport({ tenantId, requestedByUserId, body }) {
      await ensureLoaded();
      const analytics = await this.getAnalytics({ tenantId, assessmentId: body.assessmentId });
      const results = await this.listResults({ tenantId, assessmentId: body.assessmentId });
      const lines = [
        'studentId,awardedMarks,totalMarks,percentage,status',
        ...results.map(
          (result) =>
            `${result.studentId},${result.awardedMarks},${result.totalMarks},${result.percentage},${result.status}`
        )
      ];
      const job = {
        id: id('exp'),
        tenantId,
        exportType: body.exportType ?? 'class_result_csv',
        assessmentId: body.assessmentId,
        classSectionId: body.classSectionId ?? analytics.assessment.classSectionId,
        status: 'ready',
        requestedByUserId,
        createdAt: now(),
        readyAt: now(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        fileName: `${analytics.assessment.title.replaceAll(' ', '_')}_results.csv`,
        contentType: 'text/csv',
        content: lines.join('\n'),
        analytics
      };
      exportJobs.set(job.id, job);
      await persistWorkflow();
      return clone(job);
    },
    async getExport({ tenantId, exportJobId }) {
      await ensureLoaded();
      const job = exportJobs.get(exportJobId);
      if (!job || job.tenantId !== tenantId) {
        throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Export job was not found.');
      }
      return clone(job);
    },
    async getExportDownload({ tenantId, exportJobId }) {
      await ensureLoaded();
      const job = await this.getExport({ tenantId, exportJobId });
      return {
        fileName: job.fileName,
        contentType: job.contentType,
        content: job.content
      };
    }
  };
}
