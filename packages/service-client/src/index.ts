/**
 * @module @skillancer/service-client
 * Inter-service communication package for Skillancer microservices
 *
 * Provides:
 * - Typed HTTP clients for each service
 * - Circuit breaker pattern for fault tolerance
 * - Distributed tracing via request context
 * - BullMQ job queues for async messaging
 * - Redis pub/sub event bus for domain events
 * - Saga orchestrator for distributed transactions
 */

// Core utilities
export { CircuitBreaker, type CircuitState, CircuitOpenError } from './circuit-breaker.js';
export { logger } from './logger.js';
export {
  runWithContext,
  getContext,
  getContextHeaders,
  type RequestContext,
} from './request-context.js';
export {
  BaseServiceClient,
  ServiceClientError,
  ServiceUnavailableError,
  ServiceTimeoutError,
  type ServiceClientConfig,
  type RequestOptions,
  type ServiceResponse,
  type PaginatedResponse,
  type Pagination,
} from './base-client.js';

// Service clients
export {
  AuthServiceClient,
  authClient,
  type User,
  type AuthTokens,
  type TokenPayload,
} from './clients/auth-client.js';

export {
  MarketServiceClient,
  marketClient,
  type Job,
  type Bid,
  type Contract,
  type Service,
} from './clients/market-client.js';

export {
  SkillPodServiceClient,
  skillpodClient,
  type SkillPod,
  type Session,
  type PodTemplate,
} from './clients/skillpod-client.js';

export {
  CockpitServiceClient,
  cockpitClient,
  type FreelancerProfile,
  type ClientProfile,
} from './clients/cockpit-client.js';

export {
  BillingServiceClient,
  billingClient,
  type Escrow,
  type Payment,
  type Invoice,
  type Payout,
} from './clients/billing-client.js';

export {
  NotificationServiceClient,
  notificationClient,
  type Notification,
  type NotificationPreferences,
} from './clients/notification-client.js';

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
} from './clients/ml-recommendation-client.js';

// Queue exports
export {
  QueueManager,
  queueManager,
  QueueNames,
  JobNames,
  type QueueName,
  type JobName,
  type JobEnvelope,
  type JobProcessor,
  type QueueJobMap,
} from './queue/index.js';

// Event exports
export {
  EventBus,
  eventBus,
  EventTypes,
  EventChannels,
  type DomainEvent,
  type EventType,
  type EventHandler,
  type SubscriptionOptions,
  type EventChannel,
} from './events/index.js';

// Saga exports
export {
  SagaOrchestrator,
  sagaOrchestrator,
  InMemorySagaStore,
  SagaError,
  SagaTimeoutError,
  SagaCompensationError,
  createContractSaga,
  type SagaDefinition,
  type SagaStep,
  type SagaContext,
  type SagaResult,
  type SagaStepResult,
  type SagaStatus,
  type SagaStepStatus,
  type SagaExecutionOptions,
  type SagaStore,
  type SagaState,
  type CreateContractSagaInput,
  type CreateContractSagaOutput,
} from './saga/index.js';
