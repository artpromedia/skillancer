// API clients barrel export
// Note: Using explicit exports to avoid duplicate type names
export * from './bids';
export {
  type ContractStatus,
  type MilestoneStatus,
  type TimeEntryStatus,
  type DisputeStatus,
  type AmendmentStatus,
  type Milestone,
  type TimeEntry,
  type ContractAmendment,
  type ContractDispute,
  type ContractFilters,
  type ContractSortBy,
  type ContractListResponse,
  type MilestoneCreateData,
  type TimeEntryCreateData,
  type AmendmentCreateData,
  type ContractMilestone,
  type ContractTimeEntry,
  type ContractStats,
  default as contractsApi,
} from './contracts';
export * from './endorsements';
export {
  type FreelancerProfile,
  type FreelancerSearchFilters,
  type FreelancerSearchResponse,
  default as freelancersApi,
} from './freelancers';
export {
  type Job,
  type JobStatus,
  type ClientInfo,
  type JobQuestion,
  type JobFilters,
  type JobListResponse,
  type JobSearchParams,
  type SavedSearch,
  default as jobsApi,
} from './jobs';
export * from './messages';
export * from './recommendations';
export {
  type SkillCategory,
  type SkillEndorsement,
  type SkillSearchResult,
  type UserSkill,
  type SkillAssessment,
  type SkillVerification,
  type SkillVerificationRequest,
  type AssessmentQuestion,
  type AssessmentResult,
  type TrendingSkill,
  type SkillGapAnalysis,
  default as skillsApi,
} from './skills';
