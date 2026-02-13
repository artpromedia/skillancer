/**
 * @module @skillancer/service-client/clients
 * Service client exports
 */

export {
  AuthServiceClient,
  authClient,
  type User,
  type AuthTokens,
  type TokenPayload,
} from './auth-client.js';
export {
  MarketServiceClient,
  marketClient,
  type Job,
  type Bid,
  type Contract,
  type Service,
} from './market-client.js';
export {
  SkillPodServiceClient,
  skillpodClient,
  type SkillPod,
  type Session,
  type PodTemplate,
} from './skillpod-client.js';
export {
  CockpitServiceClient,
  cockpitClient,
  type FreelancerProfile,
  type ClientProfile,
} from './cockpit-client.js';
export {
  BillingServiceClient,
  billingClient,
  type Escrow,
  type Payment,
  type Invoice,
  type Payout,
} from './billing-client.js';
export {
  NotificationServiceClient,
  notificationClient,
  type Notification,
  type NotificationPreferences,
} from './notification-client.js';
export {
  MLRecommendationServiceClient,
  mlRecommendationClient,
  type AnalyzeJobInput,
  type JobAnalysis,
  type GenerateSuggestionsInput,
  type ProposalSuggestions,
  type ScoreProposalInput,
  type ProposalScore,
  type ImproveProposalInput,
  type ProposalImprovement,
  type OptimizeRateInput,
  type RateRecommendation,
  type AnalyzeRateInput,
  type RateAnalysis,
  type MarketRateData,
  type MarketInsightsInput,
  type MarketInsights,
  type LlmCompletionInput,
  type LlmCompletionResult,
} from './ml-recommendation-client.js';
