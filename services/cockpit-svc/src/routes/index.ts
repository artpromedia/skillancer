/**
 * Routes index - registers all cockpit-svc routes
 */

import { calendarRoutes } from './calendar.routes.js';
import { registerClientRoutes } from './clients.routes.js';
import { registerDocumentRoutes } from './documents.routes.js';
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
