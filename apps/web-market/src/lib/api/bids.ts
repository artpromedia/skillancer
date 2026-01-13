/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/**
 * Bids & Proposals API Client
 *
 * Handles all proposal-related operations including submission, management,
 * client review, and hiring flows.
 */

// ============================================================================
// Types
// ============================================================================

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'INTERVIEWING'
  | 'HIRED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'ARCHIVED';

export type ContractType = 'FIXED' | 'HOURLY';

export interface ProposalMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  durationDays: number;
  order?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface ProposalAttachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt?: string;
}

export interface ProposalSubmission {
  jobId: string;
  coverLetter: string;
  contractType: ContractType;
  bidAmount: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays: number;
  milestones?: Omit<ProposalMilestone, 'id'>[];
  attachments?: string[]; // attachment IDs
  portfolioItems?: string[]; // portfolio item IDs
  templateId?: string;
}

export interface ProposalUpdate {
  coverLetter?: string;
  bidAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays?: number;
  milestones?: Omit<ProposalMilestone, 'id'>[];
  attachments?: string[];
  portfolioItems?: string[];
}

export interface ProposalDraft {
  id: string;
  jobId: string;
  coverLetter?: string;
  contractType?: ContractType;
  bidAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays?: number;
  milestones?: Omit<ProposalMilestone, 'id'>[];
  attachmentIds?: string[];
  portfolioItemIds?: string[];
  currentStep: number;
  lastSavedAt: string;
}

export interface Proposal {
  id: string;
  jobId: string;
  job: {
    id: string;
    slug: string;
    title: string;
    budget: {
      type: ContractType;
      minAmount?: number;
      maxAmount?: number;
      amount?: number;
    };
    deadline?: string;
    skills: string[];
    client: {
      id: string;
      displayName: string;
      name?: string;
      avatarUrl?: string;
      companyName?: string;
      verificationLevel: string;
    };
  };
  freelancer: {
    id: string;
    username: string;
    displayName: string;
    name?: string;
    avatarUrl?: string;
    title: string;
    bio?: string;
    location?: string;
    rating: number;
    reviewCount: number;
    jobsCompleted: number;
    completedJobs?: number;
    verificationLevel: string;
    skills: (string | { id: string; name: string })[];
    hourlyRate: number;
    successRate: number;
    responseTime: string;
    totalEarnings?: number;
  };
  coverLetter: string;
  contractType: ContractType;
  bidAmount: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays: number;
  milestones: ProposalMilestone[];
  attachments: ProposalAttachment[];
  portfolioItems: {
    id: string;
    title: string;
    thumbnailUrl: string;
    imageUrl?: string;
    url?: string;
  }[];
  status: ProposalStatus;
  statusHistory: {
    status: ProposalStatus;
    timestamp: string;
    note?: string;
  }[];
  qualityScore?: QualityScore;
  smartMatchScore?: SmartMatchScore;
  isBoosted: boolean;
  boostType?: 'FEATURED' | 'PREMIUM' | 'STANDARD' | 'BASIC';
  boostExpiresAt?: string;
  viewedAt?: string;
  clientViewed?: boolean;
  clientViewedAt?: string;
  shortlistedAt?: string;
  interviewScheduledAt?: string;
  interviewSlots?: {
    id: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }[];
  hiredAt?: string;
  declinedAt?: string;
  declineReason?: string;
  withdrawnAt?: string;
  contractId?: string;
  matchScore?: SmartMatchScore;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityScore {
  overall: number; // 0-100
  breakdown: {
    coverLetterQuality: number;
    skillsMatch: number;
    portfolioRelevance: number;
    rateCompetitiveness: number;
    completeness: number;
    clarity?: number;
  };
  suggestions: {
    type: 'IMPROVEMENT' | 'WARNING' | 'SUCCESS';
    field?: string;
    message: string;
  }[];
}

export interface SmartMatchScore {
  overall: number; // 0-100
  breakdown: {
    skillsMatch: number;
    skills?: number;
    experienceRelevance: number;
    experience?: number;
    trustScore: number;
    rateCompetitiveness: number;
    budget?: number;
    availabilityFit: number;
    communicationScore: number;
  };
  highlights: string[];
  concerns: string[];
}

export interface ProposalFilters {
  status?: ProposalStatus | ProposalStatus[];
  jobId?: string;
  minBid?: number;
  maxBid?: number;
  minScore?: number;
  isBoosted?: boolean;
  hasInterview?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export type ProposalSortBy =
  | 'newest'
  | 'oldest'
  | 'match_score'
  | 'rate_low'
  | 'rate_high'
  | 'quality_score'
  | 'delivery_time';

export interface ProposalListResponse {
  proposals: Proposal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    submitted: number;
    viewed: number;
    shortlisted: number;
    interviewing: number;
    hired: number;
    declined: number;
    withdrawn: number;
  };
}

export interface ClientProposalStats {
  totalProposals: number;
  newProposals: number;
  shortlistedCount: number;
  averageBid: number;
  lowestBid: number;
  highestBid: number;
  averageDeliveryDays: number;
  topSkillsMatched: string[];
}

export interface FreelancerProposalStats {
  totalSubmitted: number;
  pending: number;
  viewed: number;
  shortlisted: number;
  hired: number;
  declined: number;
  withdrawn: number;
  averageResponseTime: string;
  winRate: number;
  averageBidAmount: number;
}

export type BoostType = 'BASIC' | 'FEATURED' | 'PREMIUM';

export type BoostOptions = BoostType | {
  type?: BoostType;
  duration?: '24h' | '3d' | '7d';
  paymentMethodId?: string;
};

export interface BoostPricing {
  duration: '24h' | '3d' | '7d';
  price: number;
  currency: string;
  averageViewIncrease: number;
  averageShortlistIncrease: number;
}

export interface HireData {
  proposalId: string;
  contractType?: ContractType;
  totalAmount?: number;
  agreedAmount?: number;
  agreedDeliveryDays?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  milestones?: {
    title: string;
    description: string;
    amount: number;
    durationDays: number;
    dueDate?: string;
  }[];
  startDate?: string;
  deadline?: string;
  messageToFreelancer?: string;
  welcomeMessage?: string;
  enableSkillPod?: boolean;
  skillPodSecurityPolicy?: 'STANDARD' | 'HIGH' | 'MAXIMUM';
  initialFundingMilestoneId?: string;
}

export interface Contract {
  id: string;
  proposalId: string;
  jobId: string;
  clientId: string;
  freelancerId: string;
  contractType: ContractType;
  totalAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  milestones: {
    id: string;
    title: string;
    description: string;
    amount: number;
    dueDate?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'DISPUTED';
    fundedAt?: string;
    completedAt?: string;
  }[];
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  startDate: string;
  deadline?: string;
  skillPodEnabled: boolean;
  createdAt: string;
}

export interface InterviewSlot {
  id: string;
  proposalId: string;
  proposedBy: 'CLIENT' | 'FREELANCER';
  startTime: string;
  endTime: string;
  timezone: string;
  videoCallUrl?: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
}

export interface SuggestedMilestone {
  title: string;
  description: string;
  percentageOfTotal: number;
  typicalDurationDays: number;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  coverLetter: string;
  category?: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_MARKET_API_URL ?? '/api/market';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Proposal Submission
// ============================================================================

/**
 * Submit a new proposal for a job
 */
export async function submitProposal(data: ProposalSubmission): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Save proposal draft
 */
export async function saveProposalDraft(
  jobId: string,
  data: Partial<ProposalDraft>
): Promise<ProposalDraft> {
  return apiFetch<ProposalDraft>(`${API_BASE_URL}/bids/drafts/${jobId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Get proposal draft for a job
 */
export async function getProposalDraft(jobId: string): Promise<ProposalDraft | null> {
  try {
    return await apiFetch<ProposalDraft>(`${API_BASE_URL}/bids/drafts/${jobId}`);
  } catch {
    return null;
  }
}

/**
 * Delete proposal draft
 */
export async function deleteProposalDraft(jobId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/bids/drafts/${jobId}`, {
    method: 'DELETE',
  });
}

/**
 * Upload attachment for proposal
 */
export async function uploadProposalAttachment(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ProposalAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as ProposalAttachment);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', `${API_BASE_URL}/bids/attachments`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

/**
 * Delete attachment
 */
export async function deleteProposalAttachment(attachmentId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/bids/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Proposal Management (Freelancer)
// ============================================================================

/**
 * Get freelancer's proposals
 */
export async function getMyProposals(
  filters?: ProposalFilters,
  sortBy: ProposalSortBy = 'newest',
  page = 1,
  pageSize = 20
): Promise<ProposalListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
  });

  if (filters) {
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      statuses.forEach((s) => params.append('status', s));
    }
    if (filters.jobId) params.append('jobId', filters.jobId);
    if (filters.minBid) params.append('minBid', String(filters.minBid));
    if (filters.maxBid) params.append('maxBid', String(filters.maxBid));
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
  }

  return apiFetch<ProposalListResponse>(`${API_BASE_URL}/bids/my?${params.toString()}`);
}

/**
 * Get proposal details
 */
export async function getProposalDetails(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}`);
}

/**
 * Update proposal (if allowed by status)
 */
export async function updateProposal(proposalId: string, data: ProposalUpdate): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Withdraw proposal
 */
export async function withdrawProposal(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/withdraw`, {
    method: 'POST',
  });
}

/**
 * Get proposal quality score
 */
export async function getProposalQualityScore(proposalId: string): Promise<QualityScore> {
  return apiFetch<QualityScore>(`${API_BASE_URL}/bids/${proposalId}/quality-score`);
}

/**
 * Preview quality score before submission
 */
export async function previewQualityScore(
  data: Partial<ProposalSubmission>
): Promise<QualityScore> {
  return apiFetch<QualityScore>(`${API_BASE_URL}/bids/quality-score/preview`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get freelancer's proposal statistics
 */
export async function getFreelancerProposalStats(): Promise<FreelancerProposalStats> {
  return apiFetch<FreelancerProposalStats>(`${API_BASE_URL}/bids/my/stats`);
}

// ============================================================================
// Proposal Boost
// ============================================================================

/**
 * Get boost pricing options
 */
export async function getBoostPricing(): Promise<BoostPricing[]> {
  return apiFetch<BoostPricing[]>(`${API_BASE_URL}/bids/boost/pricing`);
}

/**
 * Boost a proposal
 */
export async function boostProposal(
  proposalId: string,
  options: BoostOptions
): Promise<{ proposal: Proposal; transaction: { id: string; amount: number } }> {
  return apiFetch(`${API_BASE_URL}/bids/${proposalId}/boost`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// ============================================================================
// Client Proposal Review
// ============================================================================

/**
 * Get proposals for a job (client view)
 */
export async function getProposalsForJob(
  jobId: string,
  filters?: ProposalFilters,
  sortBy: ProposalSortBy = 'match_score',
  page = 1,
  pageSize = 20
): Promise<ProposalListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
  });

  if (filters) {
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      statuses.forEach((s) => params.append('status', s));
    }
    if (filters.minBid) params.append('minBid', String(filters.minBid));
    if (filters.maxBid) params.append('maxBid', String(filters.maxBid));
    if (filters.minScore) params.append('minScore', String(filters.minScore));
    if (filters.isBoosted !== undefined) params.append('isBoosted', String(filters.isBoosted));
  }

  return apiFetch<ProposalListResponse>(`${API_BASE_URL}/jobs/${jobId}/bids?${params.toString()}`);
}

/**
 * Get client's proposal statistics for a job
 */
export async function getClientProposalStats(jobId: string): Promise<ClientProposalStats> {
  return apiFetch<ClientProposalStats>(`${API_BASE_URL}/jobs/${jobId}/bids/stats`);
}

/**
 * Shortlist a proposal
 */
export async function shortlistProposal(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/shortlist`, {
    method: 'POST',
  });
}

/**
 * Remove from shortlist
 */
export async function unshortlistProposal(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/unshortlist`, {
    method: 'POST',
  });
}

/**
 * Archive a proposal
 */
export async function archiveProposal(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/archive`, {
    method: 'POST',
  });
}

/**
 * Unarchive a proposal
 */
export async function unarchiveProposal(proposalId: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/unarchive`, {
    method: 'POST',
  });
}

/**
 * Decline a proposal with reason
 */
export async function declineProposal(proposalId: string, reason?: string): Promise<Proposal> {
  return apiFetch<Proposal>(`${API_BASE_URL}/bids/${proposalId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Bulk shortlist proposals
 */
export async function bulkShortlistProposals(proposalIds: string[]): Promise<Proposal[]> {
  return apiFetch<Proposal[]>(`${API_BASE_URL}/bids/bulk/shortlist`, {
    method: 'POST',
    body: JSON.stringify({ proposalIds }),
  });
}

/**
 * Bulk archive proposals
 */
export async function bulkArchiveProposals(proposalIds: string[]): Promise<Proposal[]> {
  return apiFetch<Proposal[]>(`${API_BASE_URL}/bids/bulk/archive`, {
    method: 'POST',
    body: JSON.stringify({ proposalIds }),
  });
}

// ============================================================================
// Hiring Flow
// ============================================================================

/**
 * Hire freelancer and create contract
 * Can be called as hireFreelancer(data) or hireFreelancer(proposalId, options)
 */
export async function hireFreelancer(
  dataOrProposalId: HireData | string,
  options?: Omit<HireData, 'proposalId'>
): Promise<Contract> {
  const data: HireData = typeof dataOrProposalId === 'string'
    ? { proposalId: dataOrProposalId, ...options } as HireData
    : dataOrProposalId;
  return apiFetch<Contract>(`${API_BASE_URL}/bids/${data.proposalId}/hire`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Calculate escrow amount for hiring
 */
export async function calculateEscrowAmount(
  proposalId: string,
  milestoneId?: string
): Promise<{
  amount: number;
  fee: number;
  total: number;
  currency: string;
}> {
  const params = new URLSearchParams();
  if (milestoneId) params.append('milestoneId', milestoneId);

  return apiFetch(`${API_BASE_URL}/bids/${proposalId}/escrow-calculation?${params.toString()}`);
}

// ============================================================================
// Interview Scheduling
// ============================================================================

/**
 * Propose interview times
 */
export async function proposeInterviewTimes(
  proposalId: string,
  slots: { startTime: string; endTime: string }[],
  timezone: string,
  notes?: string
): Promise<InterviewSlot[]> {
  return apiFetch<InterviewSlot[]>(`${API_BASE_URL}/bids/${proposalId}/interviews`, {
    method: 'POST',
    body: JSON.stringify({ slots, timezone, notes }),
  });
}

/**
 * Accept interview slot
 */
export async function acceptInterviewSlot(slotId: string): Promise<InterviewSlot> {
  return apiFetch<InterviewSlot>(`${API_BASE_URL}/interviews/${slotId}/accept`, {
    method: 'POST',
  });
}

/**
 * Decline interview slot
 */
export async function declineInterviewSlot(slotId: string): Promise<InterviewSlot> {
  return apiFetch<InterviewSlot>(`${API_BASE_URL}/interviews/${slotId}/decline`, {
    method: 'POST',
  });
}

/**
 * Cancel interview
 */
export async function cancelInterview(slotId: string): Promise<InterviewSlot> {
  return apiFetch<InterviewSlot>(`${API_BASE_URL}/interviews/${slotId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Get interview slots for proposal
 */
export async function getInterviewSlots(proposalId: string): Promise<InterviewSlot[]> {
  return apiFetch<InterviewSlot[]>(`${API_BASE_URL}/bids/${proposalId}/interviews`);
}

// ============================================================================
// Templates & Suggestions
// ============================================================================

/**
 * Get user's proposal templates
 */
export async function getProposalTemplates(): Promise<ProposalTemplate[]> {
  return apiFetch<ProposalTemplate[]>(`${API_BASE_URL}/bids/templates`);
}

/**
 * Create proposal template
 */
export async function createProposalTemplate(
  name: string,
  coverLetter: string,
  category?: string,
  tags?: string[]
): Promise<ProposalTemplate> {
  return apiFetch<ProposalTemplate>(`${API_BASE_URL}/bids/templates`, {
    method: 'POST',
    body: JSON.stringify({ name, coverLetter, category, tags }),
  });
}

/**
 * Update proposal template
 */
export async function updateProposalTemplate(
  templateId: string,
  data: Partial<Omit<ProposalTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>
): Promise<ProposalTemplate> {
  return apiFetch<ProposalTemplate>(`${API_BASE_URL}/bids/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete proposal template
 */
export async function deleteProposalTemplate(templateId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/bids/templates/${templateId}`, {
    method: 'DELETE',
  });
}

/**
 * Get suggested milestones for a job category
 */
export async function getSuggestedMilestones(jobId: string): Promise<SuggestedMilestone[]> {
  return apiFetch<SuggestedMilestone[]>(`${API_BASE_URL}/jobs/${jobId}/suggested-milestones`);
}

/**
 * Get cover letter suggestions based on job
 */
export async function getCoverLetterSuggestions(jobId: string): Promise<{
  tips: string[];
  keyPointsToAddress: string[];
  skillsToHighlight: string[];
  questionsToAnswer: string[];
}> {
  return apiFetch(`${API_BASE_URL}/jobs/${jobId}/cover-letter-suggestions`);
}

// ============================================================================
// Competitive Intelligence
// ============================================================================

/**
 * Get competitive bid insights for a job
 */
export async function getCompetitiveBidInsights(jobId: string): Promise<{
  totalBids: number;
  averageBid: number;
  medianBid: number;
  bidRange: { min: number; max: number };
  averageDeliveryDays: number;
  yourPosition?: {
    bidPercentile: number;
    deliveryPercentile: number;
  };
}> {
  return apiFetch(`${API_BASE_URL}/jobs/${jobId}/bid-insights`);
}

// ============================================================================
// Real-time Updates
// ============================================================================

/**
 * Subscribe to proposal updates via WebSocket
 */
export function subscribeToProposalUpdates(
  proposalId: string,
  onUpdate: (proposal: Proposal) => void
): () => void {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://api.skillancer.com/ws';
  const ws = new WebSocket(`${wsUrl}/bids/${proposalId}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as { type: string; proposal: Proposal };
      if (data.type === 'PROPOSAL_UPDATED') {
        onUpdate(data.proposal);
      }
    } catch {
      // Ignore parse errors
    }
  };

  return () => {
    ws.close();
  };
}

/**
 * Job proposal event types for WebSocket subscription
 */
export type JobProposalEvent =
  | { type: 'NEW_PROPOSAL'; proposal: Proposal }
  | { type: 'PROPOSAL_UPDATED'; proposal: Proposal }
  | { type: 'PROPOSAL_WITHDRAWN'; proposalId: string };

/**
 * Subscribe to job proposals updates (for clients)
 */
export function subscribeToJobProposals(
  jobId: string,
  onEvent: (event: JobProposalEvent) => void
): () => void {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://api.skillancer.com/ws';
  const ws = new WebSocket(`${wsUrl}/jobs/${jobId}/bids`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as JobProposalEvent;
      onEvent(data);
    } catch {
      // Ignore parse errors
    }
  };

  return () => {
    ws.close();
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate freelancer earnings after platform fees
 */
export function calculateEarningsAfterFees(amount: number): {
  grossAmount: number;
  platformFee: number;
  paymentProcessingFee: number;
  netEarnings: number;
} {
  // Platform fee: 10% for amounts up to $500, 5% for $500-$10k, 3% above $10k
  let platformFeeRate: number;
  if (amount <= 500) {
    platformFeeRate = 0.1;
  } else if (amount <= 10000) {
    platformFeeRate = 0.05;
  } else {
    platformFeeRate = 0.03;
  }

  const platformFee = Math.round(amount * platformFeeRate * 100) / 100;
  const paymentProcessingFee = Math.round(amount * 0.029 * 100) / 100 + 0.3; // 2.9% + $0.30

  return {
    grossAmount: amount,
    platformFee,
    paymentProcessingFee,
    netEarnings: Math.round((amount - platformFee - paymentProcessingFee) * 100) / 100,
  };
}

/**
 * Get status display info
 */
export function getProposalStatusInfo(status: ProposalStatus): {
  label: string;
  color: string;
  description: string;
} {
  const statusMap: Record<ProposalStatus, { label: string; color: string; description: string }> = {
    DRAFT: {
      label: 'Draft',
      color: 'gray',
      description: 'Proposal is being drafted',
    },
    SUBMITTED: {
      label: 'Submitted',
      color: 'blue',
      description: 'Proposal has been submitted',
    },
    VIEWED: {
      label: 'Viewed',
      color: 'purple',
      description: 'Client has viewed your proposal',
    },
    SHORTLISTED: {
      label: 'Shortlisted',
      color: 'yellow',
      description: "You're on the client's shortlist",
    },
    INTERVIEW: {
      label: 'Interview',
      color: 'orange',
      description: 'Interview scheduled or in progress',
    },
    HIRED: {
      label: 'Hired',
      color: 'green',
      description: "Congratulations! You've been hired",
    },
    DECLINED: {
      label: 'Declined',
      color: 'red',
      description: 'Proposal was not accepted',
    },
    WITHDRAWN: {
      label: 'Withdrawn',
      color: 'gray',
      description: 'You withdrew this proposal',
    },
    EXPIRED: {
      label: 'Expired',
      color: 'gray',
      description: 'Proposal has expired',
    },
    INTERVIEWING: {
      label: 'Interviewing',
      color: 'orange',
      description: 'Interview process in progress',
    },
    ARCHIVED: {
      label: 'Archived',
      color: 'gray',
      description: 'Proposal has been archived',
    },
  };

  return statusMap[status];
}

/**
 * Check if proposal can be edited
 */
export function canEditProposal(status: ProposalStatus): boolean {
  return ['DRAFT', 'SUBMITTED'].includes(status);
}

/**
 * Check if proposal can be withdrawn
 */
export function canWithdrawProposal(status: ProposalStatus): boolean {
  return ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(status);
}

/**
 * Format currency for display
 */
export function formatBidAmount(
  amount: number,
  currency = 'USD',
  contractType: ContractType = 'FIXED'
): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  return contractType === 'HOURLY' ? `${formatted}/hr` : formatted;
}
