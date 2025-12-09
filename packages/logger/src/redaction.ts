/**
 * Sensitive field redaction configuration
 *
 * Defines which fields should be automatically redacted from logs
 * to prevent accidental exposure of sensitive data.
 */

/**
 * Default list of sensitive fields to redact
 */
export const SENSITIVE_FIELDS = [
  // Authentication
  'password',
  'passwordHash',
  'passwordConfirmation',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'sessionToken',
  'bearerToken',
  'jwt',
  'apiKey',
  'apiSecret',
  'secret',
  'secretKey',
  'privateKey',
  'publicKey',

  // Authorization headers
  'authorization',
  'x-api-key',
  'x-auth-token',
  'x-access-token',

  // Personal identifiable information
  'ssn',
  'socialSecurityNumber',
  'taxId',
  'nationalId',
  'passport',
  'passportNumber',
  'driverLicense',
  'driversLicense',

  // Financial information
  'creditCard',
  'creditCardNumber',
  'cardNumber',
  'cvv',
  'cvc',
  'cvv2',
  'securityCode',
  'expirationDate',
  'expiryDate',
  'bankAccount',
  'bankAccountNumber',
  'routingNumber',
  'iban',
  'swift',
  'bic',

  // Personal contact (consider if needed)
  'phoneNumber',
  'phone',
  'mobile',
  'mobileNumber',

  // Cookies and sessions
  'cookie',
  'cookies',
  'sessionId',
  'session',

  // AWS specific
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'awsSessionToken',

  // Database credentials
  'databaseUrl',
  'dbPassword',
  'databasePassword',
  'connectionString',

  // Encryption
  'encryptionKey',
  'decryptionKey',
  'salt',
  'iv',
  'nonce',

  // OAuth
  'clientSecret',
  'client_secret',
  'code_verifier',
  'codeVerifier',

  // Two-factor authentication
  'otp',
  'otpCode',
  'totp',
  'totpSecret',
  'twoFactorCode',
  'recoveryCode',
  'backupCode',
];

/**
 * Create redaction paths for Pino
 *
 * Generates all possible paths where sensitive data might appear,
 * including nested object paths and array access patterns.
 *
 * @param fields - List of sensitive field names
 * @returns Array of redaction path patterns
 */
export function createRedactPaths(fields: string[]): string[] {
  const paths: string[] = [];

  for (const field of fields) {
    // Direct field access
    paths.push(field);

    // Common nested patterns
    paths.push(`*.${field}`);
    paths.push(`*.*.${field}`);
    paths.push(`*.*.*. ${field}`);

    // Request/response body patterns
    paths.push(`body.${field}`);
    paths.push(`body.*.${field}`);
    paths.push(`data.${field}`);
    paths.push(`data.*.${field}`);

    // Headers
    paths.push(`headers.${field}`);
    paths.push(`headers["${field}"]`);

    // User/account patterns
    paths.push(`user.${field}`);
    paths.push(`account.${field}`);
    paths.push(`profile.${field}`);
    paths.push(`credentials.${field}`);

    // Request patterns
    paths.push(`request.${field}`);
    paths.push(`request.body.${field}`);
    paths.push(`request.headers.${field}`);

    // Response patterns
    paths.push(`response.${field}`);
    paths.push(`response.body.${field}`);

    // Array access patterns
    paths.push(`[*].${field}`);
    paths.push(`*.[ *].${field}`);
  }

  // Remove duplicates
  return [...new Set(paths)];
}

/**
 * Check if a string contains any sensitive patterns
 *
 * @param value - String to check
 * @returns True if the string appears to contain sensitive data
 */
export function containsSensitivePattern(value: string): boolean {
  const lowerValue = value.toLowerCase();

  // Check for credit card patterns (basic check)
  const creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
  if (creditCardPattern.test(value)) {
    return true;
  }

  // Check for SSN patterns
  const ssnPattern = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/;
  if (ssnPattern.test(value)) {
    return true;
  }

  // Check for JWT tokens
  if (value.startsWith('eyJ') && value.includes('.')) {
    return true;
  }

  // Check for API key patterns
  const apiKeyPatterns = [/^sk_[a-zA-Z0-9]+/, /^pk_[a-zA-Z0-9]+/, /^key_[a-zA-Z0-9]+/];
  if (apiKeyPatterns.some((pattern) => pattern.test(value))) {
    return true;
  }

  // Check for field name indicators
  const sensitiveIndicators = ['password', 'secret', 'token', 'key', 'auth'];
  return sensitiveIndicators.some((indicator) => lowerValue.includes(indicator));
}
