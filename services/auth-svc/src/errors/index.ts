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
 * Error thrown when authentication is required but missing or invalid
 */
export class UnauthorizedError extends AppError {
  public override readonly name = 'UnauthorizedError';

  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
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

// =============================================================================
// MFA ERRORS
// =============================================================================

/**
 * Error thrown when MFA is not enabled for the user
 */
export class MfaNotEnabledError extends AppError {
  public override readonly name = 'MfaNotEnabledError';

  constructor(message = 'MFA is not enabled for this account') {
    super(message, 'MFA_NOT_ENABLED', 400);
  }
}

/**
 * Error thrown when MFA is already enabled
 */
export class MfaAlreadyEnabledError extends AppError {
  public override readonly name = 'MfaAlreadyEnabledError';

  constructor(message = 'MFA is already enabled') {
    super(message, 'MFA_ALREADY_ENABLED', 409);
  }
}

/**
 * Error thrown when MFA code is invalid
 */
export class InvalidMfaCodeError extends AppError {
  public override readonly name = 'InvalidMfaCodeError';

  constructor(message = 'Invalid MFA code') {
    super(message, 'INVALID_MFA_CODE', 401);
  }
}

/**
 * Error thrown when MFA setup is incomplete or not started
 */
export class MfaSetupIncompleteError extends AppError {
  public override readonly name = 'MfaSetupIncompleteError';

  constructor(message = 'MFA setup not initiated or expired') {
    super(message, 'MFA_SETUP_INCOMPLETE', 400);
  }
}

/**
 * Error thrown when MFA challenge has expired
 */
export class MfaChallengeExpiredError extends AppError {
  public override readonly name = 'MfaChallengeExpiredError';

  constructor(message = 'MFA challenge expired') {
    super(message, 'MFA_CHALLENGE_EXPIRED', 410);
  }
}

/**
 * Error thrown when max MFA attempts exceeded
 */
export class MfaMaxAttemptsExceededError extends AppError {
  public override readonly name = 'MfaMaxAttemptsExceededError';

  constructor(message = 'Maximum MFA attempts exceeded') {
    super(message, 'MFA_MAX_ATTEMPTS_EXCEEDED', 429);
  }
}

/**
 * Error thrown when all recovery codes have been used
 */
export class RecoveryCodesExhaustedError extends AppError {
  public override readonly name = 'RecoveryCodesExhaustedError';

  constructor(message = 'All recovery codes have been used') {
    super(message, 'RECOVERY_CODES_EXHAUSTED', 400);
  }
}

/**
 * Error thrown when phone number is not verified
 */
export class PhoneNotVerifiedError extends AppError {
  public override readonly name = 'PhoneNotVerifiedError';

  constructor(message = 'Phone number not verified') {
    super(message, 'PHONE_NOT_VERIFIED', 400);
  }
}

/**
 * Error thrown when MFA is required for the operation
 */
export class MfaRequiredError extends AppError {
  public override readonly name = 'MfaRequiredError';

  constructor(
    public readonly pendingSessionId: string,
    public readonly availableMethods: string[],
    message = 'MFA verification required'
  ) {
    super(message, 'MFA_REQUIRED', 401, { pendingSessionId, availableMethods });
  }
}

/**
 * Error thrown when step-up authentication is required
 */
export class StepUpAuthRequiredError extends AppError {
  public override readonly name = 'StepUpAuthRequiredError';

  constructor(
    public readonly operation: string,
    message = 'Step-up authentication required'
  ) {
    super(message, 'STEP_UP_AUTH_REQUIRED', 401, { operation });
  }
}

// =============================================================================
// PROFILE ERRORS
// =============================================================================

/**
 * Error thrown when profile is not found
 */
export class ProfileNotFoundError extends AppError {
  public override readonly name = 'ProfileNotFoundError';

  constructor(identifier: string) {
    super(`Profile not found: ${identifier}`, 'PROFILE_NOT_FOUND', 404);
  }
}

/**
 * Error thrown when username is not available
 */
export class UsernameNotAvailableError extends AppError {
  public override readonly name = 'UsernameNotAvailableError';

  constructor(username: string) {
    super(`Username "${username}" is not available`, 'USERNAME_NOT_AVAILABLE', 409);
  }
}

/**
 * Error thrown when username format is invalid
 */
export class InvalidUsernameError extends AppError {
  public override readonly name = 'InvalidUsernameError';

  constructor(message = 'Invalid username format') {
    super(message, 'INVALID_USERNAME', 400);
  }
}

/**
 * Error thrown when file type is invalid
 */
export class InvalidFileTypeError extends AppError {
  public override readonly name = 'InvalidFileTypeError';

  constructor(message = 'Invalid file type') {
    super(message, 'INVALID_FILE_TYPE', 400);
  }
}

/**
 * Error thrown when file is too large
 */
export class FileTooLargeError extends AppError {
  public override readonly name = 'FileTooLargeError';

  constructor(message = 'File too large') {
    super(message, 'FILE_TOO_LARGE', 413);
  }
}

/**
 * Error thrown when image processing fails
 */
export class ImageProcessingError extends AppError {
  public override readonly name = 'ImageProcessingError';

  constructor(message = 'Image processing failed') {
    super(message, 'IMAGE_PROCESSING_ERROR', 500);
  }
}

/**
 * Error thrown when skill is not found
 */
export class SkillNotFoundError extends AppError {
  public override readonly name = 'SkillNotFoundError';

  constructor(identifier: string) {
    super(`Skill not found: ${identifier}`, 'SKILL_NOT_FOUND', 404);
  }
}

/**
 * Error thrown when skill already exists
 */
export class SkillAlreadyExistsError extends AppError {
  public override readonly name = 'SkillAlreadyExistsError';

  constructor(name: string) {
    super(`Skill "${name}" already exists`, 'SKILL_ALREADY_EXISTS', 409);
  }
}

/**
 * Error thrown when max skills limit is exceeded
 */
export class MaxSkillsExceededError extends AppError {
  public override readonly name = 'MaxSkillsExceededError';

  constructor(maxSkills: number) {
    super(`Maximum of ${maxSkills} skills allowed`, 'MAX_SKILLS_EXCEEDED', 400);
  }
}
