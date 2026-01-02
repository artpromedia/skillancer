// @ts-nocheck
/**
 * @module @skillancer/auth-svc/app
 * Fastify application factory
 */

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formBody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
  type FastifyError,
} from 'fastify';

import { getConfig } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimitPlugin } from './middleware/rate-limit.js';
import { authSecurityPlugin } from './plugins/security.js';
import { authRoutes } from './routes/auth.js';
import { certificationRoutes } from './routes/certification.js';
import { clientProfileRoutes } from './routes/client-profile.js';
import { educationRoutes } from './routes/education.js';
import { freelancerProfileRoutes } from './routes/freelancer-profile.js';
import { healthRoutes } from './routes/health.js';
import { hipaaRoutes } from './routes/hipaa.js';
import { mfaRoutes } from './routes/mfa.js';
import { oauthRoutes } from './routes/oauth.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { profileCompletionRoutes } from './routes/profile-completion.js';
import { profileRoutes } from './routes/profile.js';
import { createTrustScoreRoutes } from './routes/trust-score.js';
import { verificationRoutes } from './routes/verification.js';
import { webhookRoutes } from './routes/webhooks.js';
import { workHistoryRoutes } from './routes/work-history.js';
import { initializeAuthService } from './services/auth.service.js';
import { initializeAvatarService } from './services/avatar.service.js';
import { initializeCertificationService } from './services/certification.service.js';
import { initializeClientProfileService } from './services/client-profile.service.js';
import { initializeEducationService } from './services/education.service.js';
import { initializeFreelancerProfileService } from './services/freelancer-profile.service.js';
import { initializeMfaService } from './services/mfa.service.js';
import { initializeOAuthService } from './services/oauth.service.js';
import { initializePortfolioService } from './services/portfolio.service.js';
import { initializeProfileCompletionService } from './services/profile-completion.service.js';
import { initializeProfileService } from './services/profile.service.js';
import { initializeSessionService } from './services/session.service.js';
import { initializeSkillsService } from './services/skills.service.js';
import { initializeStepUpService } from './services/step-up-auth.service.js';
import { initializeTrustedDevicesService } from './services/trusted-devices.service.js';
import { initializeWorkHistoryService } from './services/work-history.service.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildAppOptions {
  redis: Redis;
  logger?: FastifyServerOptions['logger'];
  disableRequestLogging?: boolean;
}

// =============================================================================
// APPLICATION FACTORY
// =============================================================================

/**
 * Build the Fastify application with all plugins and routes
 *
 * @param options - Build options including Redis client
 * @returns Configured Fastify instance
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const config = getConfig();
  const { redis } = options;

  // Determine logger configuration
  let loggerConfig: FastifyServerOptions['logger'];

  if (options.logger === false) {
    loggerConfig = false;
  } else if (options.logger === true || options.logger === undefined) {
    if (config.logging.pretty) {
      loggerConfig = {
        level: config.logging.level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      };
    } else {
      loggerConfig = {
        level: config.logging.level,
      };
    }
  } else {
    loggerConfig = options.logger as FastifyServerOptions['logger'];
  }

  // Create Fastify instance
  const app = Fastify({
    logger: loggerConfig || false,
    disableRequestLogging: options.disableRequestLogging ?? false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
  });

  // Register error handler
  app.setErrorHandler((error, request, reply) => {
    return errorHandler(error as FastifyError | Error, request, reply);
  });

  // ==========================================================================
  // PLUGINS
  // ==========================================================================

  // CORS
  await app.register(cors, {
    origin: config.nodeEnv === 'production' ? [config.appUrl] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: config.nodeEnv === 'production',
  });

  // Sensible defaults (error utilities)
  await app.register(sensible);

  // Cookie support (for trusted devices)
  await app.register(cookie, {
    secret: config.jwt.secret, // Use JWT secret for cookie signing
    parseOptions: {}, // default cookie parsing options
  });

  // Form body parser (for OAuth callbacks)
  await app.register(formBody);

  // Multipart file upload (for avatar uploads)
  await app.register(multipart, {
    limits: {
      fileSize: config.profile.maxAvatarSize,
      files: 1,
    },
  });

  // Rate limiting
  await app.register(rateLimitPlugin, { redis });

  // Auth security plugin (SOC 2 compliance)
  await app.register(authSecurityPlugin, { redis });

  // ==========================================================================
  // INITIALIZE SERVICES
  // ==========================================================================

  initializeSessionService(redis);
  initializeAuthService(redis);
  initializeOAuthService(redis);
  initializeMfaService(redis);
  initializeStepUpService(redis);
  initializeTrustedDevicesService(redis);
  initializeProfileService(redis);
  initializeFreelancerProfileService(redis);
  initializeClientProfileService(redis);
  initializeAvatarService();
  initializeSkillsService();
  initializePortfolioService(redis);
  initializeWorkHistoryService(redis);
  initializeEducationService(redis);
  initializeCertificationService(redis);
  initializeProfileCompletionService(redis);

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // Health check routes (root level)
  await app.register(healthRoutes);

  // Auth routes (/auth prefix)
  await app.register(authRoutes, { prefix: '/auth' });

  // OAuth routes (/auth prefix for consistency)
  await app.register(oauthRoutes, { prefix: '/auth' });

  // MFA routes (/mfa prefix)
  await app.register(mfaRoutes, { prefix: '/mfa' });

  // Profile routes (includes /profile, /profiles, /skills)
  await app.register(profileRoutes);

  // Freelancer profile routes (/freelancer prefix)
  await app.register(freelancerProfileRoutes, { prefix: '/freelancer' });

  // Client profile routes (/client prefix)
  await app.register(clientProfileRoutes, { prefix: '/client' });

  // Verification routes (/verification prefix)
  await app.register(verificationRoutes, { prefix: '/verification' });

  // Webhook routes (/webhooks prefix)
  await app.register(webhookRoutes, { prefix: '/webhooks' });

  // Portfolio routes (/portfolio prefix)
  await app.register(portfolioRoutes, { prefix: '/portfolio' });

  // Work history routes (/work-history prefix)
  await app.register(workHistoryRoutes, { prefix: '/work-history' });

  // Education routes (/education prefix)
  await app.register(educationRoutes, { prefix: '/education' });

  // Certification routes (/certifications prefix)
  await app.register(certificationRoutes, { prefix: '/certifications' });

  // Profile completion routes (/profile-completion prefix)
  await app.register(profileCompletionRoutes, { prefix: '/profile-completion' });

  // Trust score routes (/trust-score prefix)
  await app.register(createTrustScoreRoutes(redis), { prefix: '/trust-score' });

  // HIPAA compliance routes (/hipaa prefix)
  await app.register(hipaaRoutes, { prefix: '/hipaa' });

  return app;
}

/**
 * Build a minimal app instance for testing
 */
export async function buildTestApp(
  redis: Redis,
  options: Partial<Omit<BuildAppOptions, 'redis'>> = {}
): Promise<FastifyInstance> {
  return buildApp({
    redis,
    logger: false,
    disableRequestLogging: true,
    ...options,
  });
}
