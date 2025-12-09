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
