/**
 * @module @skillancer/service-client/events
 * Events barrel exports
 */

export { EventBus, eventBus } from './event-bus.js';

export {
  EventTypes,
  EventChannels,
  type DomainEvent,
  type EventType,
  type EventHandler,
  type SubscriptionOptions,
  type EventChannel,
  // Event payload types
  type UserCreatedPayload,
  type UserUpdatedPayload,
  type UserEmailVerifiedPayload,
  type JobCreatedPayload,
  type JobPublishedPayload,
  type JobClosedPayload,
  type BidSubmittedPayload,
  type BidAcceptedPayload,
  type ContractCreatedPayload,
  type ContractCompletedPayload,
  type SkillPodCreatedPayload,
  type SkillPodStartedPayload,
  type SkillPodStoppedPayload,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
  type EscrowCreatedPayload,
  type EscrowReleasedPayload,
  type NotificationSentPayload,
} from './types.js';
