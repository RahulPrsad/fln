import { Router } from 'express';
import { requirePermission } from '../../common/authorization.js';
import { asyncHandler, sendSuccess } from '../../common/http.js';

function configured(value) {
  return Boolean(value && !String(value).includes('<') && !String(value).startsWith('replace-this'));
}

function secretConfigured(value, devFallback) {
  return configured(value) && value !== devFallback;
}

export function createSystemRouter({ config, requireAuth }) {
  const router = Router();
  const requireAdmin = requirePermission('school:manage', 'audit:read');

  router.use(requireAuth);
  router.use(requireAdmin);

  router.get(
    '/requirements',
    asyncHandler(async (request, response) => {
      sendSuccess(response, {
        environment: config.environment,
        storeProvider: config.storeProvider,
        requiredForProduction: [
          {
            key: 'SMARTFLN_MONGO_URI',
            label: 'MongoDB Atlas connection URI',
            configured: config.storeProvider === 'mongo' && configured(config.mongoUri)
          },
          {
            key: 'SMARTFLN_MONGO_DB_NAME',
            label: 'MongoDB database name',
            configured: configured(config.mongoDbName)
          },
          {
            key: 'SMARTFLN_JWT_SECRET',
            label: 'JWT signing secret',
            configured: secretConfigured(config.jwtSecret, 'dev-only-smartfln-secret-change-me')
          },
          {
            key: 'SMARTFLN_QR_SIGNING_SECRET',
            label: 'QR signing secret',
            configured: secretConfigured(config.qrSigningSecret, 'dev-only-qr-secret-change-me')
          },
          {
            key: 'SMARTFLN_CORS_ORIGINS',
            label: 'Allowed web origins',
            configured: config.corsOrigins.length > 0
          },
          {
            key: 'SMARTFLN_PUBLIC_APP_URL',
            label: 'Public web app URL',
            configured: configured(config.publicAppUrl)
          },
          {
            key: 'SMARTFLN_PUBLIC_API_URL',
            label: 'Public API URL',
            configured: configured(config.publicApiUrl)
          },
          {
            key: 'SMARTFLN_OBJECT_STORAGE_BUCKET',
            label: 'Object storage bucket',
            configured: configured(config.objectStorageBucket)
          },
          {
            key: 'SMARTFLN_R2_ACCOUNT_ID',
            label: 'Cloudflare R2 account id',
            configured: config.objectStorageProvider !== 'r2' || configured(config.r2AccountId)
          },
          {
            key: 'SMARTFLN_R2_ACCESS_KEY_ID',
            label: 'Cloudflare R2 access key id',
            configured: config.objectStorageProvider !== 'r2' || configured(config.r2AccessKeyId)
          },
          {
            key: 'SMARTFLN_R2_SECRET_ACCESS_KEY',
            label: 'Cloudflare R2 secret access key',
            configured: config.objectStorageProvider !== 'r2' || configured(config.r2SecretAccessKey)
          },
          {
            key: 'SMARTFLN_R2_ENDPOINT_URL',
            label: 'Cloudflare R2 endpoint URL',
            configured: config.objectStorageProvider !== 'r2' || configured(config.r2EndpointUrl)
          },
          {
            key: 'SMARTFLN_TWILIO_ACCOUNT_SID',
            label: 'Twilio account SID',
            configured: config.smsProvider !== 'twilio' || configured(config.twilioAccountSid)
          },
          {
            key: 'SMARTFLN_TWILIO_AUTH_TOKEN',
            label: 'Twilio auth token',
            configured: config.smsProvider !== 'twilio' || configured(config.twilioAuthToken)
          },
          {
            key: 'SMARTFLN_TWILIO_FROM_NUMBER',
            label: 'Twilio sender number',
            configured: config.smsProvider !== 'twilio' || configured(config.twilioFromNumber)
          },
          {
            key: 'SMARTFLN_RESEND_API_KEY',
            label: 'Resend API key',
            configured: config.emailProvider !== 'resend' || configured(config.resendApiKey)
          },
          {
            key: 'SMARTFLN_EMAIL_FROM',
            label: 'Transactional email sender',
            configured: config.emailProvider !== 'resend' || configured(config.emailFrom)
          },
          {
            key: 'SMARTFLN_SENTRY_DSN',
            label: 'Sentry DSN',
            configured: configured(config.sentryDsn)
          }
        ],
        optionalIntegrations: [
          'SMS provider for OTP delivery',
          'Email provider for reports and invites',
          'OpenAI or custom HTR model endpoint',
          'Sentry or equivalent error tracking',
          'Analytics warehouse for large multi-school reporting'
        ]
      });
    })
  );

  return router;
}
