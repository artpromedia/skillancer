/**
 * @module @skillancer/market-svc/types/bidding
 * Project Bidding System types and interfaces
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type BidStatus =
  | 'PENDING'
  | 'SHORTLISTED'
  | 'INTERVIEW_REQUESTED'
  | 'INTERVIEW_SCHEDULED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type BidType = 'STANDARD' | 'INVITED' | 'FEATURED';

export type BidMessageType =
  | 'MESSAGE'
  | 'INTERVIEW_REQUEST'
  | 'INTERVIEW_SCHEDULED'
  | 'CLARIFICATION'
  | 'COUNTER_OFFER'
  | 'SYSTEM';

export type InvitationStatus =
  | 'PENDING'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

export type JobStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type JobVisibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';

export type BudgetType = 'FIXED' | 'HOURLY' | 'MONTHLY';

export type JobDuration =
  | 'LESS_THAN_WEEK'
  | 'ONE_TO_TWO_WEEKS'
  | 'TWO_TO_FOUR_WEEKS'
  | 'ONE_TO_THREE_MONTHS'
  | 'THREE_TO_SIX_MONTHS'
  | 'MORE_THAN_SIX_MONTHS';

export type ExperienceLevel = 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';

// =============================================================================
// PROJECT/JOB TYPES
// =============================================================================

export interface CreateProjectInput {
  title: string;
  description: string;
  budgetType: BudgetType;
  budgetMin?: number | undefined;
  budgetMax?: number | undefined;
  currency?: string | undefined;
  duration?: JobDuration | undefined;
  experienceLevel?: ExperienceLevel | undefined;
  location?: string | undefined;
  isRemote?: boolean | undefined;
  visibility?: JobVisibility | undefined;
  skills?: string[] | undefined;
  attachments?: Attachment[] | undefined;
  tags?: string[] | undefined;
}

export interface UpdateProjectInput {
  title?: string | undefined;
  description?: string | undefined;
  budgetType?: BudgetType | undefined;
  budgetMin?: number | undefined;
  budgetMax?: number | undefined;
  currency?: string | undefined;
  duration?: JobDuration | undefined;
  experienceLevel?: ExperienceLevel | undefined;
  location?: string | undefined;
  isRemote?: boolean | undefined;
  visibility?: JobVisibility | undefined;
  skills?: string[] | undefined;
  attachments?: Attachment[] | undefined;
  tags?: string[] | undefined;
}

export interface ProjectSearchParams {
  query?: string | undefined;
  skills?: string[] | undefined;
  budgetMin?: number | undefined;
  budgetMax?: number | undefined;
  budgetType?: BudgetType | undefined;
  experienceLevel?: ExperienceLevel | undefined;
  duration?: JobDuration | undefined;
  isRemote?: boolean | undefined;
  location?: string | undefined;
  visibility?: JobVisibility | undefined;
  status?: JobStatus | undefined;
  clientId?: string | undefined;
  sortBy?: 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ProjectSearchResult {
  id: string;
  title: string;
  slug: string;
  description: string;
  budgetType: BudgetType;
  budgetMin?: number | undefined;
  budgetMax?: number | undefined;
  currency: string;
  duration?: JobDuration | undefined;
  experienceLevel: ExperienceLevel;
  isRemote: boolean;
  location?: string | undefined;
  skills: SkillInfo[];
  tags: string[];
  bidCount: number;
  publishedAt?: Date | undefined;
  client: {
    id: string;
    displayName: string;
    avatarUrl?: string | undefined;
    rating?: number | undefined;
    reviewCount?: number | undefined;
    location?: string | undefined;
  };
  score?: number | undefined; // Elasticsearch relevance score
}

// =============================================================================
// BID TYPES
// =============================================================================

export interface SubmitBidInput {
  jobId: string;
  coverLetter: string;
  proposedRate: number;
  rateType?: BudgetType | undefined;
  deliveryDays?: number | undefined;
  attachments?: Attachment[] | undefined;
  proposedMilestones?: ProposedMilestone[] | undefined;
}

export interface UpdateBidInput {
  coverLetter?: string | undefined;
  proposedRate?: number | undefined;
  rateType?: BudgetType | undefined;
  deliveryDays?: number | undefined;
  attachments?: Attachment[] | undefined;
  proposedMilestones?: ProposedMilestone[] | undefined;
}

export interface ProposedMilestone {
  title: string;
  description?: string | undefined;
  amount: number;
  deliveryDays: number;
}

export interface BidQualityFactors {
  // Core quality factors (all optional for partial assignment)
  relevance?: number; // 0-100: How relevant is the bid to the project
  completeness?: number; // 0-100: How complete is the proposal
  uniqueness?: number; // 0-100: How unique vs template responses
  profileStrength?: number; // 0-100: Freelancer profile completeness
  responseTime?: number; // 0-100: How quickly they responded
  priceAlignment?: number; // 0-100: How aligned with budget
  // Cover letter analysis
  coverLetterLength?: number;
  coverLetterLengthScore?: number;
  templateIndicators?: number;
  personalizationScore?: number;
  avgWordLength?: number;
  readabilityScore?: number;
  // Rate analysis
  proposedRate?: number;
  budgetMin?: number;
  budgetMax?: number;
  rateWithinBudget?: boolean;
  // Profile metrics
  profileCompleteness?: number;
  totalContracts?: number;
  averageRating?: number | undefined;
  successRateScore?: number;
  responsivenessScore?: number;
  trustScore?: number;
  trustTier?: string | undefined;
  // Freelancer metrics
  freelancerSuccessRate?: number;
  freelancerResponseTime?: number;
  freelancerTrustScore?: number;
}

/**
 * Input for quality scoring calculation
 */
export interface BidQualityInput {
  coverLetter: string;
  proposedRate: number;
  deliveryDays?: number | undefined;
  freelancerId: string;
  jobId?: string | undefined;
  budgetMin?: number | undefined;
  budgetMax?: number | undefined;
  projectBudgetMin?: number | undefined;
  projectBudgetMax?: number | undefined;
  projectSkills?: string[] | undefined;
  projectDescription?: string | undefined;
}

/**
 * Result of quality scoring
 */
export interface BidQualityResult {
  score: number;
  factors: BidQualityFactors;
  isSpam: boolean;
  spamReason?: string | undefined;
}

export interface BidWithDetails {
  id: string;
  jobId: string;
  freelancerId: string;
  status: BidStatus;
  bidType: BidType;
  coverLetter: string;
  proposedRate: number;
  rateType: BudgetType;
  deliveryDays?: number | undefined;
  attachments: Attachment[];
  proposedMilestones?: ProposedMilestone[] | undefined;
  qualityScore?: number | undefined;
  qualityFactors?: BidQualityFactors | undefined;
  isSpam: boolean;
  isBoosted: boolean;
  viewedByClientAt?: Date | undefined;
  shortlistedAt?: Date | undefined;
  submittedAt: Date;
  freelancer: FreelancerInfo;
  messageCount?: number | undefined;
}

export interface FreelancerInfo {
  id: string;
  displayName: string;
  title?: string | undefined;
  avatarUrl?: string | undefined;
  hourlyRate?: number | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
  completedJobs?: number | undefined;
  skills: SkillInfo[];
  country?: string | undefined;
  trustScore?: number | undefined;
  trustTier?: string | undefined;
}

export interface SkillInfo {
  id: string;
  name: string;
  slug: string;
  category?: string | undefined;
}

export interface Attachment {
  name: string;
  url: string;
  size?: number | undefined;
  mimeType?: string | undefined;
}

// =============================================================================
// BID ACTIONS
// =============================================================================

export interface ShortlistBidInput {
  bidId: string;
  notes?: string | undefined;
}

export interface RejectBidInput {
  bidId: string;
  reason?: string | undefined;
  notifyFreelancer?: boolean | undefined;
}

export interface RequestInterviewInput {
  bidId: string;
  message?: string | undefined;
  preferredTimes?: Date[] | undefined;
}

export interface ScheduleInterviewInput {
  bidId: string;
  scheduledAt: Date;
  notes?: string | undefined;
  meetingUrl?: string | undefined;
}

export interface AcceptBidInput {
  bidId: string;
  message?: string | undefined;
  startDate?: Date | undefined;
  customTerms?: Record<string, unknown> | undefined;
}

// =============================================================================
// BID MESSAGE TYPES
// =============================================================================

export interface SendBidMessageInput {
  bidId: string;
  content: string;
  attachments?: Attachment[];
  messageType?: BidMessageType;
}

export interface BidMessageWithSender {
  id: string;
  bidId: string;
  senderId: string;
  content: string;
  attachments: Attachment[];
  messageType: BidMessageType;
  readAt?: Date;
  createdAt: Date;
  sender: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    role: 'client' | 'freelancer';
  };
}

// =============================================================================
// INVITATION TYPES
// =============================================================================

export interface SendInvitationInput {
  jobId: string;
  freelancerId: string;
  message?: string | undefined;
  expiresInDays?: number | undefined;
}

export interface RespondToInvitationInput {
  invitationId: string;
  accept: boolean;
  message?: string;
  bidDetails?: SubmitBidInput;
}

export interface InvitationWithDetails {
  id: string;
  jobId: string;
  inviterId: string;
  inviteeId: string;
  message?: string | undefined;
  status: InvitationStatus;
  responseMessage?: string | undefined;
  respondedAt?: Date | undefined;
  sentAt: Date;
  expiresAt: Date;
  viewedAt?: Date | undefined;
  createdAt: Date;
  job: {
    id: string;
    title: string;
    budgetMin?: number | undefined;
    budgetMax?: number | undefined;
    currency: string;
  };
  inviter: {
    id: string;
    displayName: string;
    avatarUrl?: string | undefined;
  };
  invitee: {
    id: string;
    displayName: string;
    title?: string | undefined;
    avatarUrl?: string | undefined;
    hourlyRate?: number | undefined;
  };
  project: {
    id: string;
    title: string;
    slug: string;
  };
}

// =============================================================================
// QUESTION TYPES
// =============================================================================

export interface AskQuestionInput {
  jobId: string;
  question: string;
  isPublic?: boolean | undefined;
}

export interface AnswerQuestionInput {
  questionId: string;
  answer: string;
}

export interface QuestionWithDetails {
  id: string;
  jobId: string;
  askerId: string;
  question: string;
  isPublic: boolean;
  isPinned: boolean;
  answer?: string | undefined;
  answeredAt?: Date | undefined;
  answeredBy?: string | undefined;
  createdAt: Date;
  asker: {
    id: string;
    displayName: string;
    avatarUrl?: string | undefined;
  };
  project?:
    | {
        id: string;
        title: string;
        slug: string;
      }
    | undefined;
}

// =============================================================================
// COMPARISON & ANALYTICS
// =============================================================================

export interface BidComparisonData {
  bids: BidWithDetails[];
  averageRate: number;
  medianRate: number;
  rateRange: { min: number; max: number };
  averageDeliveryDays: number;
  topSkillMatches: SkillInfo[];
  qualityDistribution: {
    excellent: number; // 80-100
    good: number; // 60-79
    fair: number; // 40-59
    poor: number; // 0-39
  };
}

export interface ProjectAnalytics {
  projectId: string;
  viewCount: number;
  bidCount: number;
  invitationsSent: number;
  invitationsAccepted: number;
  questionsAsked: number;
  averageBidAmount: number;
  averageQualityScore: number;
  topBidderCountries: Array<{ country: string; count: number }>;
}

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface BidListOptions {
  status?: BidStatus | BidStatus[] | undefined;
  sortBy?: 'newest' | 'quality_score' | 'rate_low' | 'rate_high' | 'delivery_days' | undefined;
  includeSpam?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface InvitationListOptions {
  status?: InvitationStatus | InvitationStatus[] | undefined;
  page?: number;
  limit?: number;
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export interface BidNotificationPayload {
  type:
    | 'BID_RECEIVED'
    | 'BID_VIEWED'
    | 'BID_SHORTLISTED'
    | 'BID_REJECTED'
    | 'BID_ACCEPTED'
    | 'INTERVIEW_REQUESTED'
    | 'INTERVIEW_SCHEDULED'
    | 'NEW_BID_MESSAGE'
    | 'INVITATION_RECEIVED'
    | 'INVITATION_ACCEPTED'
    | 'QUESTION_ANSWERED';
  recipientId: string;
  data: Record<string, unknown>;
}
