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
// ALIASES (for backward compatibility)
// =============================================================================

export const InvalidPaymentMethodError = InvalidPaymentMethodTypeError;
export const CustomerNotFoundError = StripeCustomerNotFoundError;
