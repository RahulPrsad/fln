# SmartFLN API Specification

AI Powered QR Enabled Assessment System

## Purpose

This document defines the production REST API surface for SmartFLN. It covers authentication, JWT, request and response standards, errors, status codes, pagination, versioning, file upload patterns, Swagger/OpenAPI structure, and the REST endpoints required for the product.

This is an API contract document only. It does not contain implementation code.

## API Design Principles

- APIs are tenant-scoped by default.
- APIs are versioned from day one.
- Authentication and authorization are enforced at the API Gateway and again inside services.
- Long-running work is asynchronous.
- Binary files are uploaded and downloaded through signed URLs, not passed through normal JSON APIs.
- Mutating requests that can be retried must support idempotency keys.
- Responses must be predictable, typed, and traceable.
- Every error must be actionable.
- Every request must carry a correlation id.
- Final marks, review actions, exports, and admin changes must be auditable.

## Base URLs

### Production

`https://api.smartfln.com/api/v1`

### Staging

`https://staging-api.smartfln.com/api/v1`

### Local Development

`http://localhost:8080/api/v1`

## API Versioning

### Version Format

SmartFLN uses URI-based major versioning:

`/api/v1/...`

Rules:

- Breaking changes require a new major version, such as `/api/v2`.
- Additive fields may be added in the same version.
- Clients must ignore unknown response fields.
- Deprecated endpoints must include a deprecation notice before removal.
- API version must also appear in Swagger/OpenAPI metadata.

### Header Version Metadata

Responses should include:

| Header | Purpose |
| --- | --- |
| `X-API-Version` | API major version |
| `X-Request-ID` | Request id |
| `X-Correlation-ID` | Cross-service trace id |
| `Deprecation` | Deprecation marker when applicable |
| `Sunset` | Planned removal date when applicable |

## Authentication

### Authentication Methods

SmartFLN supports:

- mobile OTP login for teachers
- email/password login for admins
- refresh token rotation
- device session management
- future SSO using OIDC/SAML for institutional deployments

### Authorization Header

Authenticated requests must include:

`Authorization: Bearer <access_token>`

### Required Client Headers

| Header | Required | Purpose |
| --- | --- | --- |
| `Authorization` | Yes except public endpoints | JWT access token |
| `X-Tenant-ID` | Yes after login where tenant is not implied | Tenant context |
| `X-School-ID` | Optional | School context for scoped dashboards |
| `X-Request-ID` | Recommended | Client-generated request id |
| `X-Correlation-ID` | Optional | End-to-end workflow trace |
| `Idempotency-Key` | Required for retryable mutations | Prevent duplicate writes |
| `Content-Type` | Yes for request bodies | Usually `application/json` |
| `Accept` | Recommended | Usually `application/json` |
| `X-Client-Type` | Recommended | mobile, web, admin, integration |
| `X-Client-Version` | Recommended | App version |
| `X-Device-ID` | Required for mobile | Device session binding |

## JWT

### Token Types

| Token | Lifetime | Purpose |
| --- | --- | --- |
| Access token | Short-lived, such as 15 minutes | API authentication |
| Refresh token | Longer-lived, rotated | Session renewal |
| Upload token | Very short-lived signed URL token | Direct file upload |
| Download token | Very short-lived signed URL token | Secure file download |
| Service token | Short-lived internal token | Service-to-service calls |

### JWT Claims

Access token should include:

| Claim | Meaning |
| --- | --- |
| `iss` | Issuer |
| `sub` | User id |
| `aud` | API audience |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |
| `jti` | Token id |
| `tenant_id` | Tenant scope |
| `school_ids` | Allowed schools |
| `class_section_ids` | Allowed class sections where relevant |
| `roles` | Assigned roles |
| `permissions` | Permission keys or permission version reference |
| `session_id` | Device or browser session id |
| `device_id` | Device id for mobile sessions |

### JWT Security Rules

- Access tokens must be short-lived.
- Refresh tokens must rotate.
- Refresh token reuse must revoke the session.
- Role changes should invalidate or refresh permission claims.
- Tokens must be signed with managed keys.
- Private keys must never be exposed to clients.
- Clients must not rely on JWT alone for authorization decisions.

## Roles and Permissions

### Standard Roles

| Role | Description |
| --- | --- |
| `teacher` | Scan papers, review assigned assessments, view own classes |
| `school_academic_coordinator` | Monitor classes, resolve escalations, view school analytics |
| `school_admin` | Manage school setup, users, rosters, reports |
| `program_admin` | Manage multiple schools and program analytics |
| `tenant_admin` | Manage tenant-level configuration |
| `support_operator` | Audited support access |
| `platform_admin` | Platform operations |

### Authorization Model

Use RBAC plus scoped attributes:

- tenant
- school
- class section
- subject
- assessment
- teacher assignment
- academic year

## Request Format

### Standard JSON Request

Requests should use JSON with camelCase fields.

Example:

```json
{
  "title": "Math Baseline Assessment",
  "gradeLevel": 3,
  "subjectId": "sub_123",
  "assessmentType": "formative"
}
```

### Idempotent Mutation Request

For retryable write operations, clients must send:

`Idempotency-Key: <unique-client-generated-key>`

Required for:

- login verification
- upload confirmation
- paper generation
- review action submission
- finalization
- export request
- import request
- reprocessing request

## Response Format

### Success Envelope

All successful JSON responses should use:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123",
    "correlationId": "corr_123",
    "apiVersion": "v1"
  }
}
```

### List Response Envelope

```json
{
  "data": [],
  "pagination": {
    "limit": 25,
    "nextCursor": "eyJpZCI6IjEyMyJ9",
    "previousCursor": null,
    "hasMore": true
  },
  "meta": {
    "requestId": "req_123",
    "correlationId": "corr_123",
    "apiVersion": "v1"
  }
}
```

### Async Job Response

```json
{
  "data": {
    "jobId": "job_123",
    "status": "queued",
    "statusUrl": "/api/v1/exports/jobs/job_123"
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

## Error Format

### Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "gradeLevel",
        "issue": "Grade level must be between 1 and 5."
      }
    ],
    "requestId": "req_123",
    "correlationId": "corr_123"
  }
}
```

### Standard Error Codes

| Code | Meaning |
| --- | --- |
| `AUTHENTICATION_REQUIRED` | Missing or invalid token |
| `TOKEN_EXPIRED` | Access token expired |
| `REFRESH_TOKEN_INVALID` | Refresh token invalid or reused |
| `FORBIDDEN` | User lacks permission |
| `TENANT_REQUIRED` | Tenant context missing |
| `TENANT_SUSPENDED` | Tenant is inactive or suspended |
| `VALIDATION_ERROR` | Request body or query invalid |
| `RESOURCE_NOT_FOUND` | Resource not found or not visible |
| `RESOURCE_CONFLICT` | Duplicate or conflicting state |
| `IDEMPOTENCY_CONFLICT` | Idempotency key reused with different payload |
| `UNPROCESSABLE_ENTITY` | Valid JSON but business rule failed |
| `RATE_LIMITED` | Request exceeded rate limit |
| `PAYLOAD_TOO_LARGE` | Request body too large |
| `UNSUPPORTED_MEDIA_TYPE` | Invalid content type |
| `SCAN_QUALITY_FAILED` | Scan cannot be processed reliably |
| `REVIEW_REQUIRED` | Operation blocked by pending review |
| `FINALIZATION_BLOCKED` | Assessment cannot be finalized |
| `EXPORT_NOT_READY` | Export still processing |
| `INTERNAL_ERROR` | Unexpected server error |
| `SERVICE_UNAVAILABLE` | Dependency unavailable |

## HTTP Status Codes

| Status | Use |
| --- | --- |
| `200 OK` | Successful read or update |
| `201 Created` | Resource created |
| `202 Accepted` | Async job accepted |
| `204 No Content` | Successful delete/archive without body |
| `400 Bad Request` | Malformed request |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but not allowed |
| `404 Not Found` | Resource not found or hidden by authorization |
| `409 Conflict` | Duplicate or invalid state transition |
| `412 Precondition Failed` | Version or ETag mismatch |
| `413 Payload Too Large` | Upload or payload too large |
| `415 Unsupported Media Type` | Wrong content type |
| `422 Unprocessable Entity` | Business validation failed |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server failure |
| `502 Bad Gateway` | Upstream failure |
| `503 Service Unavailable` | Temporary service outage |
| `504 Gateway Timeout` | Upstream timeout |

## Pagination

### Cursor Pagination

Cursor pagination is preferred for large lists.

Query parameters:

| Parameter | Description |
| --- | --- |
| `limit` | Page size, default 25, max 100 |
| `cursor` | Cursor returned by previous response |
| `sort` | Sort field |
| `order` | asc or desc |

Example:

`GET /api/v1/students?limit=25&cursor=abc`

### Offset Pagination

Offset pagination may be used for small admin lists only.

Query parameters:

- `page`
- `pageSize`

### Filtering

Common filters:

- `schoolId`
- `classSectionId`
- `assessmentId`
- `studentId`
- `status`
- `gradeLevel`
- `subjectId`
- `fromDate`
- `toDate`
- `search`

## Sorting

Sort format:

`sort=createdAt&order=desc`

Allowed sort fields must be endpoint-specific and documented in Swagger.

## Rate Limiting

Rate limits should vary by endpoint and role.

| Endpoint Type | Limit Strategy |
| --- | --- |
| Login and OTP | Strict per phone/email/IP/device |
| General reads | Per user and tenant |
| Mutations | Per user, tenant, and resource |
| Upload session creation | Per teacher and assessment |
| Export jobs | Per user and tenant |
| Admin imports | Per tenant |
| Public health endpoints | Lightweight global limits |

Responses should include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## File Upload and Download Pattern

### Upload Flow

1. Client requests upload session.
2. API returns signed upload URL.
3. Client uploads file directly to object storage.
4. Client confirms upload with checksum and metadata.
5. Backend publishes processing event.

### Download Flow

1. Client requests artifact access.
2. API validates authorization.
3. API returns short-lived signed download URL.
4. Client downloads directly from object storage.

### File Rules

- Normal REST APIs must not accept large image payloads.
- Signed upload URLs must be short-lived.
- Upload confirmation must include checksum.
- File access must be audited for sensitive artifacts.

## API Resource Naming

Use plural nouns:

- `/students`
- `/assessments`
- `/scan-batches`
- `/review-tasks`

Use action endpoints only for lifecycle commands:

- `/publish`
- `/finalize`
- `/archive`
- `/confirm`
- `/retry`

## Public and System APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health/live` | No | Liveness check |
| GET | `/health/ready` | No | Readiness check |
| GET | `/version` | No | API build and version metadata |
| GET | `/status` | Optional | Public service status summary |

## Authentication APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | No | Request teacher OTP |
| POST | `/auth/otp/verify` | No | Verify OTP and create session |
| POST | `/auth/login` | No | Email/password login |
| POST | `/auth/refresh` | Refresh token | Rotate refresh token and issue new access token |
| POST | `/auth/logout` | Yes | Revoke current session |
| POST | `/auth/logout-all` | Yes | Revoke all user sessions |
| GET | `/auth/me` | Yes | Get current user profile and permissions |
| PATCH | `/auth/me` | Yes | Update current user profile |
| POST | `/auth/password/forgot` | No | Start password reset |
| POST | `/auth/password/reset` | Reset token | Complete password reset |
| POST | `/auth/password/change` | Yes | Change own password |
| GET | `/auth/sessions` | Yes | List active sessions |
| DELETE | `/auth/sessions/{sessionId}` | Yes | Revoke one session |
| POST | `/auth/mfa/setup` | Yes | Start MFA setup for admins |
| POST | `/auth/mfa/verify` | Yes | Verify MFA setup or login challenge |
| POST | `/auth/mfa/disable` | Yes | Disable MFA with policy checks |

### Login Request

```json
{
  "email": "teacher@school.edu",
  "password": "********",
  "deviceId": "device_123",
  "clientType": "web"
}
```

### Login Response

```json
{
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 900,
    "user": {
      "id": "usr_123",
      "displayName": "Anita Sharma",
      "roles": ["teacher"],
      "tenantId": "ten_123"
    }
  }
}
```

## Tenant and School APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/tenants/current` | Yes | Get active tenant context |
| PATCH | `/tenants/current/settings` | Tenant admin | Update tenant settings |
| GET | `/schools` | Yes | List schools visible to user |
| POST | `/schools` | Tenant admin | Create school |
| GET | `/schools/{schoolId}` | Yes | Get school |
| PATCH | `/schools/{schoolId}` | School admin | Update school |
| POST | `/schools/{schoolId}/archive` | Tenant admin | Archive school |
| GET | `/academic-years` | Yes | List academic years |
| POST | `/academic-years` | Tenant admin | Create academic year |
| GET | `/academic-years/{academicYearId}` | Yes | Get academic year |
| PATCH | `/academic-years/{academicYearId}` | Tenant admin | Update academic year |
| POST | `/academic-years/{academicYearId}/close` | Tenant admin | Close academic year |

## Class and Section APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/class-sections` | Yes | List class sections |
| POST | `/class-sections` | School admin | Create class section |
| GET | `/class-sections/{classSectionId}` | Yes | Get class section |
| PATCH | `/class-sections/{classSectionId}` | School admin | Update class section |
| POST | `/class-sections/{classSectionId}/archive` | School admin | Archive class section |
| GET | `/class-sections/{classSectionId}/students` | Teacher/admin | List enrolled students |
| GET | `/class-sections/{classSectionId}/teachers` | Admin | List assigned teachers |
| POST | `/class-sections/{classSectionId}/teachers` | Admin | Assign teacher |
| DELETE | `/class-sections/{classSectionId}/teachers/{userId}` | Admin | Remove teacher assignment |

## User and Role APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | Admin | List users |
| POST | `/users` | Admin | Create or invite user |
| GET | `/users/{userId}` | Admin/self | Get user |
| PATCH | `/users/{userId}` | Admin/self | Update user |
| POST | `/users/{userId}/activate` | Admin | Activate user |
| POST | `/users/{userId}/lock` | Admin | Lock user |
| POST | `/users/{userId}/disable` | Admin | Disable user |
| GET | `/users/{userId}/roles` | Admin | List role assignments |
| POST | `/users/{userId}/roles` | Admin | Assign role |
| DELETE | `/users/{userId}/roles/{assignmentId}` | Admin | Revoke role assignment |
| GET | `/roles` | Admin | List roles |
| GET | `/permissions` | Admin | List permissions |

## Roster APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/students` | Teacher/admin | List students |
| POST | `/students` | Admin | Create student |
| GET | `/students/{studentId}` | Teacher/admin | Get student |
| PATCH | `/students/{studentId}` | Admin | Update student |
| POST | `/students/{studentId}/archive` | Admin | Archive student |
| GET | `/students/{studentId}/enrollments` | Teacher/admin | List enrollments |
| POST | `/students/{studentId}/enrollments` | Admin | Enroll student |
| PATCH | `/enrollments/{enrollmentId}` | Admin | Update enrollment |
| POST | `/enrollments/{enrollmentId}/withdraw` | Admin | Withdraw enrollment |
| POST | `/students/imports` | Admin | Create roster import job |
| GET | `/students/imports/{importId}` | Admin | Get import status |
| POST | `/students/imports/{importId}/commit` | Admin | Commit validated import |
| GET | `/students/{studentId}/guardians` | Admin | List guardian contacts |
| POST | `/students/{studentId}/guardians` | Admin | Create guardian contact |
| PATCH | `/guardians/{guardianId}` | Admin | Update guardian contact |
| DELETE | `/guardians/{guardianId}` | Admin | Remove guardian contact |

## Curriculum APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/subjects` | Yes | List subjects |
| POST | `/subjects` | Admin | Create subject |
| GET | `/subjects/{subjectId}` | Yes | Get subject |
| PATCH | `/subjects/{subjectId}` | Admin | Update subject |
| POST | `/subjects/{subjectId}/archive` | Admin | Archive subject |
| GET | `/concepts` | Yes | List concepts |
| POST | `/concepts` | Admin | Create concept |
| GET | `/concepts/{conceptId}` | Yes | Get concept |
| PATCH | `/concepts/{conceptId}` | Admin | Update concept |
| POST | `/concepts/{conceptId}/archive` | Admin | Archive concept |
| GET | `/concepts/{conceptId}/children` | Yes | List child concepts |

## Assessment APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/assessments` | Teacher/admin | List assessments |
| POST | `/assessments` | Teacher/admin | Create assessment |
| GET | `/assessments/{assessmentId}` | Teacher/admin | Get assessment |
| PATCH | `/assessments/{assessmentId}` | Creator/admin | Update draft assessment |
| POST | `/assessments/{assessmentId}/duplicate` | Teacher/admin | Duplicate assessment |
| POST | `/assessments/{assessmentId}/publish` | Admin/authorized teacher | Publish assessment |
| POST | `/assessments/{assessmentId}/archive` | Admin | Archive assessment |
| GET | `/assessments/{assessmentId}/sections` | Teacher/admin | List assessment sections |
| POST | `/assessments/{assessmentId}/sections` | Creator/admin | Create section |
| PATCH | `/assessment-sections/{sectionId}` | Creator/admin | Update section |
| DELETE | `/assessment-sections/{sectionId}` | Creator/admin | Delete draft section |
| GET | `/assessments/{assessmentId}/questions` | Teacher/admin | List questions |
| POST | `/assessments/{assessmentId}/questions` | Creator/admin | Create question |
| GET | `/questions/{questionId}` | Teacher/admin | Get question |
| PATCH | `/questions/{questionId}` | Creator/admin | Update draft question |
| DELETE | `/questions/{questionId}` | Creator/admin | Delete draft question |
| POST | `/assessments/{assessmentId}/questions/reorder` | Creator/admin | Reorder questions |
| GET | `/questions/{questionId}/answer-keys` | Teacher/admin | List answer keys |
| POST | `/questions/{questionId}/answer-keys` | Creator/admin | Add answer key |
| PATCH | `/answer-keys/{answerKeyId}` | Creator/admin | Update answer key |
| DELETE | `/answer-keys/{answerKeyId}` | Creator/admin | Delete answer key |
| GET | `/questions/{questionId}/rubrics` | Teacher/admin | List rubrics |
| POST | `/questions/{questionId}/rubrics` | Creator/admin | Add rubric item |
| PATCH | `/rubrics/{rubricId}` | Creator/admin | Update rubric item |
| DELETE | `/rubrics/{rubricId}` | Creator/admin | Delete rubric item |
| GET | `/questions/{questionId}/concepts` | Teacher/admin | List mapped concepts |
| PUT | `/questions/{questionId}/concepts` | Creator/admin | Replace concept mappings |
| POST | `/assessments/{assessmentId}/assignments` | Admin | Assign assessment to classes |
| GET | `/assessments/{assessmentId}/assignments` | Teacher/admin | List assessment assignments |

### Create Assessment Request

```json
{
  "title": "Grade 3 Math Baseline",
  "subjectId": "sub_123",
  "gradeLevel": 3,
  "academicYearId": "ay_2026",
  "assessmentType": "formative",
  "totalMarks": 20
}
```

## Template APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/assessments/{assessmentId}/templates` | Teacher/admin | List template versions |
| POST | `/assessments/{assessmentId}/templates` | Creator/admin | Create template draft |
| GET | `/templates/{templateVersionId}` | Teacher/admin | Get template version |
| PATCH | `/templates/{templateVersionId}` | Creator/admin | Update draft template metadata |
| POST | `/templates/{templateVersionId}/validate` | Creator/admin | Validate template layout |
| POST | `/templates/{templateVersionId}/publish` | Admin | Publish immutable template |
| GET | `/templates/{templateVersionId}/pages` | Teacher/admin | List page templates |
| POST | `/templates/{templateVersionId}/pages` | Creator/admin | Add page template |
| PATCH | `/page-templates/{pageTemplateId}` | Creator/admin | Update draft page template |
| DELETE | `/page-templates/{pageTemplateId}` | Creator/admin | Delete draft page template |
| GET | `/page-templates/{pageTemplateId}/answer-regions` | Teacher/admin | List answer regions |
| POST | `/page-templates/{pageTemplateId}/answer-regions` | Creator/admin | Create answer region |
| PATCH | `/answer-regions/{answerRegionId}` | Creator/admin | Update answer region |
| DELETE | `/answer-regions/{answerRegionId}` | Creator/admin | Delete answer region |

## Paper Generation and QR APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/print-batches` | Teacher/admin | Generate printable paper batch |
| GET | `/print-batches` | Teacher/admin | List print batches |
| GET | `/print-batches/{printBatchId}` | Teacher/admin | Get print batch status |
| POST | `/print-batches/{printBatchId}/cancel` | Creator/admin | Cancel generation if not ready |
| GET | `/print-batches/{printBatchId}/download` | Teacher/admin | Get signed PDF download URL |
| GET | `/print-batches/{printBatchId}/paper-instances` | Teacher/admin | List generated paper instances |
| GET | `/paper-instances/{paperInstanceId}` | Teacher/admin | Get paper instance |
| POST | `/paper-instances/{paperInstanceId}/void` | Admin | Void paper instance |
| GET | `/paper-pages/{paperPageId}/qr` | Admin/internal | Get QR metadata |
| POST | `/print-batches/{printBatchId}/validate-sample` | Teacher/admin | Validate sample print scan |

### Generate Print Batch Request

```json
{
  "assessmentId": "asm_123",
  "classSectionId": "cls_123",
  "templateVersionId": "tpl_123",
  "paperMode": "student_specific"
}
```

### Generate Print Batch Response

Returns `202 Accepted` because PDF generation may be asynchronous.

```json
{
  "data": {
    "printBatchId": "pb_123",
    "status": "queued",
    "statusUrl": "/api/v1/print-batches/pb_123"
  }
}
```

## Mobile Scan APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/mobile/bootstrap` | Teacher | Load teacher mobile context |
| GET | `/mobile/assessments` | Teacher | List assigned mobile assessments |
| GET | `/mobile/assessments/{assessmentId}/scan-checklist` | Teacher | Get expected students/pages |
| POST | `/scan-batches` | Teacher | Create scan batch |
| GET | `/scan-batches` | Teacher/admin | List scan batches |
| GET | `/scan-batches/{scanBatchId}` | Teacher/admin | Get scan batch |
| POST | `/scan-batches/{scanBatchId}/complete` | Teacher | Mark scan batch upload complete |
| POST | `/scan-pages/upload-sessions` | Teacher | Create signed image upload session |
| POST | `/scan-pages/{scanPageId}/confirm-upload` | Teacher | Confirm image upload |
| GET | `/scan-pages/{scanPageId}` | Teacher/admin | Get scanned page status |
| POST | `/scan-pages/{scanPageId}/replace` | Teacher | Replace bad scan with new upload |
| POST | `/scan-pages/{scanPageId}/mark-duplicate` | Teacher/admin | Resolve duplicate scan |
| POST | `/scan-pages/{scanPageId}/request-rescan` | Teacher/admin/system | Request rescan |
| GET | `/scan-batches/{scanBatchId}/missing-pages` | Teacher/admin | List missing pages |
| GET | `/scan-batches/{scanBatchId}/processing-summary` | Teacher/admin | Get processing progress |

### Create Upload Session Request

```json
{
  "scanBatchId": "sb_123",
  "assessmentId": "asm_123",
  "clientFileName": "page-001.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 1849200,
  "capturedAt": "2026-06-26T10:15:00Z",
  "deviceId": "device_123"
}
```

### Upload Session Response

```json
{
  "data": {
    "scanPageId": "sp_123",
    "uploadUrl": "https://storage.example.com/signed-upload",
    "expiresAt": "2026-06-26T10:25:00Z",
    "requiredHeaders": {
      "Content-Type": "image/jpeg"
    }
  }
}
```

### Confirm Upload Request

```json
{
  "checksum": "sha256:abc123",
  "sizeBytes": 1849200,
  "imageWidth": 3024,
  "imageHeight": 4032,
  "localQualityScore": 0.92
}
```

## Processing and AI Pipeline APIs

These APIs are mainly for dashboards, admins, support tools, and internal service coordination.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/processing/scan-pages/{scanPageId}/stages` | Teacher/admin/support | List processing stages |
| GET | `/processing/scan-pages/{scanPageId}/diagnostics` | Admin/support | Get processing diagnostics |
| POST | `/processing/scan-pages/{scanPageId}/retry` | Admin/support | Retry processing for page |
| POST | `/processing/assessments/{assessmentId}/reprocess` | Admin/support | Reprocess assessment scope |
| GET | `/answer-crops/{answerCropId}` | Teacher/admin | Get answer crop metadata |
| GET | `/answer-crops/{answerCropId}/image` | Teacher/admin | Get signed crop image URL |
| GET | `/recognition-results/{recognitionResultId}` | Admin/support | Get recognition result |
| GET | `/score-results/{scoreResultId}` | Teacher/admin | Get score result |
| GET | `/model-versions` | Admin/support | List deployed model versions |
| GET | `/model-versions/{modelVersionId}` | Admin/support | Get model version metadata |

### Reprocess Request

```json
{
  "scope": "assessment",
  "mode": "comparison",
  "reason": "Evaluate new handwriting model",
  "modelVersionId": "mdl_123"
}
```

## Identity Resolution APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/identity-resolution-tasks` | Teacher/admin | List unresolved identity tasks |
| GET | `/identity-resolution-tasks/{taskId}` | Teacher/admin | Get task detail |
| POST | `/identity-resolution-tasks/{taskId}/resolve` | Teacher/admin | Resolve student/page identity |
| POST | `/identity-resolution-tasks/{taskId}/mark-invalid` | Teacher/admin | Mark page invalid |
| POST | `/identity-resolution-tasks/{taskId}/escalate` | Teacher | Escalate to admin |

## Teacher Review APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/review-tasks` | Teacher/admin | List review tasks |
| GET | `/review-tasks/summary` | Teacher/admin | Review counts by assessment/status |
| GET | `/review-tasks/{reviewTaskId}` | Teacher/admin | Get review task detail |
| POST | `/review-tasks/{reviewTaskId}/view` | Teacher/admin | Mark task viewed |
| POST | `/review-tasks/{reviewTaskId}/accept` | Teacher/admin | Accept AI score |
| POST | `/review-tasks/{reviewTaskId}/edit-answer` | Teacher/admin | Correct recognized answer |
| POST | `/review-tasks/{reviewTaskId}/override-marks` | Teacher/admin | Override marks |
| POST | `/review-tasks/{reviewTaskId}/mark-blank` | Teacher/admin | Mark answer blank |
| POST | `/review-tasks/{reviewTaskId}/mark-invalid` | Teacher/admin | Mark answer invalid |
| POST | `/review-tasks/{reviewTaskId}/escalate` | Teacher/admin | Escalate task |
| POST | `/review-tasks/{reviewTaskId}/resolve-escalation` | Coordinator/admin | Resolve escalation |
| POST | `/review-tasks/batch-actions` | Teacher/admin | Apply batch review actions where allowed |

### Review Task Response

```json
{
  "data": {
    "id": "rt_123",
    "status": "pending",
    "reasonCode": "low_confidence",
    "student": {
      "id": "stu_123",
      "displayName": "Riya"
    },
    "question": {
      "id": "q_123",
      "number": "5",
      "maxMarks": 2
    },
    "answerCrop": {
      "id": "crop_123",
      "imageUrl": "https://storage.example.com/signed-download"
    },
    "aiSuggestion": {
      "recognizedValue": "42",
      "suggestedMarks": 2,
      "confidence": 0.71
    }
  }
}
```

### Override Marks Request

```json
{
  "finalMarks": 1,
  "reason": "Student answer partially correct"
}
```

## Result APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/assessments/{assessmentId}/results` | Teacher/admin | List student results |
| GET | `/assessments/{assessmentId}/results/summary` | Teacher/admin | Assessment result summary |
| GET | `/students/{studentId}/assessments/{assessmentId}/result` | Teacher/admin | Get one student result |
| GET | `/students/{studentId}/results` | Teacher/admin | List student result history |
| GET | `/question-results` | Teacher/admin | Query question-level results |
| GET | `/concept-results` | Teacher/admin | Query concept-level results |
| POST | `/assessments/{assessmentId}/finalize` | Teacher/admin | Finalize assessment results |
| POST | `/assessments/{assessmentId}/unfinalize-request` | Admin | Request correction workflow |
| POST | `/result-corrections/{correctionId}/approve` | Admin | Approve correction |
| POST | `/question-results/{questionResultId}/correct` | Admin | Correct finalized question result |

### Finalize Request

```json
{
  "classSectionId": "cls_123",
  "finalizationNote": "All reviews completed"
}
```

### Finalization Blocked Response

Returns `422 Unprocessable Entity`.

```json
{
  "error": {
    "code": "FINALIZATION_BLOCKED",
    "message": "Assessment cannot be finalized because required tasks remain.",
    "details": [
      {
        "field": "reviewTasks",
        "issue": "3 required review tasks are pending."
      }
    ]
  }
}
```

## Analytics APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/analytics/teacher-dashboard` | Teacher | Teacher dashboard summary |
| GET | `/analytics/school-dashboard` | School admin | School dashboard summary |
| GET | `/analytics/program-dashboard` | Program admin | Multi-school summary |
| GET | `/analytics/assessments/{assessmentId}` | Teacher/admin | Assessment analytics |
| GET | `/analytics/assessments/{assessmentId}/concepts` | Teacher/admin | Concept performance |
| GET | `/analytics/assessments/{assessmentId}/questions` | Teacher/admin | Question performance |
| GET | `/analytics/assessments/{assessmentId}/students` | Teacher/admin | Student performance |
| GET | `/analytics/classes/{classSectionId}/concepts` | Teacher/admin | Class concept analytics |
| GET | `/analytics/students/{studentId}/concept-profile` | Teacher/admin | Longitudinal concept profile |
| GET | `/analytics/scan-quality` | Admin/support | Scan quality metrics |
| GET | `/analytics/ai-performance` | Admin/support | AI confidence and override metrics |

## Export APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/exports` | Teacher/admin | Request export |
| GET | `/exports` | Teacher/admin | List export jobs |
| GET | `/exports/{exportJobId}` | Teacher/admin | Get export status |
| GET | `/exports/{exportJobId}/download` | Teacher/admin | Get signed download URL |
| POST | `/exports/{exportJobId}/cancel` | Owner/admin | Cancel queued export |
| DELETE | `/exports/{exportJobId}` | Owner/admin | Delete expired or owned export |

### Export Request

```json
{
  "exportType": "class_result_pdf",
  "assessmentId": "asm_123",
  "classSectionId": "cls_123",
  "includeQuestionBreakdown": true,
  "includeConceptAnalytics": true
}
```

## Notification APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | Yes | List notifications |
| POST | `/notifications/{notificationId}/read` | Yes | Mark notification read |
| POST | `/notifications/read-all` | Yes | Mark all notifications read |
| GET | `/notification-preferences` | Yes | Get notification preferences |
| PATCH | `/notification-preferences` | Yes | Update notification preferences |
| POST | `/devices/register` | Yes | Register mobile push device |
| POST | `/devices/{deviceId}/unregister` | Yes | Unregister push device |

## Audit APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/audit-events` | Admin/support | Search audit events |
| GET | `/audit-events/{auditEventId}` | Admin/support | Get audit event |
| GET | `/assessments/{assessmentId}/audit` | Admin | Assessment audit trail |
| GET | `/students/{studentId}/audit` | Admin | Student data audit trail |
| GET | `/review-tasks/{reviewTaskId}/audit` | Admin | Review decision audit trail |
| GET | `/exports/{exportJobId}/audit` | Admin | Export audit trail |

## Support and Admin Operations APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/tenants` | Platform admin | List tenants |
| GET | `/admin/tenants/{tenantId}` | Platform admin | Get tenant |
| POST | `/admin/tenants/{tenantId}/suspend` | Platform admin | Suspend tenant |
| POST | `/admin/tenants/{tenantId}/reactivate` | Platform admin | Reactivate tenant |
| GET | `/admin/processing/backlog` | Support/admin | Processing backlog |
| GET | `/admin/dead-letter-messages` | Support/admin | List dead-letter messages |
| POST | `/admin/dead-letter-messages/{messageId}/replay` | Support/admin | Replay dead-letter message |
| POST | `/admin/dead-letter-messages/{messageId}/discard` | Support/admin | Discard with audit reason |
| GET | `/admin/storage/artifacts/{artifactId}` | Support/admin | Artifact metadata |
| POST | `/admin/support-access/request` | Support | Request just-in-time access |
| POST | `/admin/support-access/{requestId}/approve` | Admin | Approve support access |
| POST | `/admin/support-access/{requestId}/revoke` | Admin | Revoke support access |

## Integration APIs

These endpoints support future SIS, LMS, government, or partner integrations.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/integrations/external-systems` | Admin | List external systems |
| POST | `/integrations/external-systems` | Admin | Register external system |
| PATCH | `/integrations/external-systems/{systemId}` | Admin | Update external system |
| POST | `/integrations/sync-jobs` | Admin | Start sync job |
| GET | `/integrations/sync-jobs/{syncJobId}` | Admin | Get sync status |
| GET | `/integrations/mappings` | Admin | List external mappings |
| PUT | `/integrations/mappings` | Admin | Upsert external mappings |
| GET | `/webhooks/subscriptions` | Admin | List webhooks |
| POST | `/webhooks/subscriptions` | Admin | Create webhook subscription |
| PATCH | `/webhooks/subscriptions/{subscriptionId}` | Admin | Update webhook |
| DELETE | `/webhooks/subscriptions/{subscriptionId}` | Admin | Delete webhook |
| GET | `/webhooks/deliveries` | Admin | List webhook deliveries |
| POST | `/webhooks/deliveries/{deliveryId}/retry` | Admin | Retry webhook delivery |

## Internal Service APIs

Internal APIs must not be exposed publicly. They require service-to-service authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/internal/events/scan-uploaded` | Notify processing orchestrator |
| POST | `/internal/events/page-processed` | Notify page processing complete |
| POST | `/internal/events/answer-cropped` | Notify recognition workers |
| POST | `/internal/events/answer-recognized` | Notify evaluation service |
| POST | `/internal/events/answer-scored` | Notify review/results services |
| POST | `/internal/events/review-completed` | Notify analytics/result services |
| POST | `/internal/events/assessment-finalized` | Notify export/analytics services |
| GET | `/internal/tenants/{tenantId}/policy` | Load tenant policy |
| GET | `/internal/templates/{templateVersionId}` | Load template for processing |
| GET | `/internal/scans/{scanPageId}/artifacts` | Load artifact references |

## Common Resource Schemas

### User Summary

```json
{
  "id": "usr_123",
  "displayName": "Anita Sharma",
  "email": "anita@school.edu",
  "phone": "+919999999999",
  "status": "active",
  "roles": ["teacher"]
}
```

### Student Summary

```json
{
  "id": "stu_123",
  "displayName": "Riya Patel",
  "externalStudentId": "S-1001",
  "rollNumber": "12",
  "status": "active"
}
```

### Assessment Summary

```json
{
  "id": "asm_123",
  "title": "Grade 3 Math Baseline",
  "gradeLevel": 3,
  "subjectId": "sub_123",
  "status": "published",
  "totalMarks": 20
}
```

### Scan Page Summary

```json
{
  "id": "sp_123",
  "scanBatchId": "sb_123",
  "studentId": "stu_123",
  "pageNumber": 1,
  "uploadStatus": "confirmed",
  "processingStatus": "processed"
}
```

### Review Task Summary

```json
{
  "id": "rt_123",
  "assessmentId": "asm_123",
  "studentId": "stu_123",
  "questionId": "q_123",
  "status": "pending",
  "reasonCode": "low_confidence",
  "priority": "normal"
}
```

## Lifecycle Status Values

### Assessment Status

- `draft`
- `published`
- `archived`

### Scan Page Processing Status

- `queued`
- `processing`
- `processed`
- `failed`
- `rescan_required`
- `manual_resolution_required`

### Review Task Status

- `pending`
- `viewed`
- `resolved`
- `escalated`
- `cancelled`

### Result Status

- `provisional`
- `review_pending`
- `ready`
- `finalized`
- `corrected`

### Export Status

- `requested`
- `queued`
- `rendering`
- `ready`
- `failed`
- `expired`

## Swagger / OpenAPI Structure

### OpenAPI Metadata

Swagger should define:

- title: `SmartFLN API`
- version: `1.0.0`
- description: QR-enabled AI assessment platform REST API
- servers: production, staging, local
- security schemes: bearer JWT, service token, signed URL description
- tags by domain

### Recommended Tags

| Tag | Endpoints |
| --- | --- |
| Health | `/health`, `/version` |
| Auth | `/auth/*` |
| Tenants | `/tenants/*` |
| Schools | `/schools/*` |
| Classes | `/class-sections/*` |
| Users | `/users/*`, `/roles`, `/permissions` |
| Roster | `/students/*`, `/enrollments/*` |
| Curriculum | `/subjects/*`, `/concepts/*` |
| Assessments | `/assessments/*`, `/questions/*` |
| Templates | `/templates/*`, `/page-templates/*`, `/answer-regions/*` |
| Papers | `/print-batches/*`, `/paper-instances/*`, `/paper-pages/*` |
| Mobile | `/mobile/*` |
| Scans | `/scan-batches/*`, `/scan-pages/*` |
| Processing | `/processing/*`, `/answer-crops/*`, `/recognition-results/*`, `/score-results/*` |
| Identity Resolution | `/identity-resolution-tasks/*` |
| Review | `/review-tasks/*` |
| Results | `/results`, `/question-results`, `/concept-results` |
| Analytics | `/analytics/*` |
| Exports | `/exports/*` |
| Notifications | `/notifications/*`, `/devices/*` |
| Audit | `/audit-events/*` |
| Admin | `/admin/*` |
| Integrations | `/integrations/*`, `/webhooks/*` |
| Internal | `/internal/*` |

### OpenAPI Components

Swagger components should include:

#### Security Schemes

- `BearerAuth`
- `RefreshTokenAuth`
- `ServiceTokenAuth`

#### Common Parameters

- `TenantIdHeader`
- `SchoolIdHeader`
- `RequestIdHeader`
- `CorrelationIdHeader`
- `IdempotencyKeyHeader`
- `LimitQuery`
- `CursorQuery`
- `SortQuery`
- `OrderQuery`

#### Common Responses

- `BadRequest`
- `Unauthorized`
- `Forbidden`
- `NotFound`
- `Conflict`
- `ValidationError`
- `RateLimited`
- `InternalError`

#### Common Schemas

- `ApiSuccess`
- `ApiError`
- `Pagination`
- `User`
- `School`
- `Student`
- `ClassSection`
- `Assessment`
- `Question`
- `TemplateVersion`
- `PrintBatch`
- `ScanBatch`
- `ScanPage`
- `AnswerCrop`
- `RecognitionResult`
- `ScoreResult`
- `ReviewTask`
- `StudentResult`
- `ConceptResult`
- `ExportJob`
- `AuditEvent`

### Swagger Documentation Rules

Each endpoint must document:

- summary
- description
- tags
- operation id
- authentication requirement
- authorization scope
- path parameters
- query parameters
- headers
- request body schema
- success responses
- error responses
- idempotency requirement
- pagination behavior
- audit behavior where relevant

## API Security Requirements

- All production APIs require HTTPS.
- All authenticated endpoints require JWT.
- Tenant context must be validated on every request.
- File URLs must be signed and short-lived.
- Support access must be time-limited and audited.
- Review and mark-changing endpoints must write audit events.
- Admin and export endpoints require stricter rate limits.
- Request payloads must be size-limited.
- Input validation must be applied at API boundary and service layer.

## API Observability Requirements

Every API request should emit:

- request id
- correlation id
- tenant id where available
- user id where authenticated
- route template
- status code
- latency
- response size
- client type
- app version
- error code if failed

Sensitive data must not be logged.

## API Readiness Checklist

Before implementation:

- Confirm endpoint names and resource boundaries.
- Confirm role permissions per endpoint.
- Confirm JWT claim structure.
- Confirm pagination strategy.
- Confirm upload and download signed URL provider.
- Confirm idempotency storage strategy.
- Confirm Swagger generation approach.
- Confirm API gateway rate limits.

Before production:

- All endpoints covered in OpenAPI.
- All endpoints have authorization tests.
- All mutating endpoints have audit behavior where required.
- All async endpoints expose job status.
- All list endpoints support pagination.
- All file endpoints use signed URLs.
- All errors follow the standard envelope.

## Final API Principle

SmartFLN APIs must be boring in the best possible way: predictable, secure, versioned, observable, and hard to misuse. The product may do sophisticated AI work, but the API contract should remain simple and dependable for mobile apps, dashboards, integrations, and operations teams.
