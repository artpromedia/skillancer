/**
 * @module @skillancer/cockpit-svc/services/integrations
 * Integration Services exports
 */

export { EncryptionService } from '../encryption.service.js';
export { BaseIntegrationService } from './base-integration.service.js';
export type {
  RateLimitConfig,
  RateLimitedResponse,
  RetryConfig,
} from './base-integration.service.js';
export { IntegrationPlatformService } from './integration-platform.service.js';

// Freelance Platform Integrations
export { UpworkIntegrationService } from './upwork-integration.service.js';
export type {
  UpworkContract,
  UpworkTimeEntry,
  UpworkEarning,
  UpworkSyncOptions,
} from './upwork-integration.service.js';

export { FiverrIntegrationService } from './fiverr-integration.service.js';
export type {
  FiverrGig,
  FiverrOrder,
  FiverrEarning,
  FiverrSyncOptions,
} from './fiverr-integration.service.js';

export { ToptalIntegrationService } from './toptal-integration.service.js';
export type {
  ToptalEngagement,
  ToptalTimeLog,
  ToptalPayment,
  ToptalSyncOptions,
} from './toptal-integration.service.js';

export { FreelancerIntegrationService } from './freelancer-integration.service.js';
export type {
  FreelancerProject,
  FreelancerMilestone,
  FreelancerPayment,
  FreelancerTimeTrack,
  FreelancerSyncOptions,
} from './freelancer-integration.service.js';
