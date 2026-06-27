import { Router } from 'express';
import { hasPermission, requirePermission } from '../../common/authorization.js';
import { ApiError, asyncHandler, sendCreated, sendSuccess } from '../../common/http.js';
import { requiredString } from '../../common/validation.js';
import { createWorkflowService } from './workflowService.js';

function canAuthor(auth) {
  return hasPermission(auth, 'assessment:manage', 'school:manage');
}

function canGeneratePaperBatch(auth) {
  return canAuthor(auth) || hasPermission(auth, 'scan:create');
}

function requireAuthor(request, response, next) {
  if (!canAuthor(request.auth)) {
    next(new ApiError(403, 'FORBIDDEN', 'Assessment management permission is required.'));
    return;
  }
  next();
}

function requirePaperGeneration(request, response, next) {
  if (!canGeneratePaperBatch(request.auth)) {
    next(new ApiError(403, 'FORBIDDEN', 'Paper generation or scan permission is required.'));
    return;
  }
  next();
}

export function createWorkflowRouter({ store, requireAuth }) {
  const router = Router();
  const workflows = createWorkflowService(store);
  const requireReview = requirePermission('review:write', 'assessment:manage', 'school:manage');
  const requireExport = requirePermission('result:read', 'assessment:manage', 'school:manage');

  router.use(requireAuth);

  router.get(
    '/concepts',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await workflows.listConcepts({ tenantId: request.auth.user.tenantId }));
    })
  );

  router.get(
    '/assessments',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.listAssessments({
          tenantId: request.auth.user.tenantId,
          classSectionId: request.query.classSectionId
        })
      );
    })
  );

  router.post(
    '/assessments',
    requireAuthor,
    asyncHandler(async (request, response) => {
      requiredString(request.body.title, 'title');
      sendCreated(
        response,
        await workflows.createAssessment({
          tenantId: request.auth.user.tenantId,
          body: request.body
        })
      );
    })
  );

  router.get(
    '/assessments/:assessmentId',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getAssessment({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId
        })
      );
    })
  );

  router.post(
    '/assessments/:assessmentId/questions',
    requireAuthor,
    asyncHandler(async (request, response) => {
      requiredString(request.body.prompt, 'prompt');
      sendCreated(
        response,
        await workflows.addQuestion({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId,
          body: request.body
        })
      );
    })
  );

  router.post(
    '/assessments/:assessmentId/publish',
    requireAuthor,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.publishAssessment({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId
        })
      );
    })
  );

  router.get(
    '/paper-batches',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await workflows.listPaperBatches({ tenantId: request.auth.user.tenantId }));
    })
  );

  router.post(
    '/paper-batches',
    requirePaperGeneration,
    asyncHandler(async (request, response) => {
      requiredString(request.body.assessmentId, 'assessmentId');
      sendCreated(
        response,
        await workflows.generatePaperBatch({
          tenantId: request.auth.user.tenantId,
          createdByUserId: request.auth.user.id,
          body: request.body
        })
      );
    })
  );

  router.get(
    '/paper-batches/:paperBatchId',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getPaperBatch({
          tenantId: request.auth.user.tenantId,
          paperBatchId: request.params.paperBatchId
        })
      );
    })
  );

  router.get(
    '/paper-batches/:paperBatchId/print',
    requireExport,
    asyncHandler(async (request, response) => {
      const artifact = await workflows.getPrintablePaperBatch({
        tenantId: request.auth.user.tenantId,
        paperBatchId: request.params.paperBatchId
      });
      response
        .status(200)
        .type(artifact.contentType)
        .setHeader('Content-Disposition', `inline; filename="${artifact.fileName}"`)
        .send(artifact.content);
    })
  );

  router.get(
    '/paper-pages/:paperPageId/qr',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getPaperPageQr({
          tenantId: request.auth.user.tenantId,
          paperPageId: request.params.paperPageId
        })
      );
    })
  );

  router.get(
    '/paper-pages/:paperPageId/qr.svg',
    asyncHandler(async (request, response) => {
      const artifact = await workflows.getPaperPageQrSvg({
        tenantId: request.auth.user.tenantId,
        paperPageId: request.params.paperPageId
      });
      response
        .status(200)
        .type(artifact.contentType)
        .setHeader('Content-Disposition', `inline; filename="${artifact.fileName}"`)
        .send(artifact.content);
    })
  );

  router.get(
    '/scan-batches',
    asyncHandler(async (request, response) => {
      sendSuccess(response, await workflows.listScanBatches({ tenantId: request.auth.user.tenantId }));
    })
  );

  router.post(
    '/scan-batches',
    asyncHandler(async (request, response) => {
      requiredString(request.body.assessmentId, 'assessmentId');
      sendCreated(
        response,
        await workflows.createScanBatch({
          tenantId: request.auth.user.tenantId,
          createdByUserId: request.auth.user.id,
          body: request.body
        })
      );
    })
  );

  router.get(
    '/scan-batches/:scanBatchId',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getScanBatch({
          tenantId: request.auth.user.tenantId,
          scanBatchId: request.params.scanBatchId
        })
      );
    })
  );

  router.post(
    '/scan-batches/:scanBatchId/pages',
    asyncHandler(async (request, response) => {
      sendCreated(
        response,
        await workflows.uploadScanPage({
          tenantId: request.auth.user.tenantId,
          scanBatchId: request.params.scanBatchId,
          body: request.body
        })
      );
    })
  );

  router.get(
    '/answer-crops',
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.listAnswerCrops({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.query.assessmentId
        })
      );
    })
  );

  router.get(
    '/review-tasks',
    requireReview,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.listReviewTasks({
          tenantId: request.auth.user.tenantId,
          status: request.query.status
        })
      );
    })
  );

  router.post(
    '/review-tasks/:taskId/decision',
    requireReview,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.decideReviewTask({
          tenantId: request.auth.user.tenantId,
          taskId: request.params.taskId,
          body: request.body,
          reviewerUserId: request.auth.user.id
        })
      );
    })
  );

  router.get(
    '/assessments/:assessmentId/results',
    requireExport,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.listResults({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId
        })
      );
    })
  );

  router.post(
    '/assessments/:assessmentId/finalize',
    requireExport,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.finalizeResults({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId
        })
      );
    })
  );

  router.get(
    '/analytics/assessments/:assessmentId/summary',
    requireExport,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getAnalytics({
          tenantId: request.auth.user.tenantId,
          assessmentId: request.params.assessmentId
        })
      );
    })
  );

  router.post(
    '/exports',
    requireExport,
    asyncHandler(async (request, response) => {
      requiredString(request.body.assessmentId, 'assessmentId');
      sendCreated(
        response,
        await workflows.createExport({
          tenantId: request.auth.user.tenantId,
          requestedByUserId: request.auth.user.id,
          body: request.body
        })
      );
    })
  );

  router.get(
    '/exports/:exportJobId',
    requireExport,
    asyncHandler(async (request, response) => {
      sendSuccess(
        response,
        await workflows.getExport({
          tenantId: request.auth.user.tenantId,
          exportJobId: request.params.exportJobId
        })
      );
    })
  );

  router.get(
    '/exports/:exportJobId/download',
    requireExport,
    asyncHandler(async (request, response) => {
      const artifact = await workflows.getExportDownload({
        tenantId: request.auth.user.tenantId,
        exportJobId: request.params.exportJobId
      });
      response
        .status(200)
        .type(artifact.contentType)
        .setHeader('Content-Disposition', `attachment; filename="${artifact.fileName}"`)
        .send(artifact.content);
    })
  );

  return router;
}
