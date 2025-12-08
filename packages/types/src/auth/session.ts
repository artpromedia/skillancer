/**
 * @skillancer/types - Auth: Session Types
 * Authentication session and token schemas
 */

import { z } from 'zod';

import { uuidSchema, dateSchema } from '../common/base';

// =============================================================================
// Auth Tokens
// =============================================================================

/**
 * JWT token pair response
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal('Bearer'),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

/**
 * Decoded JWT payload
 */
export const jwtPayloadSchema = z.object({
  sub: uuidSchema, // User ID
  email: z.string().email(),
  roles: z.array(z.string()),
  tenantId: uuidSchema.optional(),
  sessionId: uuidSchema.optional(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

// =============================================================================
// Session
// =============================================================================

/**
 * Device information for session tracking
 */
export const deviceInfoSchema = z.object({
  userAgent: z.string(),
  ip: z.string(),
  platform: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  device: z.string().optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
});
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

/**
 * Session status
 */
export const sessionStatusSchema = z.enum([
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

/**
 * User session schema
 */
export const sessionSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),
  status: sessionStatusSchema,
  deviceInfo: deviceInfoSchema,
  refreshToken: z.string().optional(),
  lastActivityAt: dateSchema,
  createdAt: dateSchema,
  expiresAt: dateSchema,
  revokedAt: dateSchema.optional(),
  revokedBy: uuidSchema.optional(),
  revokedReason: z.string().optional(),
});
export type Session = z.infer<typeof sessionSchema>;

// =============================================================================
// Login/Logout Schemas
// =============================================================================

/**
 * Login with email/password
 */
export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
  tenantSlug: z.string().optional(),
});
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

/**
 * Login response
 */
export const loginResponseSchema = z.object({
  user: z.object({
    id: uuidSchema,
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    roles: z.array(z.string()),
  }),
  tokens: authTokensSchema,
  session: sessionSchema.pick({
    id: true,
    expiresAt: true,
  }),
  mfaRequired: z.boolean().default(false),
  mfaToken: z.string().optional(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Refresh token request
 */
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

/**
 * Logout request
 */
export const logoutRequestSchema = z.object({
  sessionId: uuidSchema.optional(),
  allSessions: z.boolean().default(false),
});
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

// =============================================================================
// MFA
// =============================================================================

/**
 * MFA method types
 */
export const mfaMethodSchema = z.enum([
  'TOTP',
  'SMS',
  'EMAIL',
  'BACKUP_CODE',
]);
export type MFAMethod = z.infer<typeof mfaMethodSchema>;

/**
 * MFA setup response
 */
export const mfaSetupResponseSchema = z.object({
  method: mfaMethodSchema,
  secret: z.string().optional(), // For TOTP
  qrCodeUrl: z.string().optional(), // For TOTP
  backupCodes: z.array(z.string()).optional(),
});
export type MFASetupResponse = z.infer<typeof mfaSetupResponseSchema>;

/**
 * MFA verification request
 */
export const mfaVerifyRequestSchema = z.object({
  mfaToken: z.string(),
  code: z.string().min(6).max(8),
  method: mfaMethodSchema.optional(),
});
export type MFAVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;

// =============================================================================
// Password Reset
// =============================================================================

/**
 * Request password reset
 */
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

/**
 * Confirm password reset
 */
export const passwordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

// =============================================================================
// Email Verification
// =============================================================================

/**
 * Email verification request
 */
export const emailVerificationRequestSchema = z.object({
  email: z.string().email(),
});
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;

/**
 * Email verification confirm
 */
export const emailVerificationConfirmSchema = z.object({
  token: z.string(),
});
export type EmailVerificationConfirm = z.infer<typeof emailVerificationConfirmSchema>;
