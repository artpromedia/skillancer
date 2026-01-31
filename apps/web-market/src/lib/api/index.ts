// API clients barrel export
// Contracts module is the primary source for contract types
// Other modules export specific members to avoid naming conflicts

// Contracts - primary source for contract types
export * from './contracts';

// Bids/Proposals - re-export all (Contract/ContractType will be shadowed by contracts)
export {
  type ProposalStatus,
  type ProposalMilestone,
  type ProposalAttachment,
  type ProposalSubmission,
  type ProposalUpdate,
  type ProposalDraft,
  type Proposal,
  type QualityScore,
  type SmartMatchScore as ProposalSmartMatchScore,
  type ProposalFilters,
  type ProposalSortBy,
  type ProposalListResponse,
  type ClientProposalStats,
  type FreelancerProposalStats,
  type BoostType,
  type BoostOptions,
  type BoostPricing,
  type HireData,
  type InterviewSlot,
  getProposalsForJob,
  getMyProposals,
  submitProposal,
  updateProposal,
  withdrawProposal,
  shortlistProposal,
  boostProposal,
  getBoostPricing,
  hireFreelancer,
} from './bids';

// Jobs - re-export without conflicting types
export {
  type Job,
  type Skill as JobSkill,
  type ClientInfo,
  type Attachment as JobAttachment,
  type JobQuestion,
  type Category,
  type JobSearchFilters,
  type PaginationParams,
  type JobSearchResult,
  type SmartMatchScore as JobSmartMatchScore,
  searchJobs,
  getJobBySlug,
  getJobById,
  getJobCategories,
  getSavedJobs,
  saveJob,
  unsaveJob,
  getRelatedJobs,
  getJobStats,
  getSmartMatchScore,
  getSkillsSuggestions,
} from './jobs';

// Other modules (no conflicts or we handle them)
export * from './endorsements';
export * from './freelancers';
export * from './messages';
export * from './recommendations';
export * from './skills';
