/**
 * @module @skillancer/auth-svc/errors
 * Custom error classes for authentication operations
 */

import { AppError } from '@skillancer/utils';

// =============================================================================
// AUTH ERRORS
// =============================================================================

/**
 * Error thrown when user credentials are invalid
 */
export class InvalidCredentialsError extends AppError {
  public override readonly name = 'InvalidCredentialsError';

  constructor(message = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

/**
 * Error thrown when account is locked due to too many failed attempts
 */
export class AccountLockedError extends AppError {
  public override readonly name = 'AccountLockedError';

  constructor(
    message = 'Account temporarily locked',
    public readonly unlockAt?: Date
  ) {
    super(message, 'ACCOUNT_LOCKED', 423, { unlockAt: unlockAt?.toISOString() });
  }
}

/**
 * Error thrown when email is not verified
 */
export class EmailNotVerifiedError extends AppError {
  public override readonly name = 'EmailNotVerifiedError';

  constructor(message = 'Email address not verified') {
    super(message, 'EMAIL_NOT_VERIFIED', 403);
  }
}

/**
 * Error thrown when user account is suspended or inactive
 */
export class AccountSuspendedError extends AppError {
  public override readonly name = 'AccountSuspendedError';

  constructor(message = 'Account suspended') {
    super(message, 'ACCOUNT_SUSPENDED', 403);
  }
}

/**
 * Error thrown when email already exists
 */
export class EmailExistsError extends AppError {
  public override readonly name = 'EmailExistsError';

  constructor(email?: string) {
    super(
      email ? `Email ${email} is already registered` : 'Email already registered',
      'EMAIL_EXISTS',
      409
    );
  }
}

/**
 * Error thrown when token is invalid or expired
 */
export class InvalidTokenError extends AppError {
  public override readonly name = 'InvalidTokenError';

  constructor(tokenType: 'access' | 'refresh' | 'verification' | 'reset' = 'access') {
    const messages = {
      access: 'Invalid or expired access token',
      refresh: 'Invalid or expired refresh token',
      verification: 'Invalid or expired verification token',
      reset: 'Invalid or expired password reset token',
    } as const;
    super(messages[tokenType], 'INVALID_TOKEN', 401, { tokenType });
  }
}

/**
 * Error thrown when session is invalid or expired
 */
export class SessionExpiredError extends AppError {
  public override readonly name = 'SessionExpiredError';

  constructor(message = 'Session expired') {
    super(message, 'SESSION_EXPIRED', 401);
  }
}

/**
 * Error thrown when password doesn't meet requirements
 */
export class WeakPasswordError extends AppError {
  public override readonly name = 'WeakPasswordError';

  constructor(message = 'Password does not meet requirements', details?: Record<string, unknown>) {
    super(message, 'WEAK_PASSWORD', 400, details);
  }
}

/**
 * Error thrown when OAuth flow fails
 */
export class OAuthError extends AppError {
  public override readonly name = 'OAuthError';

  constructor(provider: string, message = 'OAuth authentication failed') {
    super(message, 'OAUTH_ERROR', 401, { provider });
  }
}

/**
 * Error thrown when OAuth provider is not configured
 */
export class OAuthNotConfiguredError extends AppError {
  public override readonly name = 'OAuthNotConfiguredError';

  constructor(provider: string) {
    super(`OAuth provider ${provider} is not configured`, 'OAUTH_NOT_CONFIGURED', 501, {
      provider,
    });
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitExceededError extends AppError {
  public override readonly name = 'RateLimitExceededError';

  constructor(
    message = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}
