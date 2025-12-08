/**
 * @skillancer/types - Auth: Tenant Types
 * Multi-tenant organization schemas
 */

import { z } from 'zod';

import {
  uuidSchema,
  emailSchema,
  dateSchema,
  urlSchema,
  slugSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Tenant Enums
// =============================================================================

/**
 * Tenant subscription plan
 */
export const tenantPlanSchema = z.enum([
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
]);
export type TenantPlan = z.infer<typeof tenantPlanSchema>;

/**
 * Tenant status
 */
export const tenantStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'PENDING',
  'CANCELLED',
]);
export type TenantStatus = z.infer<typeof tenantStatusSchema>;

// =============================================================================
// Tenant Settings
// =============================================================================

/**
 * Tenant security settings
 */
export const tenantSecuritySettingsSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  ssoEnabled: z.boolean().default(false),
  ssoProvider: z.string().optional(),
  ssoConfigUrl: urlSchema.optional(),
  mfaRequired: z.boolean().default(false),
  mfaGracePeriodDays: z.number().int().nonnegative().default(7),
  passwordPolicy: z.object({
    minLength: z.number().int().min(8).default(12),
    requireUppercase: z.boolean().default(true),
    requireLowercase: z.boolean().default(true),
    requireNumbers: z.boolean().default(true),
    requireSpecialChars: z.boolean().default(true),
    maxAgeDays: z.number().int().positive().optional(),
    preventReuse: z.number().int().nonnegative().default(5),
  }).optional(),
  sessionTimeoutMinutes: z.number().int().positive().default(480),
  ipWhitelist: z.array(z.string()).optional(),
});
export type TenantSecuritySettings = z.infer<typeof tenantSecuritySettingsSchema>;

/**
 * Tenant branding settings
 */
export const tenantBrandingSettingsSchema = z.object({
  logoUrl: urlSchema.optional(),
  faviconUrl: urlSchema.optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customCss: z.string().max(10000).optional(),
});
export type TenantBrandingSettings = z.infer<typeof tenantBrandingSettingsSchema>;

/**
 * Tenant feature flags
 */
export const tenantFeaturesSchema = z.object({
  skillpodEnabled: z.boolean().default(true),
  marketEnabled: z.boolean().default(true),
  cockpitEnabled: z.boolean().default(true),
  billingEnabled: z.boolean().default(true),
  apiAccess: z.boolean().default(false),
  customIntegrations: z.boolean().default(false),
  advancedAnalytics: z.boolean().default(false),
  whiteLabeling: z.boolean().default(false),
});
export type TenantFeatures = z.infer<typeof tenantFeaturesSchema>;

// =============================================================================
// Tenant Schema
// =============================================================================

/**
 * Tenant limits based on plan
 */
export const tenantLimitsSchema = z.object({
  maxUsers: z.number().int().positive(),
  maxStorage: z.number().int().positive(), // in bytes
  maxPods: z.number().int().nonnegative(),
  maxConcurrentSessions: z.number().int().nonnegative(),
  maxProjects: z.number().int().nonnegative(),
  maxApiCalls: z.number().int().nonnegative(), // per month
});
export type TenantLimits = z.infer<typeof tenantLimitsSchema>;

/**
 * Complete tenant schema
 */
export const tenantSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  slug: slugSchema,
  status: tenantStatusSchema,
  plan: tenantPlanSchema,
  ownerUserId: uuidSchema,
  billingEmail: emailSchema.optional(),
  settings: z.object({
    security: tenantSecuritySettingsSchema.optional(),
    branding: tenantBrandingSettingsSchema.optional(),
    features: tenantFeaturesSchema.optional(),
  }).optional(),
  limits: tenantLimitsSchema.optional(),
  trialEndsAt: dateSchema.optional(),
  subscriptionId: z.string().optional(),
  ...timestampsSchema.shape,
});
export type Tenant = z.infer<typeof tenantSchema>;

// =============================================================================
// Tenant CRUD Schemas
// =============================================================================

/**
 * Create tenant input
 */
export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  plan: tenantPlanSchema.default('FREE'),
  ownerUserId: uuidSchema,
  billingEmail: emailSchema.optional(),
  settings: z.object({
    security: tenantSecuritySettingsSchema.optional(),
    branding: tenantBrandingSettingsSchema.optional(),
    features: tenantFeaturesSchema.optional(),
  }).optional(),
});
export type CreateTenant = z.infer<typeof createTenantSchema>;

/**
 * Update tenant input
 */
export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  billingEmail: emailSchema.optional(),
  settings: z.object({
    security: tenantSecuritySettingsSchema.optional(),
    branding: tenantBrandingSettingsSchema.optional(),
    features: tenantFeaturesSchema.optional(),
  }).optional(),
});
export type UpdateTenant = z.infer<typeof updateTenantSchema>;

// =============================================================================
// Tenant Member
// =============================================================================

/**
 * Tenant member role
 */
export const tenantMemberRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
]);
export type TenantMemberRole = z.infer<typeof tenantMemberRoleSchema>;

/**
 * Tenant member schema
 */
export const tenantMemberSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  userId: uuidSchema,
  role: tenantMemberRoleSchema,
  invitedBy: uuidSchema.optional(),
  invitedAt: dateSchema.optional(),
  joinedAt: dateSchema,
  ...timestampsSchema.shape,
});
export type TenantMember = z.infer<typeof tenantMemberSchema>;

/**
 * Invite tenant member input
 */
export const inviteTenantMemberSchema = z.object({
  email: emailSchema,
  role: tenantMemberRoleSchema.default('MEMBER'),
  message: z.string().max(500).optional(),
});
export type InviteTenantMember = z.infer<typeof inviteTenantMemberSchema>;
