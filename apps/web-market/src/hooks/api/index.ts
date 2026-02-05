/**
 * API Hooks Index
 *
 * Export all React Query hooks for API operations.
 */

// Jobs hooks
export {
  jobKeys,
  useJobSearch,
  useInfiniteJobSearch,
  useJob,
  useJobBySlug,
  useMyJobs,
  useFeaturedJobs,
  useRecommendedJobs,
  useCategories,
  useSkillsSearch,
  usePopularSkills,
  useCreateJob,
  useUpdateJob,
  useDeleteJob,
  usePublishJob,
  usePauseJob,
  useCloseJob,
} from './use-jobs';

// Proposals hooks
export {
  proposalKeys,
  useMyProposals,
  useJobProposals,
  useProposal,
  useProposalDraft,
  useProposalStats,
  useSubmitProposal,
  useUpdateProposal,
  useWithdrawProposal,
  useAcceptProposal,
  useDeclineProposal,
  useShortlistProposal,
  useSaveProposalDraft,
  useDeleteProposalDraft,
} from './use-proposals';

// Contracts hooks
export {
  contractKeys,
  useMyContracts,
  useClientContracts,
  useFreelancerContracts,
  useContract,
  useContractMilestones,
  useTimeEntries,
  useContractReviews,
  useCreateContract,
  useUpdateContract,
  useSignContract,
  usePauseContract,
  useResumeContract,
  useCompleteContract,
  useCancelContract,
  useFundMilestone,
  useSubmitMilestone,
  useApproveMilestone,
  useRequestRevision,
  useReleaseMilestone,
  useLogTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  useApproveTimeEntries,
  useSubmitReview,
} from './use-contracts';

// Users hooks
export {
  userKeys,
  useCurrentUser,
  useFreelancerProfile,
  useMyFreelancerProfile,
  useMyClientProfile,
  useFreelancerSearch,
  useUserReviews,
  useUpdateProfile,
  useUpdateFreelancerProfile,
  useUpdateClientProfile,
  useUpdateAvatar,
  useDeleteAvatar,
  useAddSkill,
  useUpdateSkill,
  useRemoveSkill,
  useAddPortfolioItem,
  useUpdatePortfolioItem,
  useDeletePortfolioItem,
  useReorderPortfolio,
  useAddWorkExperience,
  useUpdateWorkExperience,
  useDeleteWorkExperience,
  useAddEducation,
  useUpdateEducation,
  useDeleteEducation,
  useAddCertification,
  useUpdateCertification,
  useDeleteCertification,
} from './use-users';

// Payments hooks
export {
  useConnectStatus,
  useCreateConnectAccount,
  useDisconnectAccount,
  usePaymentMethods,
  useAddPaymentMethod,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
  useCreateSetupIntent,
  useCreateCharge,
  useEscrowStatus,
} from './use-payments';

// Re-export types from hooks
export type {
  Job,
  JobSearchParams,
  CreateJobInput,
  UpdateJobInput,
  Category,
  JobSkill,
} from './use-jobs';

export type {
  Proposal,
  ProposalListParams,
  SubmitProposalInput,
  UpdateProposalInput,
  ProposalStatus,
  ProposalDraft,
} from './use-proposals';

export type {
  Contract,
  ContractMilestone,
  ContractListParams,
  CreateContractInput,
  UpdateContractInput,
  SubmitMilestoneInput,
  RequestRevisionInput,
  TimeEntry,
  TimeEntryInput,
  ContractReview,
  SubmitReviewInput,
  ContractStatus,
  MilestoneStatus,
} from './use-contracts';

export type {
  UserProfile,
  FreelancerProfile,
  ClientProfile,
  UpdateProfileInput,
  UpdateFreelancerProfileInput,
  UpdateClientProfileInput,
  FreelancerSearchParams,
  UserReview,
  UserSkill,
  PortfolioItem,
  WorkExperience,
  Education,
  Certification,
} from './use-users';
