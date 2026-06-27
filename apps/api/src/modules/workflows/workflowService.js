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

  function getResultKey(assessmentId, studentId) {
    return `${assessmentId}:${studentId}`;
  }

  function calculateRecognition(question, providedAnswer, imageQuality = 0.92) {
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
      return [...concepts.values()].filter((concept) => concept.tenantId === tenantId).map(clone);
    },
    async listAssessments({ tenantId, classSectionId = null }) {
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
      const assessment = ensureAssessment(tenantId, assessmentId);
      return {
        ...clone(assessment),
        questions: assessmentQuestions(tenantId, assessmentId).map(clone),
        template: [...templates.values()].find((template) => template.assessmentId === assessmentId) ?? null
      };
    },
    async createAssessment({ tenantId, body }) {
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
      return clone(assessment);
    },
    async addQuestion({ tenantId, assessmentId, body }) {
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
      return clone(question);
    },
    async publishAssessment({ tenantId, assessmentId }) {
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
      return clone({ assessment, template });
    },
    async listPaperBatches({ tenantId }) {
      return [...paperBatches.values()].filter((batch) => batch.tenantId === tenantId).map(clone);
    },
    async generatePaperBatch({ tenantId, createdByUserId, body }) {
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
          paperPages.set(page.id, page);
        }
      }

      return this.getPaperBatch({ tenantId, paperBatchId: batch.id });
    },
    async getPaperBatch({ tenantId, paperBatchId }) {
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
    async getPaperPageQr({ tenantId, paperPageId }) {
      const page = paperPages.get(paperPageId);
      if (!page || page.tenantId !== tenantId) {
        throw new ApiError(404, 'PAPER_PAGE_NOT_FOUND', 'Paper page was not found.');
      }
      return clone(page.qrPayload);
    },
    async createScanBatch({ tenantId, createdByUserId, body }) {
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
      return clone(batch);
    },
    async listScanBatches({ tenantId }) {
      return [...scanBatches.values()].filter((batch) => batch.tenantId === tenantId).map(clone);
    },
    async getScanBatch({ tenantId, scanBatchId }) {
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
      const batch = scanBatches.get(scanBatchId);
      if (!batch || batch.tenantId !== tenantId) {
        throw new ApiError(404, 'SCAN_BATCH_NOT_FOUND', 'Scan batch was not found.');
      }
      const scanPage = {
        id: id('sp'),
        tenantId,
        scanBatchId,
        status: 'uploaded',
        qrPayload: body.qrPayload,
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
      return clone(scanPage);
    },
    async listAnswerCrops({ tenantId, assessmentId }) {
      return [...answerCrops.values()]
        .filter((crop) => crop.tenantId === tenantId && (!assessmentId || crop.assessmentId === assessmentId))
        .map(clone);
    },
    async listReviewTasks({ tenantId, status = null }) {
      return [...reviewTasks.values()]
        .filter((task) => task.tenantId === tenantId && (!status || task.status === status))
        .map((task) => ({
          ...clone(task),
          crop: answerCrops.get(task.answerCropId) ? clone(answerCrops.get(task.answerCropId)) : null,
          question: questions.get(task.questionId) ? clone(questions.get(task.questionId)) : null
        }));
    },
    async decideReviewTask({ tenantId, taskId, body, reviewerUserId }) {
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
      return clone({ task, crop, question });
    },
    async listResults({ tenantId, assessmentId }) {
      ensureAssessment(tenantId, assessmentId);
      return [...studentResults.values()]
        .filter((result) => result.tenantId === tenantId && result.assessmentId === assessmentId)
        .map(clone);
    },
    async finalizeResults({ tenantId, assessmentId }) {
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
      return results.map(clone);
    },
    async getAnalytics({ tenantId, assessmentId }) {
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
      return clone(job);
    },
    async getExport({ tenantId, exportJobId }) {
      const job = exportJobs.get(exportJobId);
      if (!job || job.tenantId !== tenantId) {
        throw new ApiError(404, 'EXPORT_NOT_FOUND', 'Export job was not found.');
      }
      return clone(job);
    }
  };
}
