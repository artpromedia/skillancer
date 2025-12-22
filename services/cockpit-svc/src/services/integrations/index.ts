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

// Productivity Tool Integrations
export { NotionIntegrationService } from './notion-integration.service.js';
export type {
  NotionDatabase,
  NotionPage,
  NotionTask,
  NotionSyncOptions,
} from './notion-integration.service.js';

export { TrelloIntegrationService } from './trello-integration.service.js';
export type {
  TrelloBoard,
  TrelloList,
  TrelloCard,
  TrelloSyncOptions,
} from './trello-integration.service.js';

export { AsanaIntegrationService } from './asana-integration.service.js';

// Communication Platform Integrations
export { SlackIntegrationService } from './slack-integration.service.js';
export type {
  SlackSlashCommand,
  SlackCommandResponse,
  SlackInteractionPayload,
} from './slack-integration.service.js';

export { DiscordIntegrationService } from './discord-integration.service.js';
export type {
  DiscordInteraction,
  DiscordInteractionResponse,
} from './discord-integration.service.js';
