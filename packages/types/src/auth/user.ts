/**
 * @skillancer/types - Auth: User Types
 * User-related schemas and types
 */

import { z } from 'zod';

import {
  uuidSchema,
  emailSchema,
  dateSchema,
  urlSchema,
  phoneSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// User Enums
// =============================================================================

/**
 * User account status
 */
export const userStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
  'DEACTIVATED',
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

/**
 * User verification level
 */
export const verificationLevelSchema = z.enum([
  'NONE',
  'EMAIL',
  'BASIC',
  'ENHANCED',
  'PREMIUM',
]);
export type VerificationLevel = z.infer<typeof verificationLevelSchema>;

/**
 * User roles in the system
 */
export const userRoleSchema = z.enum([
  'USER',
  'FREELANCER',
  'CLIENT',
  'ADMIN',
  'SUPER_ADMIN',
]);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * OAuth provider types
 */
export const oauthProviderSchema = z.enum([
  'GOOGLE',
  'GITHUB',
  'LINKEDIN',
  'MICROSOFT',
]);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

// =============================================================================
// User Profile
// =============================================================================

/**
 * User profile settings
 */
export const userProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  headline: z.string().max(200).optional(),
  website: urlSchema.optional(),
  location: z.string().max(100).optional(),
  skills: z.array(z.string()).max(50).optional(),
  hourlyRate: z.number().positive().optional(),
  availability: z.enum(['FULL_TIME', 'PART_TIME', 'NOT_AVAILABLE']).optional(),
  yearsOfExperience: z.number().int().nonnegative().optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * User notification preferences
 */
export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
  jobAlerts: z.boolean().default(true),
  messageNotifications: z.boolean().default(true),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

// =============================================================================
// User Schema
// =============================================================================

/**
 * Complete user schema
 */
export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(200).optional(),
  avatarUrl: urlSchema.optional(),
  phone: phoneSchema.optional(),
  status: userStatusSchema,
  verificationLevel: verificationLevelSchema,
  roles: z.array(userRoleSchema).min(1),
  tenantId: uuidSchema.optional(),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en'),
  profile: userProfileSchema.optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  lastLoginAt: dateSchema.optional(),
  emailVerifiedAt: dateSchema.optional(),
  phoneVerifiedAt: dateSchema.optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type User = z.infer<typeof userSchema>;

/**
 * Public user data (safe to expose)
 */
export const publicUserSchema = userSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatarUrl: true,
  verificationLevel: true,
  profile: true,
  createdAt: true,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

// =============================================================================
// User CRUD Schemas
// =============================================================================

/**
 * Password validation schema
 * Requires: 12+ chars, uppercase, lowercase, number, special char
 */
export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number, and special character'
  );

/**
 * Create user input schema
 */
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  displayName: z.string().max(200).optional(),
  phone: phoneSchema.optional(),
  roles: z.array(userRoleSchema).min(1).default(['USER']),
  tenantId: uuidSchema.optional(),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en'),
});
export type CreateUser = z.infer<typeof createUserSchema>;

/**
 * Update user input schema
 */
export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  displayName: z.string().max(200).optional(),
  avatarUrl: urlSchema.optional(),
  phone: phoneSchema.optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  profile: userProfileSchema.optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
});
export type UpdateUser = z.infer<typeof updateUserSchema>;

/**
 * Change password input schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
export type ChangePassword = z.infer<typeof changePasswordSchema>;

// =============================================================================
// OAuth Account
// =============================================================================

/**
 * OAuth connected account
 */
export const oauthAccountSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  provider: oauthProviderSchema,
  providerAccountId: z.string(),
  email: emailSchema.optional(),
  name: z.string().optional(),
  avatarUrl: urlSchema.optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: dateSchema.optional(),
  ...timestampsSchema.shape,
});
export type OAuthAccount = z.infer<typeof oauthAccountSchema>;
