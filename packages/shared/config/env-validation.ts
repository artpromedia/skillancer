/**
 * Environment variable validation for Skillancer services.
 * Ensures all required secrets and configuration are set before startup.
 *
 * Usage:
 *   import { validateAndExit } from '@skillancer/shared-config/env-validation';
 *   validateAndExit('auth');
 */

// =============================================================================
// Types
// =============================================================================

export interface EnvRequirement {
  name: string;
  required: boolean;
  minLength?: number;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ServiceName =
  | 'auth'
  | 'api-gateway'
  | 'market'
  | 'billing'
  | 'notification'
  | 'common';

export interface ValidateOptions {
  /** When true, treat all missing optional vars as errors. Defaults to true in production. */
  strict?: boolean;
}

// =============================================================================
// Requirement Definitions
// =============================================================================

const COMMON_REQUIREMENTS: EnvRequirement[] = [
  { name: 'NODE_ENV', required: true, description: 'Application environment' },
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
];

const AUTH_REQUIREMENTS: EnvRequirement[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret' },
  { name: 'ENCRYPTION_KEY', required: false, minLength: 32, description: 'Data encryption key' },
  { name: 'MFA_ENCRYPTION_KEY', required: false, minLength: 32, description: 'MFA TOTP encryption key' },
  { name: 'BCRYPT_ROUNDS', required: false, description: 'Bcrypt hashing rounds' },
];

const GATEWAY_REQUIREMENTS: EnvRequirement[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection URL for rate limiting' },
];

const MARKET_REQUIREMENTS: EnvRequirement[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection URL for caching' },
];

const BILLING_REQUIREMENTS: EnvRequirement[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret' },
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe API secret key' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook signing secret' },
];

const NOTIFICATION_REQUIREMENTS: EnvRequirement[] = [
  { name: 'JWT_SECRET', required: true, minLength: 32, description: 'JWT signing secret' },
  { name: 'SENDGRID_API_KEY', required: true, description: 'SendGrid API key' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection URL for email queue' },
];

const INTEGRATION_REQUIREMENTS: EnvRequirement[] = [
  { name: 'STRIPE_SECRET_KEY', required: false, description: 'Stripe API secret key' },
  { name: 'SENDGRID_API_KEY', required: false, description: 'SendGrid API key' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection URL' },
];

// =============================================================================
// Requirement Mapping
// =============================================================================

const SERVICE_REQUIREMENTS: Record<ServiceName, EnvRequirement[]> = {
  auth: [...COMMON_REQUIREMENTS, ...AUTH_REQUIREMENTS],
  'api-gateway': [...COMMON_REQUIREMENTS, ...GATEWAY_REQUIREMENTS],
  market: [...COMMON_REQUIREMENTS, ...MARKET_REQUIREMENTS],
  billing: [...COMMON_REQUIREMENTS, ...BILLING_REQUIREMENTS],
  notification: [...COMMON_REQUIREMENTS, ...NOTIFICATION_REQUIREMENTS],
  common: [...COMMON_REQUIREMENTS, ...INTEGRATION_REQUIREMENTS],
};

// =============================================================================
// Validation Logic
// =============================================================================

/**
 * Deduplicate requirements by variable name, keeping the stricter definition
 * (required wins over optional, larger minLength wins).
 */
function deduplicateRequirements(requirements: EnvRequirement[]): EnvRequirement[] {
  const seen = new Map<string, EnvRequirement>();

  for (const req of requirements) {
    const existing = seen.get(req.name);
    if (!existing) {
      seen.set(req.name, { ...req });
      continue;
    }
    // Merge: required wins, larger minLength wins
    if (req.required) {
      existing.required = true;
    }
    if (req.minLength !== undefined) {
      existing.minLength = Math.max(existing.minLength ?? 0, req.minLength);
    }
  }

  return Array.from(seen.values());
}

/**
 * Validate a single environment variable against its requirement.
 */
function validateSingle(
  req: EnvRequirement,
  strict: boolean
): { error?: string; warning?: string } {
  const value = process.env[req.name];

  if (!value || value.trim() === '') {
    if (req.required) {
      return { error: `Missing required env var ${req.name}: ${req.description}` };
    }
    if (strict) {
      return { warning: `Missing optional env var ${req.name}: ${req.description}` };
    }
    return {};
  }

  if (req.minLength !== undefined && value.length < req.minLength) {
    const message =
      `Env var ${req.name} is too short (${value.length} chars, minimum ${req.minLength}): ${req.description}`;
    if (req.required) {
      return { error: message };
    }
    return { warning: message };
  }

  return {};
}

/**
 * Validate that all required environment variables are set for the given service.
 *
 * @param service - The service being validated.
 * @param options - Validation options. `strict` defaults to `true` when NODE_ENV is 'production'.
 * @returns An object with `valid`, `errors`, and `warnings` arrays.
 *
 * @example
 * ```ts
 * const result = validateEnvironment('auth');
 * if (!result.valid) {
 *   console.error('Startup blocked:', result.errors);
 *   process.exit(1);
 * }
 * ```
 */
export function validateEnvironment(
  service: ServiceName,
  options?: ValidateOptions
): ValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const strict = options?.strict ?? isProduction;

  const requirements = deduplicateRequirements(SERVICE_REQUIREMENTS[service]);
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    const result = validateSingle(req, strict);
    if (result.error) {
      errors.push(result.error);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment variables and exit the process if validation fails in production.
 * In development, missing required variables still cause an exit; optional variables
 * produce warnings that are logged but do not block startup.
 *
 * @param service - The service being validated.
 *
 * @example
 * ```ts
 * // At the top of your service entrypoint:
 * import { validateAndExit } from '@skillancer/shared-config/env-validation';
 * validateAndExit('billing');
 * ```
 */
export function validateAndExit(service: ServiceName): void {
  const result = validateEnvironment(service);

  const label = `[env-validation:${service}]`;

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`${label} WARNING: ${warning}`);
    }
  }

  if (!result.valid) {
    console.error(`${label} Environment validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`${label}   - ${error}`);
    }
    console.error(`${label} Fix the above errors and restart the service.`);
    process.exit(1);
  }

  if (result.warnings.length === 0) {
    console.log(`${label} All environment variables validated successfully.`);
  } else {
    console.log(
      `${label} Environment validated with ${result.warnings.length} warning(s). Service starting.`
    );
  }
}

/**
 * Get the list of requirements for a given service, useful for documentation or tooling.
 */
export function getServiceRequirements(service: ServiceName): EnvRequirement[] {
  return deduplicateRequirements(SERVICE_REQUIREMENTS[service]);
}
