/**
 * @module @skillancer/analytics/events
 * Event schema exports and union types
 */

// Base schemas
export * from './base.js';

// Product-specific schemas
export * from './skillpod.js';
export * from './market.js';
export * from './cockpit.js';
export * from './conversion.js';

import { z } from 'zod';

import { PageViewEventSchema, IdentifyEventSchema, TrackEventSchema } from './base.js';
import {
  TimeTrackingEventSchema,
  InvoiceEventSchema,
  ExpenseEventSchema,
  ProjectEventSchema,
  ReportEventSchema,
  FinancialEventSchema,
} from './cockpit.js';
import {
  ConversionEventSchema,
  EngagementEventSchema,
  ErrorEventSchema,
  ExperimentEventSchema,
} from './conversion.js';
import {
  JobEventSchema,
  ProposalEventSchema,
  ContractEventSchema,
  SearchEventSchema,
  ProfileEventSchema,
  MessageEventSchema,
} from './market.js';
import {
  CourseEventSchema,
  LessonEventSchema,
  VideoEventSchema,
  AssessmentEventSchema,
  LearningPathEventSchema,
  SkillEventSchema,
} from './skillpod.js';

/**
 * All event types for discriminated union
 */
export const AllEventTypes = [
  // Core
  'page_view',
  'identify',
  'track',
  // SkillPod
  'course_viewed',
  'course_enrolled',
  'course_started',
  'course_completed',
  'course_dropped',
  'course_rated',
  'course_shared',
  'course_wishlisted',
  'lesson_started',
  'lesson_completed',
  'lesson_paused',
  'lesson_resumed',
  'lesson_skipped',
  'lesson_bookmarked',
  'lesson_note_added',
  'video_play',
  'video_pause',
  'video_seek',
  'video_complete',
  'video_buffer',
  'video_quality_change',
  'video_speed_change',
  'assessment_started',
  'assessment_submitted',
  'assessment_passed',
  'assessment_failed',
  // Market
  'job_viewed',
  'job_saved',
  'job_posted',
  'proposal_started',
  'proposal_submitted',
  'proposal_accepted',
  'contract_created',
  'contract_started',
  'contract_completed',
  'search_performed',
  // Cockpit
  'timer_started',
  'timer_stopped',
  'time_entry_created',
  'invoice_created',
  'invoice_sent',
  'invoice_paid',
  // Conversion
  'signup_started',
  'signup_completed',
  'subscription_started',
  // Engagement
  'feature_used',
  'notification_clicked',
  'email_clicked',
] as const;

export type EventType = (typeof AllEventTypes)[number];

/**
 * Schema collection for validation
 */
export const EventSchemas = {
  // Core
  page_view: PageViewEventSchema,
  identify: IdentifyEventSchema,
  track: TrackEventSchema,
  // SkillPod
  course: CourseEventSchema,
  lesson: LessonEventSchema,
  video: VideoEventSchema,
  assessment: AssessmentEventSchema,
  learning_path: LearningPathEventSchema,
  skill: SkillEventSchema,
  // Market
  job: JobEventSchema,
  proposal: ProposalEventSchema,
  contract: ContractEventSchema,
  search: SearchEventSchema,
  profile: ProfileEventSchema,
  message: MessageEventSchema,
  // Cockpit
  time_tracking: TimeTrackingEventSchema,
  invoice: InvoiceEventSchema,
  expense: ExpenseEventSchema,
  project: ProjectEventSchema,
  report: ReportEventSchema,
  financial: FinancialEventSchema,
  // Conversion
  conversion: ConversionEventSchema,
  engagement: EngagementEventSchema,
  error: ErrorEventSchema,
  experiment: ExperimentEventSchema,
} as const;

/**
 * Union schema for all analytics events
 */
export const AnalyticsEventSchema = z.union([
  PageViewEventSchema,
  IdentifyEventSchema,
  TrackEventSchema,
  CourseEventSchema,
  LessonEventSchema,
  VideoEventSchema,
  AssessmentEventSchema,
  LearningPathEventSchema,
  SkillEventSchema,
  JobEventSchema,
  ProposalEventSchema,
  ContractEventSchema,
  SearchEventSchema,
  ProfileEventSchema,
  MessageEventSchema,
  TimeTrackingEventSchema,
  InvoiceEventSchema,
  ExpenseEventSchema,
  ProjectEventSchema,
  ReportEventSchema,
  FinancialEventSchema,
  ConversionEventSchema,
  EngagementEventSchema,
  ErrorEventSchema,
  ExperimentEventSchema,
]);

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

/**
 * Validate an event against its schema
 */
export function validateEvent(event: unknown): {
  success: boolean;
  data?: AnalyticsEvent;
  error?: z.ZodError;
} {
  const result = AnalyticsEventSchema.safeParse(event);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Get event category from event type
 */
export function getEventCategory(eventType: string): string {
  if (
    eventType.startsWith('course_') ||
    eventType.startsWith('lesson_') ||
    eventType.startsWith('video_') ||
    eventType.startsWith('assessment_')
  ) {
    return 'learning';
  }
  if (
    eventType.startsWith('job_') ||
    eventType.startsWith('proposal_') ||
    eventType.startsWith('contract_') ||
    eventType.startsWith('search_')
  ) {
    return 'marketplace';
  }
  if (
    eventType.startsWith('timer_') ||
    eventType.startsWith('time_') ||
    eventType.startsWith('invoice_') ||
    eventType.startsWith('expense_')
  ) {
    return 'cockpit';
  }
  if (
    eventType.startsWith('signup_') ||
    eventType.startsWith('subscription_') ||
    eventType.startsWith('onboarding_')
  ) {
    return 'conversion';
  }
  if (
    eventType.startsWith('feature_') ||
    eventType.startsWith('notification_') ||
    eventType.startsWith('email_')
  ) {
    return 'engagement';
  }
  if (eventType === 'page_view') return 'navigation';
  if (eventType === 'identify') return 'identity';
  return 'custom';
}
