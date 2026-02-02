/**
 * API Services Index
 *
 * Export all service modules for consumption by hooks and components.
 */

// API Client
export {
  getApiClient,
  apiClient,
  setAuthTokens,
  clearAuthTokens,
  isAuthenticated,
  resetApiClient,
} from '../api-client';

// Services
export { jobsService } from './jobs';
export { proposalsService } from './proposals';
export { contractsService } from './contracts';
export { usersService } from './users';

// Types - Jobs
export type {
  Job,
  JobSkill,
  JobClient,
  JobAttachment,
  JobQuestion,
  JobSearchFilters,
  JobSearchParams,
  CreateJobInput,
  UpdateJobInput,
  Category,
  BudgetType,
  DurationUnit,
  ExperienceLevel,
  JobVisibility,
  JobStatus,
} from './jobs';

// Types - Proposals
export type {
  Proposal,
  ProposalMilestone,
  ProposalAttachment,
  ProposalFreelancer,
  ProposalJob,
  SubmitProposalInput,
  UpdateProposalInput,
  ProposalDraft,
  ProposalListParams,
  ProposalStats,
  ProposalStatus,
  ContractType,
} from './proposals';

// Types - Contracts
export type {
  Contract,
  ContractMilestone,
  ContractParty,
  ContractAttachment,
  MilestoneSubmission,
  MilestoneRevision,
  TimeEntry,
  CreateContractInput,
  UpdateContractInput,
  ContractListParams,
  SubmitMilestoneInput,
  RequestRevisionInput,
  TimeEntryInput,
  ContractReview,
  SubmitReviewInput,
  ContractStatus,
  MilestoneStatus,
} from './contracts';

// Types - Users
export type {
  UserProfile,
  FreelancerProfile,
  ClientProfile,
  UserSkill,
  PortfolioItem,
  WorkExperience,
  Education,
  Certification,
  UpdateProfileInput,
  UpdateFreelancerProfileInput,
  UpdateClientProfileInput,
  FreelancerSearchParams,
  UserReview,
  UserRole,
  VerificationLevel,
  AvailabilityStatus,
  ProficiencyLevel,
} from './users';
