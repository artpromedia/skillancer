/**
 * @module @skillancer/billing-svc
 * Billing and payment processing service
 *
 * Features:
 * - Payment method management (Cards, ACH, SEPA)
 * - Stripe integration
 * - Card expiration monitoring
 * - Webhook handling
 */

// Re-export app factory
export { createApp } from './app.js';

// Re-export services
export { getStripeService, initializeStripeService } from './services/stripe.service.js';
export {
  getPaymentMethodService,
  initializePaymentMethodService,
} from './services/payment-method.service.js';

// Re-export types
export type {
  PaymentMethodResponse,
  PaymentMethodFilters,
  AddPaymentMethodResult,
  SyncResult,
  SetupIntentResult,
} from './services/payment-method.service.js';

// Re-export errors
export {
  StripeError,
  PaymentMethodNotFoundError,
  PaymentMethodInUseError,
  InvalidPaymentMethodError,
  SetupIntentError,
  CustomerNotFoundError,
} from './errors/index.js';

// Re-export job utilities
export {
  initializeCardExpirationJob,
  scheduleCardExpirationJob,
  triggerCardExpirationCheck,
  closeCardExpirationJob,
  getQueueStatus,
} from './jobs/card-expiration.job.js';

// Run as main module
import './app.js';
