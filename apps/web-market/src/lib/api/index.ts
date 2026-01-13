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
  type Amendment,
  type Dispute,
  type ContractFilters,
  type ContractParty,
  type ContractEvent,
  type Contract,
  type PaginatedResponse,
} from './contracts';
export * from './endorsements';
export {
  type FreelancerProfile,
  type FreelancerSearchFilters,
  type FreelancerSearchResponse,
  type FreelancerSkill,
  type PortfolioItem,
  type AvailabilityStatus,
  type ProficiencyLevel,
} from './freelancers';
export {
  type Job,
  type ClientInfo,
  type JobQuestion,
  type JobSearchFilters,
  type JobSearchResult,
  type Skill,
  type Category,
} from './jobs';
export * from './messages';
export * from './recommendations';
export {
  type SkillCategory,
  type SkillEndorsement,
  type SkillSearchResult,
  type SkillAssessment,
  type SkillVerification,
  type Skill as SkillTaxonomy,
  type SkillConfidence,
  type AssessmentAttempt,
} from './skills';
