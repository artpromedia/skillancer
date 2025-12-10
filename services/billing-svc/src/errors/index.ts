/**
 * @module @skillancer/billing-svc/errors
 * Custom error classes for billing service
 */

// =============================================================================
// BASE ERROR
// =============================================================================

export class BillingError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details ?? undefined;
    Error.captureStackTrace(this, this.constructor);
  }
}

// =============================================================================
// STRIPE ERRORS
// =============================================================================

export class StripeError extends BillingError {
  public readonly stripeCode: string | undefined;

  constructor(message: string, stripeCode?: string, details?: Record<string, unknown>) {
    super(message, 'STRIPE_ERROR', 502, details);
    this.name = 'StripeError';
    this.stripeCode = stripeCode ?? undefined;
  }
}

export class StripeWebhookError extends BillingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STRIPE_WEBHOOK_ERROR', 400, details);
    this.name = 'StripeWebhookError';
  }
}

export class StripeCustomerNotFoundError extends BillingError {
  constructor(identifier: string) {
    super(`Stripe customer not found: ${identifier}`, 'STRIPE_CUSTOMER_NOT_FOUND', 404);
    this.name = 'StripeCustomerNotFoundError';
  }
}

// =============================================================================
// PAYMENT METHOD ERRORS
// =============================================================================

export class PaymentMethodNotFoundError extends BillingError {
  constructor(paymentMethodId: string) {
    super(`Payment method not found: ${paymentMethodId}`, 'PAYMENT_METHOD_NOT_FOUND', 404);
    this.name = 'PaymentMethodNotFoundError';
  }
}

export class PaymentMethodInUseError extends BillingError {
  constructor(paymentMethodId: string, usageType: string) {
    super(
      `Payment method ${paymentMethodId} cannot be removed because it is ${usageType}`,
      'PAYMENT_METHOD_IN_USE',
      409
    );
    this.name = 'PaymentMethodInUseError';
  }
}

export class PaymentMethodLimitExceededError extends BillingError {
  constructor(limit: number) {
    super(
      `Maximum number of payment methods (${limit}) exceeded`,
      'PAYMENT_METHOD_LIMIT_EXCEEDED',
      400
    );
    this.name = 'PaymentMethodLimitExceededError';
  }
}

export class PaymentMethodAlreadyExistsError extends BillingError {
  constructor(fingerprint?: string) {
    super(
      'A payment method with these details already exists',
      'PAYMENT_METHOD_ALREADY_EXISTS',
      409,
      fingerprint ? { fingerprint } : undefined
    );
    this.name = 'PaymentMethodAlreadyExistsError';
  }
}

export class InvalidPaymentMethodTypeError extends BillingError {
  constructor(type: string, allowedTypes: string[]) {
    super(
      `Invalid payment method type: ${type}. Allowed: ${allowedTypes.join(', ')}`,
      'INVALID_PAYMENT_METHOD_TYPE',
      400
    );
    this.name = 'InvalidPaymentMethodTypeError';
  }
}

export class PaymentMethodVerificationRequiredError extends BillingError {
  constructor(paymentMethodId: string, verificationType: string) {
    super(
      `Payment method ${paymentMethodId} requires ${verificationType} verification`,
      'PAYMENT_METHOD_VERIFICATION_REQUIRED',
      402,
      { verificationType }
    );
    this.name = 'PaymentMethodVerificationRequiredError';
  }
}

export class PaymentMethodExpiredError extends BillingError {
  constructor(paymentMethodId: string) {
    super(`Payment method ${paymentMethodId} has expired`, 'PAYMENT_METHOD_EXPIRED', 400);
    this.name = 'PaymentMethodExpiredError';
  }
}

// =============================================================================
// SETUP INTENT ERRORS
// =============================================================================

export class SetupIntentError extends BillingError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SETUP_INTENT_ERROR', 400, details);
    this.name = 'SetupIntentError';
  }
}

// =============================================================================
// VALIDATION ERRORS
// =============================================================================

export class InvalidIbanError extends BillingError {
  constructor(country?: string) {
    super('Invalid IBAN format', 'INVALID_IBAN', 400, country ? { country } : undefined);
    this.name = 'InvalidIbanError';
  }
}

export class InvalidRoutingNumberError extends BillingError {
  constructor() {
    super('Invalid routing number format', 'INVALID_ROUTING_NUMBER', 400);
    this.name = 'InvalidRoutingNumberError';
  }
}

export class UnsupportedCountryError extends BillingError {
  constructor(country: string, paymentMethod: string) {
    super(`${paymentMethod} is not supported in ${country}`, 'UNSUPPORTED_COUNTRY', 400, {
      country,
      paymentMethod,
    });
    this.name = 'UnsupportedCountryError';
  }
}

// =============================================================================
// AUTHORIZATION ERRORS
// =============================================================================

export class UnauthorizedPaymentMethodAccessError extends BillingError {
  constructor(paymentMethodId: string) {
    super(
      `You do not have access to payment method ${paymentMethodId}`,
      'UNAUTHORIZED_PAYMENT_METHOD_ACCESS',
      403
    );
    this.name = 'UnauthorizedPaymentMethodAccessError';
  }
}

// =============================================================================
// SUBSCRIPTION ERRORS
// =============================================================================

export class SubscriptionError extends BillingError {
  constructor(message: string, code = 'SUBSCRIPTION_ERROR', statusCode = 400) {
    super(message, code, statusCode);
    this.name = 'SubscriptionError';
  }
}

export class SubscriptionNotFoundError extends SubscriptionError {
  constructor(subscriptionId: string) {
    super(`Subscription ${subscriptionId} not found`, 'SUBSCRIPTION_NOT_FOUND', 404);
  }
}

export class SubscriptionAlreadyExistsError extends SubscriptionError {
  constructor(product: string) {
    super(
      `An active subscription for ${product} already exists`,
      'SUBSCRIPTION_ALREADY_EXISTS',
      409
    );
  }
}

export class SubscriptionCanceledError extends SubscriptionError {
  constructor(subscriptionId: string) {
    super(
      `Subscription ${subscriptionId} is canceled and cannot be modified`,
      'SUBSCRIPTION_CANCELED',
      400
    );
  }
}

export class SubscriptionInactiveError extends SubscriptionError {
  constructor(subscriptionId: string) {
    super(`Subscription ${subscriptionId} is not active`, 'SUBSCRIPTION_INACTIVE', 400);
  }
}

// =============================================================================
// PLAN ERRORS
// =============================================================================

export class PlanError extends BillingError {
  constructor(message: string, code = 'PLAN_ERROR', statusCode = 400) {
    super(message, code, statusCode);
    this.name = 'PlanError';
  }
}

export class InvalidPlanError extends PlanError {
  constructor(product: string, plan: string) {
    super(`Invalid plan "${plan}" for product ${product}`, 'INVALID_PLAN', 400);
  }
}

export class InvalidPlanChangeError extends PlanError {
  constructor(message: string) {
    super(message, 'INVALID_PLAN_CHANGE', 400);
  }
}

export class PlanNotAvailableError extends PlanError {
  constructor(plan: string) {
    super(`Plan "${plan}" is not available`, 'PLAN_NOT_AVAILABLE', 400);
  }
}

// =============================================================================
// USAGE ERRORS
// =============================================================================

export class UsageError extends BillingError {
  constructor(message: string, code = 'USAGE_ERROR', statusCode = 400) {
    super(message, code, statusCode);
    this.name = 'UsageError';
  }
}

export class UsageLimitExceededError extends UsageError {
  public readonly currentUsage: number;
  public readonly limit: number;

  constructor(currentUsage: number, limit: number) {
    super(`Usage limit exceeded: ${currentUsage} / ${limit} minutes`, 'USAGE_LIMIT_EXCEEDED', 400);
    this.currentUsage = currentUsage;
    this.limit = limit;
  }
}

export class UsageRecordingError extends UsageError {
  constructor(message: string) {
    super(message, 'USAGE_RECORDING_FAILED', 500);
  }
}

// =============================================================================
// INVOICE ERRORS
// =============================================================================

export class InvoiceError extends BillingError {
  constructor(message: string, code = 'INVOICE_ERROR', statusCode = 400) {
    super(message, code, statusCode);
    this.name = 'InvoiceError';
  }
}

export class InvoiceNotFoundError extends InvoiceError {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} not found`, 'INVOICE_NOT_FOUND', 404);
  }
}

export class InvoicePaymentFailedError extends InvoiceError {
  public readonly attemptCount: number;

  constructor(invoiceId: string, attemptCount: number) {
    super(
      `Payment failed for invoice ${invoiceId} (attempt ${attemptCount})`,
      'INVOICE_PAYMENT_FAILED',
      402
    );
    this.attemptCount = attemptCount;
  }
}

// =============================================================================
// PAYMENT METHOD REQUIRED ERROR
// =============================================================================

export class PaymentMethodRequiredError extends BillingError {
  constructor() {
    super('A payment method is required for this subscription', 'PAYMENT_METHOD_REQUIRED', 400);
    this.name = 'PaymentMethodRequiredError';
  }
}

// =============================================================================
// AUTHORIZATION ERRORS
// =============================================================================

export class SubscriptionAccessDeniedError extends BillingError {
  constructor(subscriptionId: string) {
    super(`Access denied to subscription ${subscriptionId}`, 'SUBSCRIPTION_ACCESS_DENIED', 403);
    this.name = 'SubscriptionAccessDeniedError';
  }
}

// =============================================================================
// ALIASES (for backward compatibility)
// =============================================================================

export const InvalidPaymentMethodError = InvalidPaymentMethodTypeError;
export const CustomerNotFoundError = StripeCustomerNotFoundError;

// =============================================================================
// ERROR HELPERS
// =============================================================================

/**
 * Type guard for BillingError
 */
export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}

/**
 * Get error response object
 */
export function getErrorResponse(error: unknown): {
  statusCode: number;
  body: { error: string; code: string; message: string };
} {
  if (isBillingError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.name,
        code: error.code,
        message: error.message,
      },
    };
  }

  // Handle unknown errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    statusCode: 500,
    body: {
      error: 'InternalError',
      code: 'INTERNAL_ERROR',
      message,
    },
  };
}
