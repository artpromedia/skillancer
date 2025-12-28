/**
 * @module @skillancer/analytics/events/conversion
 * Conversion and engagement event schemas
 */

import { z } from 'zod';

import { BaseEventSchema } from './base.js';

// ==================== Conversion Events ====================

export const ConversionEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'signup_started',
    'signup_step_completed',
    'signup_completed',
    'email_verified',
    'onboarding_started',
    'onboarding_step_completed',
    'onboarding_completed',
    'onboarding_skipped',
    'subscription_viewed',
    'subscription_started',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'subscription_renewed',
    'trial_started',
    'trial_converted',
    'trial_expired',
    'first_course_enrolled',
    'first_proposal_sent',
    'first_contract_started',
    'first_payment_received',
    'first_job_posted',
  ]),
  properties: z.object({
    // Signup/onboarding
    stepNumber: z.number().optional(),
    stepName: z.string().optional(),
    totalSteps: z.number().optional(),
    signupMethod: z.enum(['email', 'google', 'github', 'linkedin', 'apple']).optional(),
    accountType: z.enum(['freelancer', 'client', 'both']).optional(),

    // Subscription
    subscriptionPlan: z.string().optional(),
    subscriptionValue: z.number().optional(),
    subscriptionInterval: z.enum(['monthly', 'yearly']).optional(),
    previousPlan: z.string().optional(),
    cancellationReason: z.string().optional(),
    trialDays: z.number().optional(),

    // Attribution
    timeToConversion: z.number().optional(), // days from signup
    referralSource: z.string().optional(),
    referralCode: z.string().optional(),
    landingPage: z.string().optional(),
    conversionPath: z.array(z.string()).optional(),

    // Context
    courseId: z.string().optional(),
    proposalId: z.string().optional(),
    contractId: z.string().optional(),
    jobId: z.string().optional(),
    paymentAmount: z.number().optional(),
    currency: z.string().optional(),
  }),
});

// ==================== Engagement Events ====================

export const EngagementEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'feature_used',
    'feature_discovered',
    'feature_tooltip_viewed',
    'help_article_viewed',
    'help_search_performed',
    'notification_received',
    'notification_clicked',
    'notification_dismissed',
    'notification_settings_changed',
    'email_opened',
    'email_clicked',
    'email_unsubscribed',
    'push_notification_received',
    'push_notification_clicked',
    'feedback_submitted',
    'survey_completed',
    'nps_submitted',
    'support_ticket_created',
    'support_chat_started',
    'referral_sent',
    'referral_clicked',
    'referral_accepted',
    'share_clicked',
    'bookmark_added',
    'bookmark_removed',
  ]),
  properties: z.object({
    // Feature
    featureName: z.string().optional(),
    featureCategory: z.string().optional(),
    featureId: z.string().optional(),

    // Notification
    notificationId: z.string().optional(),
    notificationType: z.string().optional(),
    notificationChannel: z.enum(['in_app', 'email', 'push', 'sms']).optional(),

    // Email
    emailId: z.string().optional(),
    emailCampaign: z.string().optional(),
    emailSubject: z.string().optional(),
    linkUrl: z.string().optional(),

    // Feedback
    feedbackType: z.enum(['bug', 'feature', 'general', 'complaint', 'praise']).optional(),
    feedbackRating: z.number().optional(),
    feedbackText: z.string().optional(),
    npsScore: z.number().optional(), // 0-10
    surveyId: z.string().optional(),
    surveyName: z.string().optional(),

    // Support
    ticketId: z.string().optional(),
    ticketCategory: z.string().optional(),
    ticketPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    chatId: z.string().optional(),

    // Referral
    referralCode: z.string().optional(),
    referredUserId: z.string().optional(),
    referralReward: z.number().optional(),
    referralCurrency: z.string().optional(),

    // Share
    shareChannel: z.enum(['twitter', 'facebook', 'linkedin', 'email', 'copy', 'other']).optional(),
    shareUrl: z.string().optional(),
    shareContentType: z.string().optional(),
    shareContentId: z.string().optional(),

    // Help
    articleId: z.string().optional(),
    articleTitle: z.string().optional(),
    searchQuery: z.string().optional(),
    resultsCount: z.number().optional(),
  }),
});

// ==================== Error Events ====================

export const ErrorEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'error_occurred',
    'error_boundary_triggered',
    'api_error',
    'validation_error',
    'payment_error',
    'upload_error',
  ]),
  properties: z.object({
    errorCode: z.string().optional(),
    errorMessage: z.string(),
    errorType: z.string().optional(),
    errorStack: z.string().optional(),
    componentName: z.string().optional(),
    apiEndpoint: z.string().optional(),
    httpStatus: z.number().optional(),
    fieldName: z.string().optional(),
    validationErrors: z.array(z.string()).optional(),
    paymentProvider: z.string().optional(),
    declineReason: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().optional(),
  }),
});

// ==================== Experiment Events ====================

export const ExperimentEventSchema = BaseEventSchema.extend({
  eventType: z.enum(['experiment_viewed', 'experiment_participated', 'experiment_converted']),
  properties: z.object({
    experimentId: z.string(),
    experimentName: z.string(),
    variantId: z.string(),
    variantName: z.string().optional(),
    conversionGoal: z.string().optional(),
    conversionValue: z.number().optional(),
  }),
});

export type ConversionEvent = z.infer<typeof ConversionEventSchema>;
export type EngagementEvent = z.infer<typeof EngagementEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type ExperimentEvent = z.infer<typeof ExperimentEventSchema>;
