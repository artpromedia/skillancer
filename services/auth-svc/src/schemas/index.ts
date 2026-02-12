/**
 * @module @skillancer/auth-svc/schemas
 * Zod validation schemas for auth endpoints
 */

import { z } from 'zod';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * UUID schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Email schema with lowercase transformation
 * Note: trim() first, then validate email, then lowercase
 */
export const emailSchema = z.string().trim().email().toLowerCase();

/**
 * Password schema with strength requirements
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[@$!%*?&#^()_+=[\]{}|\\:";'<>,./-]/,
    'Password must contain at least one special character'
  );

// =============================================================================
// REGISTRATION SCHEMAS
// =============================================================================

/**
 * Registration request schema
 */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  displayName: z.string().max(200).trim().optional(),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * Registration response schema
 */
export const registerResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  user: z.object({
    id: uuidSchema,
    email: emailSchema,
    firstName: z.string(),
    lastName: z.string(),
    status: z.string(),
  }),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

// =============================================================================
// LOGIN SCHEMAS
// =============================================================================

/**
 * Login request schema
 */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Login response schema
 */
export const loginResponseSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    status: z.string(),
    verificationLevel: z.string(),
  }),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
    tokenType: z.literal('Bearer'),
  }),
  session: z.object({
    id: uuidSchema,
    expiresAt: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// =============================================================================
// TOKEN SCHEMAS
// =============================================================================

/**
 * Refresh token request schema
 */
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

/**
 * Refresh token response schema
 */
export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;

// =============================================================================
// LOGOUT SCHEMAS
// =============================================================================

/**
 * Logout request schema
 */
export const logoutRequestSchema = z.object({
  sessionId: uuidSchema.optional(),
  allSessions: z.boolean().default(false),
});

export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

/**
 * Logout response schema
 */
export const logoutResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

// =============================================================================
// PASSWORD RESET SCHEMAS
// =============================================================================

/**
 * Forgot password request schema
 */
export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

/**
 * Forgot password response schema
 */
export const forgotPasswordResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

/**
 * Reset password request schema
 */
export const resetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/**
 * Reset password response schema
 */
export const resetPasswordResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

// =============================================================================
// EMAIL VERIFICATION SCHEMAS
// =============================================================================

/**
 * Verify email request (from URL params)
 */
export const verifyEmailParamsSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailParams = z.infer<typeof verifyEmailParamsSchema>;

/**
 * Verify email response schema
 */
export const verifyEmailResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  user: z.object({
    id: uuidSchema,
    email: z.string(),
    status: z.string(),
    verificationLevel: z.string(),
  }),
});

export type VerifyEmailResponse = z.infer<typeof verifyEmailResponseSchema>;

/**
 * Resend verification email request
 */
export const resendVerificationRequestSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

// =============================================================================
// OAUTH SCHEMAS
// =============================================================================

/**
 * OAuth callback query params schema
 */
export const oauthCallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

/**
 * Apple OAuth callback body schema (Apple sends POST)
 */
export const appleCallbackBodySchema = z.object({
  code: z.string(),
  id_token: z.string().optional(),
  state: z.string().optional(),
  user: z.string().optional(), // JSON string with user info on first auth
});

export type AppleCallbackBody = z.infer<typeof appleCallbackBodySchema>;

/**
 * OAuth state schema (stored in Redis)
 */
export const oauthStateSchema = z.object({
  provider: z.enum(['google', 'microsoft', 'apple', 'facebook', 'linkedin']),
  redirectUrl: z.string().optional(),
  createdAt: z.number(),
});

export type OAuthState = z.infer<typeof oauthStateSchema>;

// =============================================================================
// JWT PAYLOAD SCHEMAS
// =============================================================================

/**
 * Access token payload schema
 */
export const accessTokenPayloadSchema = z.object({
  sub: uuidSchema, // User ID
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(z.string()),
  sessionId: uuidSchema,
  verificationLevel: z.string(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

/**
 * Refresh token payload schema
 */
export const refreshTokenPayloadSchema = z.object({
  sub: uuidSchema, // User ID
  sessionId: uuidSchema,
  tokenId: uuidSchema, // Unique token identifier
  iat: z.number(),
  exp: z.number(),
  type: z.literal('refresh'),
});

export type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;

// =============================================================================
// ERROR RESPONSE SCHEMA
// =============================================================================

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// =============================================================================
// DEVICE INFO SCHEMA
// =============================================================================

/**
 * Device info schema for session tracking
 * Must align with @skillancer/cache DeviceInfo
 */
export const deviceInfoSchema = z.object({
  userAgent: z.string(),
  ip: z.string(),
  deviceType: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
