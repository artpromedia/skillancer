/**
 * @module @skillancer/analytics/events
 * Comprehensive event schema definitions for analytics tracking
 */

import { z } from 'zod';

// ==================== Base Event Schema ====================

/**
 * Context schema for device and environment information
 */
export const EventContextSchema = z.object({
  // Application
  app: z
    .object({
      name: z.string(),
      version: z.string(),
      build: z.string().optional(),
    })
    .optional(),

  // Device
  device: z
    .object({
      id: z.string().optional(),
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      type: z.enum(['desktop', 'mobile', 'tablet', 'other']),
    })
    .optional(),

  // Browser/OS
  os: z
    .object({
      name: z.string(),
      version: z.string(),
    })
    .optional(),

  browser: z
    .object({
      name: z.string(),
      version: z.string(),
    })
    .optional(),

  // Location
  locale: z.string().optional(),
  timezone: z.string().optional(),

  // Page/Screen
  page: z
    .object({
      path: z.string(),
      url: z.string(),
      title: z.string().optional(),
      referrer: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),

  screen: z
    .object({
      width: z.number(),
      height: z.number(),
      density: z.number().optional(),
    })
    .optional(),

  // Network
  ip: z.string().optional(),
  userAgent: z.string().optional(),

  // Campaign
  campaign: z
    .object({
      name: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),

  // Feature flags and experiments
  activeExperiments: z
    .array(
      z.object({
        experimentId: z.string(),
        variantId: z.string(),
      })
    )
    .optional(),
});

/**
 * Consent configuration for privacy compliance
 */
export const ConsentSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  personalization: z.boolean(),
});

/**
 * Base event schema - all events extend from this
 */
export const BaseEventSchema = z.object({
  // Event identification
  eventId: z.string().uuid(),
  eventType: z.string(),
  eventVersion: z.string().default('1.0'),

  // Timestamps
  timestamp: z.coerce.date(),
  receivedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),

  // User identification
  userId: z.string().uuid().optional(), // Authenticated user
  anonymousId: z.string(), // Device/session identifier

  // Session context
  sessionId: z.string().optional(),

  // Source context
  context: EventContextSchema,

  // Custom properties
  properties: z.record(z.any()).optional(),

  // Privacy
  consent: ConsentSchema.optional(),
});

export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type EventContext = z.infer<typeof EventContextSchema>;
export type ConsentConfig = z.infer<typeof ConsentSchema>;

// ==================== Core Event Types ====================

/**
 * Page/Screen view events
 */
export const PageViewEventSchema = BaseEventSchema.extend({
  eventType: z.literal('page_view'),
  properties: z.object({
    pageName: z.string(),
    pageCategory: z.string().optional(),
    pageSubcategory: z.string().optional(),
    previousPage: z.string().optional(),
    timeOnPreviousPage: z.number().optional(),
  }),
});

/**
 * User identification events
 */
export const IdentifyEventSchema = BaseEventSchema.extend({
  eventType: z.literal('identify'),
  properties: z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    createdAt: z.coerce.date().optional(),
    plan: z.string().optional(),
    accountType: z.enum(['freelancer', 'client', 'both']).optional(),
    company: z.string().optional(),
    industry: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    referralSource: z.string().optional(),
  }),
});

/**
 * Generic track events
 */
export const TrackEventSchema = BaseEventSchema.extend({
  eventType: z.literal('track'),
  eventName: z.string(),
  properties: z.record(z.any()),
});

export type PageViewEvent = z.infer<typeof PageViewEventSchema>;
export type IdentifyEvent = z.infer<typeof IdentifyEventSchema>;
export type TrackEvent = z.infer<typeof TrackEventSchema>;
