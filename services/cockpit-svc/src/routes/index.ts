/**
 * Routes index - registers all cockpit-svc routes
 */

import { calendarRoutes } from './calendar.routes.js';
import { registerClientRoutes } from './clients.routes.js';
import { registerDocumentRoutes } from './documents.routes.js';
import { registerFinanceRoutes } from './finance.routes.js';
import { registerFreelancePlatformRoutes } from './freelance-platform.routes.js';
import { registerIntegrationRoutes } from './integration.routes.js';
import { registerMarketContractRoutes } from './market-contracts.routes.js';
import { registerProductivityToolRoutes } from './productivity-tools.routes.js';
import { registerCommunicationRoutes } from './communication.routes.js';
import { registerInvoiceRoutes } from './invoice.routes.js';
import { registerOpportunityRoutes } from './opportunities.routes.js';
import {
  registerProjectRoutes,
  registerTemplateRoutes,
  registerWorkloadRoutes,
} from './projects.routes.js';
import { publicBookingRoutes } from './public-booking.routes.js';
import { registerReminderRoutes } from './reminders.routes.js';
import { timeTrackingRoutes } from './time-tracking.routes.js';
import { CalendarService } from '../services/calendar.service.js';
import { EncryptionService } from '../services/encryption.service.js';
import { SlackIntegrationService } from '../services/integrations/slack-integration.service.js';
import { DiscordIntegrationService } from '../services/integrations/discord-integration.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export interface RouteDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export async function registerRoutes(
  fastify: FastifyInstance,
  deps: RouteDependencies
): Promise<void> {
  // ============================================================================
  // CRM Routes
  // ============================================================================

  // Register client routes
  await fastify.register(
    (instance) => {
      registerClientRoutes(instance, deps);
    },
    { prefix: '/clients' }
  );

  // Register opportunity routes
  await fastify.register(
    (instance) => {
      registerOpportunityRoutes(instance, deps);
    },
    { prefix: '/opportunities' }
  );

  // Register reminder routes
  await fastify.register(
    (instance) => {
      registerReminderRoutes(instance, deps);
    },
    { prefix: '/reminders' }
  );

  // Register document routes
  await fastify.register(
    (instance) => {
      registerDocumentRoutes(instance, deps);
    },
    { prefix: '/documents' }
  );

  // ============================================================================
  // Project Management Routes
  // ============================================================================

  // Register project routes
  await fastify.register(
    (instance) => {
      registerProjectRoutes(instance, deps);
    },
    { prefix: '/projects' }
  );

  // Register template routes
  await fastify.register(
    (instance) => {
      registerTemplateRoutes(instance, deps);
    },
    { prefix: '/templates' }
  );

  // Register workload routes
  await fastify.register(
    (instance) => {
      registerWorkloadRoutes(instance, deps);
    },
    { prefix: '/workload' }
  );

  // ============================================================================
  // Time Tracking Routes
  // ============================================================================

  // Register time tracking routes
  await fastify.register(timeTrackingRoutes);

  // ============================================================================
  // Calendar Integration Routes
  // ============================================================================

  // Create calendar service
  const calendarService = new CalendarService(deps.prisma, {
    google: process.env.GOOGLE_CLIENT_ID
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
        }
      : undefined,
    microsoft: process.env.MICROSOFT_CLIENT_ID
      ? {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
          tenantId: process.env.MICROSOFT_TENANT_ID ?? '',
          redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? '',
        }
      : undefined,
    baseUrl: process.env.BASE_URL ?? 'http://localhost:3001',
  });

  // Register authenticated calendar routes
  await fastify.register(calendarRoutes, {
    prefix: '/calendar',
    calendarService,
  });

  // Register public booking routes (no auth required)
  await fastify.register(publicBookingRoutes, {
    prefix: '/public/book',
    calendarService,
  });

  // ============================================================================
  // Financial Tracking Routes (CP-3.1: Income & Expense Tracking)
  // ============================================================================

  // Register finance routes
  await fastify.register(
    (instance) => {
      registerFinanceRoutes(instance, {
        ...deps,
        plaidConfig: process.env.PLAID_CLIENT_ID
          ? {
              clientId: process.env.PLAID_CLIENT_ID,
              secret: process.env.PLAID_SECRET ?? '',
              env: (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') ?? 'sandbox',
              webhookUrl: process.env.PLAID_WEBHOOK_URL,
            }
          : undefined,
      });
    },
    { prefix: '/finance' }
  );

  // ============================================================================
  // Invoice Routes (CP-3.2: Professional Invoicing)
  // ============================================================================

  // Register invoice routes
  await fastify.register(
    (instance) => {
      registerInvoiceRoutes(instance, deps);
    },
    { prefix: '/invoicing' }
  );

  // ============================================================================
  // Integration Routes (CP-4.1: Integration Platform)
  // ============================================================================

  // Create encryption service for integrations
  // NOTE: In production, INTEGRATION_ENCRYPTION_KEY should be loaded from environment
  const encryptionKey =
    process.env.INTEGRATION_ENCRYPTION_KEY ?? 'development-key-at-least-32-characters';
  const encryption = new EncryptionService({ masterKey: encryptionKey }, deps.logger);

  // Register integration routes
  await fastify.register(
    (instance) => {
      registerIntegrationRoutes(instance, { ...deps, encryption });
    },
    { prefix: '/platform' }
  );

  // ============================================================================
  // Freelance Platform Routes (CP-4.2: Freelance Platform Integrations)
  // ============================================================================

  // Register freelance platform routes
  await fastify.register(
    (instance) => {
      registerFreelancePlatformRoutes(instance, { ...deps, encryption });
    },
    { prefix: '/api' }
  );

  // ============================================================================
  // Productivity Tools Routes (CP-4.3: Productivity Tool Integrations)
  // ============================================================================

  // Register productivity tool routes
  await fastify.register(
    (instance) => {
      registerProductivityToolRoutes(instance, { ...deps, encryption });
    },
    { prefix: '/api' }
  );

  // ============================================================================
  // Communication Platform Routes (CP-4.3: Slack & Discord Integrations)
  // ============================================================================

  // Create Slack and Discord integration services
  const slackService = new SlackIntegrationService(deps.prisma, deps.logger, encryption);
  const discordService = new DiscordIntegrationService(deps.prisma, deps.logger, encryption);

  // Register communication platform routes (Slack, Discord)
  await fastify.register(
    (instance) => {
      registerCommunicationRoutes(instance, {
        prisma: deps.prisma,
        logger: deps.logger,
        slackService,
        discordService,
      });
    },
    { prefix: '/api' }
  );

  // ============================================================================
  // Market Integration Routes (Market Contract to Cockpit Project)
  // ============================================================================

  // Register Market contract integration routes
  await fastify.register(
    async (instance) => {
      await registerMarketContractRoutes(instance, deps.prisma, deps.redis, deps.logger);
    },
    { prefix: '/market' }
  );
}

// CRM exports
export { registerClientRoutes } from './clients.routes.js';
export { registerDocumentRoutes } from './documents.routes.js';
export { registerOpportunityRoutes } from './opportunities.routes.js';
export { registerReminderRoutes } from './reminders.routes.js';

// Project Management exports
export {
  registerProjectRoutes,
  registerTemplateRoutes,
  registerWorkloadRoutes,
} from './projects.routes.js';

// Time Tracking exports
export { timeTrackingRoutes } from './time-tracking.routes.js';

// Calendar Integration exports
export { calendarRoutes } from './calendar.routes.js';
export { publicBookingRoutes } from './public-booking.routes.js';

// Financial exports (CP-3.1: Income & Expense Tracking)
export { registerFinanceRoutes } from './finance.routes.js';
// Invoice exports (CP-3.2: Professional Invoicing)
export { registerInvoiceRoutes } from './invoice.routes.js';
// Integration exports (CP-4.1: Integration Platform)
export { registerIntegrationRoutes } from './integration.routes.js';
// Freelance Platform exports (CP-4.2: Freelance Platform Integrations)
export { registerFreelancePlatformRoutes } from './freelance-platform.routes.js';
// Productivity Tools exports (CP-4.3: Productivity Tool Integrations)
export { registerProductivityToolRoutes } from './productivity-tools.routes.js';
// Communication Platform exports (CP-4.3: Slack & Discord Integrations)
export { registerCommunicationRoutes } from './communication.routes.js';
// Market Integration exports (Market Contract to Cockpit Project)
export { registerMarketContractRoutes } from './market-contracts.routes.js';

// Pricing Recommendations exports (CP-X: Skill-Based Pricing)
export { default as pricingRoutes } from './pricing.routes.js';
// Unified Financial exports (Unified Financial Reporting)
export { default as unifiedFinancialRoutes } from './unified-financial.routes.js';
// Learning Time exports (Learning Time Tracking)
export { default as learningTimeRoutes } from './learning-time.routes.js';
