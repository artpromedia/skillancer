/**
 * @module @skillancer/analytics/events/market
 * Market (freelance marketplace) event schemas
 */

import { z } from 'zod';
import { BaseEventSchema } from './base.js';

// ==================== Job Events ====================

export const JobEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'job_viewed',
    'job_saved',
    'job_unsaved',
    'job_shared',
    'job_reported',
    'job_posted',
    'job_edited',
    'job_closed',
    'job_reposted',
  ]),
  properties: z.object({
    jobId: z.string(),
    jobTitle: z.string(),
    jobCategory: z.string(),
    jobSubcategory: z.string().optional(),
    clientId: z.string(),
    clientName: z.string().optional(),
    budgetType: z.enum(['fixed', 'hourly']),
    budgetMin: z.number().optional(),
    budgetMax: z.number().optional(),
    currency: z.string(),
    experienceLevel: z.enum(['entry', 'intermediate', 'expert']).optional(),
    requiredSkills: z.array(z.string()),
    postedAt: z.coerce.date(),
    deadline: z.coerce.date().optional(),
    proposalCount: z.number().optional(),
    viewSource: z.enum(['search', 'recommendation', 'category', 'direct', 'email', 'invite']),
    searchQuery: z.string().optional(),
    searchFilters: z.record(z.any()).optional(),
    matchScore: z.number().optional(),
    isRemote: z.boolean().optional(),
    location: z.string().optional(),
    projectLength: z.enum(['short', 'medium', 'long', 'ongoing']).optional(),
  }),
});

// ==================== Proposal Events ====================

export const ProposalEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'proposal_started',
    'proposal_submitted',
    'proposal_withdrawn',
    'proposal_viewed_by_client',
    'proposal_shortlisted',
    'proposal_rejected',
    'proposal_accepted',
    'proposal_message_sent',
    'interview_scheduled',
    'interview_completed',
  ]),
  properties: z.object({
    proposalId: z.string(),
    jobId: z.string(),
    jobTitle: z.string(),
    clientId: z.string(),
    freelancerId: z.string().optional(),
    proposedRate: z.number().optional(),
    proposedAmount: z.number().optional(),
    currency: z.string(),
    coverLetterLength: z.number().optional(),
    attachmentsCount: z.number().optional(),
    timeToSubmit: z.number().optional(), // seconds from job view to submit
    competitorCount: z.number().optional(),
    userRank: z.number().optional(),
    rejectionReason: z.string().optional(),
    interviewDate: z.coerce.date().optional(),
    messageId: z.string().optional(),
  }),
});

// ==================== Contract Events ====================

export const ContractEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'contract_created',
    'contract_started',
    'contract_milestone_created',
    'contract_milestone_submitted',
    'contract_milestone_approved',
    'contract_milestone_rejected',
    'contract_payment_received',
    'contract_completed',
    'contract_cancelled',
    'contract_disputed',
    'contract_extended',
    'contract_feedback_left',
  ]),
  properties: z.object({
    contractId: z.string(),
    jobId: z.string().optional(),
    clientId: z.string(),
    freelancerId: z.string(),
    contractType: z.enum(['fixed', 'hourly', 'retainer', 'milestone']),
    contractValue: z.number(),
    currency: z.string(),
    milestoneId: z.string().optional(),
    milestoneName: z.string().optional(),
    milestoneValue: z.number().optional(),
    paymentAmount: z.number().optional(),
    platformFee: z.number().optional(),
    duration: z.number().optional(), // days
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    completionRating: z.number().optional(), // 1-5
    feedbackText: z.string().optional(),
    disputeReason: z.string().optional(),
    extensionDays: z.number().optional(),
  }),
});

// ==================== Search Events ====================

export const SearchEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'search_performed',
    'search_result_clicked',
    'search_filters_applied',
    'search_filters_cleared',
    'search_no_results',
    'search_suggestion_clicked',
    'search_saved',
  ]),
  properties: z.object({
    searchType: z.enum(['jobs', 'freelancers', 'courses', 'global', 'skills']),
    query: z.string(),
    queryTokens: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    resultsCount: z.number(),
    resultPosition: z.number().optional(),
    resultId: z.string().optional(),
    resultType: z.string().optional(),
    page: z.number().optional(),
    responseTime: z.number().optional(), // ms
    suggestionIndex: z.number().optional(),
    savedSearchId: z.string().optional(),
  }),
});

// ==================== Profile Events ====================

export const ProfileEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'profile_viewed',
    'profile_updated',
    'portfolio_item_added',
    'portfolio_item_removed',
    'availability_updated',
    'rate_updated',
    'profile_visibility_changed',
  ]),
  properties: z.object({
    profileId: z.string(),
    profileType: z.enum(['freelancer', 'client', 'agency']),
    viewerId: z.string().optional(),
    viewSource: z.enum(['search', 'job', 'direct', 'recommendation']).optional(),
    section: z.string().optional(),
    portfolioItemId: z.string().optional(),
    portfolioItemType: z.string().optional(),
    hourlyRate: z.number().optional(),
    availability: z.enum(['available', 'limited', 'unavailable']).optional(),
    visibility: z.enum(['public', 'private', 'members_only']).optional(),
  }),
});

// ==================== Message Events ====================

export const MessageEventSchema = BaseEventSchema.extend({
  eventType: z.enum([
    'message_sent',
    'message_read',
    'conversation_started',
    'attachment_sent',
    'message_reacted',
  ]),
  properties: z.object({
    messageId: z.string(),
    conversationId: z.string(),
    recipientId: z.string(),
    messageType: z.enum(['text', 'attachment', 'system']),
    hasAttachment: z.boolean().optional(),
    attachmentType: z.string().optional(),
    contextType: z.enum(['job', 'proposal', 'contract', 'general']).optional(),
    contextId: z.string().optional(),
    reactionType: z.string().optional(),
  }),
});

export type JobEvent = z.infer<typeof JobEventSchema>;
export type ProposalEvent = z.infer<typeof ProposalEventSchema>;
export type ContractEvent = z.infer<typeof ContractEventSchema>;
export type SearchEvent = z.infer<typeof SearchEventSchema>;
export type ProfileEvent = z.infer<typeof ProfileEventSchema>;
export type MessageEvent = z.infer<typeof MessageEventSchema>;
