/**
 * @module @skillancer/billing-svc/webhooks/handlers
 * Webhook handler exports
 */

// Payment Intent handlers
export {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handlePaymentIntentRequiresAction,
} from './payment-intent-handlers.js';

// Subscription handlers
export {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from './subscription-handlers.js';

// Connect handlers
export {
  handleAccountUpdated,
  handlePayoutPaid,
  handlePayoutFailed,
  handleTransferCreated,
  handleAccountDeauthorized,
} from './connect-handlers.js';

// Dispute handlers
export {
  handleDisputeCreated,
  handleDisputeUpdated,
  handleDisputeClosed,
} from './dispute-handlers.js';
