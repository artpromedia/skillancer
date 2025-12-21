/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @skillancer/types - Market: Service Types
 * Productized service listing schemas for freelancer offerings
 */

import { z } from 'zod';

import { experienceLevelSchema } from './job';
import { uuidSchema, dateSchema, currencyCodeSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Service Enums
// =============================================================================

/**
 * Service status
 */
export const serviceStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'REJECTED',
]);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

/**
 * Service category (main categories)
 */
export const serviceCategorySchema = z.enum([
  'DEVELOPMENT',
  'DESIGN',
  'WRITING',
  'MARKETING',
  'VIDEO_ANIMATION',
  'MUSIC_AUDIO',
  'BUSINESS',
  'CONSULTING',
  'AI_ML',
  'DATA',
  'OTHER',
]);
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;

/**
 * Delivery time presets
 */
export const deliveryTimeSchema = z.enum([
  'EXPRESS_24H',
  '1_DAY',
  '2_DAYS',
  '3_DAYS',
  '5_DAYS',
  '7_DAYS',
  '14_DAYS',
  '21_DAYS',
  '30_DAYS',
  'CUSTOM',
]);
export type DeliveryTime = z.infer<typeof deliveryTimeSchema>;

// =============================================================================
// Service Sub-schemas
// =============================================================================

/**
 * Service package/tier (Basic, Standard, Premium)
 */
export const serviceTierSchema = z.object({
  id: uuidSchema,
  name: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'CUSTOM']),
  title: z.string().min(1).max(100),
  description: z.string().max(1000),
  price: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),

  // Delivery
  deliveryTime: deliveryTimeSchema,
  deliveryDays: z.number().int().positive(),

  // Inclusions
  features: z.array(
    z.object({
      name: z.string(),
      included: z.boolean(),
      quantity: z.number().int().nonnegative().optional(),
    })
  ),

  // Revisions
  revisions: z.number().int().nonnegative(), // -1 for unlimited

  // Source files
  sourceFilesIncluded: z.boolean().default(false),

  // Commercial use
  commercialUseIncluded: z.boolean().default(true),
});
export type ServiceTier = z.infer<typeof serviceTierSchema>;

/**
 * Service FAQ item
 */
export const serviceFaqSchema = z.object({
  id: uuidSchema,
  question: z.string().max(500),
  answer: z.string().max(2000),
  order: z.number().int().nonnegative(),
});
export type ServiceFaq = z.infer<typeof serviceFaqSchema>;

/**
 * Service add-on/extra
 */
export const serviceAddonSchema = z.object({
  id: uuidSchema,
  name: z.string().max(100),
  description: z.string().max(500),
  price: z.number().positive(),
  deliveryDaysAdd: z.number().int().nonnegative().default(0),
  maxQuantity: z.number().int().positive().default(1),
});
export type ServiceAddon = z.infer<typeof serviceAddonSchema>;

/**
 * Service requirement (info needed from buyer)
 */
export const serviceRequirementSchema = z.object({
  id: uuidSchema,
  question: z.string().max(500),
  type: z.enum(['TEXT', 'TEXTAREA', 'FILE', 'MULTIPLE_CHOICE']),
  options: z.array(z.string()).optional(), // For multiple choice
  required: z.boolean().default(true),
  order: z.number().int().nonnegative(),
});
export type ServiceRequirement = z.infer<typeof serviceRequirementSchema>;

// =============================================================================
// Main Service Schema
// =============================================================================

/**
 * Complete service listing schema
 */
export const serviceSchema = z.object({
  id: uuidSchema,
  freelancerUserId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Basic info
  title: z.string().min(10).max(100),
  slug: z.string().min(1).max(150),
  tagline: z.string().max(200).optional(),
  description: z.string().min(100).max(5000),

  // Categorization
  category: serviceCategorySchema,
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10),

  // Skills & expertise
  skills: z
    .array(
      z.object({
        skillId: uuidSchema,
        skillName: z.string(),
      })
    )
    .max(15),

  experienceLevel: experienceLevelSchema,

  // Media
  images: z
    .array(
      z.object({
        id: uuidSchema,
        url: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        isPrimary: z.boolean().default(false),
        order: z.number().int().nonnegative(),
      })
    )
    .max(10),

  videos: z
    .array(
      z.object({
        id: uuidSchema,
        url: z.string().url(),
        thumbnailUrl: z.string().url().optional(),
        durationSeconds: z.number().int().positive().optional(),
      })
    )
    .max(3)
    .optional(),

  // Portfolio samples
  portfolioItems: z.array(uuidSchema).max(20).optional(),

  // Packages
  tiers: z.array(serviceTierSchema).min(1).max(4),

  // Extras/add-ons
  addons: z.array(serviceAddonSchema).max(10).optional(),

  // Requirements
  requirements: z.array(serviceRequirementSchema).max(10).optional(),

  // FAQ
  faqs: z.array(serviceFaqSchema).max(10).optional(),

  // Status
  status: serviceStatusSchema,
  rejectionReason: z.string().max(500).optional(),

  // Stats
  totalOrders: z.number().int().nonnegative().default(0),
  completedOrders: z.number().int().nonnegative().default(0),
  cancelledOrders: z.number().int().nonnegative().default(0),
  averageRating: z.number().min(0).max(5).optional(),
  totalReviews: z.number().int().nonnegative().default(0),
  responseTimeHours: z.number().nonnegative().optional(),

  // Visibility
  isPublic: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPausedByAdmin: z.boolean().default(false),

  // SkillPod integration
  skillpodAvailable: z.boolean().default(false),
  skillpodRecommended: z.boolean().default(false),

  ...timestampsSchema.shape,
});
export type Service = z.infer<typeof serviceSchema>;

// =============================================================================
// Service CRUD Schemas
// =============================================================================

/**
 * Create service input
 */
export const createServiceSchema = z.object({
  title: z.string().min(10).max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().min(100).max(5000),
  category: serviceCategorySchema,
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10),
  skills: z
    .array(
      z.object({
        skillId: uuidSchema,
        skillName: z.string(),
      })
    )
    .max(15),
  experienceLevel: experienceLevelSchema,
  tiers: z
    .array(serviceTierSchema.omit({ id: true }))
    .min(1)
    .max(4),
  addons: z
    .array(serviceAddonSchema.omit({ id: true }))
    .max(10)
    .optional(),
  requirements: z
    .array(serviceRequirementSchema.omit({ id: true }))
    .max(10)
    .optional(),
  faqs: z
    .array(serviceFaqSchema.omit({ id: true }))
    .max(10)
    .optional(),
  skillpodAvailable: z.boolean().default(false),
  skillpodRecommended: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PENDING_REVIEW']).default('DRAFT'),
});
export type CreateService = z.infer<typeof createServiceSchema>;

/**
 * Update service input
 */
export const updateServiceSchema = createServiceSchema.partial();
export type UpdateService = z.infer<typeof updateServiceSchema>;

/**
 * Service filter parameters
 */
export const serviceFilterSchema = z.object({
  freelancerUserId: uuidSchema.optional(),
  category: z.array(serviceCategorySchema).optional(),
  subcategory: z.string().optional(),
  skills: z.array(uuidSchema).optional(),
  experienceLevel: z.array(experienceLevelSchema).optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  deliveryTime: z.array(deliveryTimeSchema).optional(),
  minRating: z.number().min(0).max(5).optional(),
  status: z.array(serviceStatusSchema).optional(),
  isFeatured: z.boolean().optional(),
  skillpodAvailable: z.boolean().optional(),
  search: z.string().optional(),
});
export type ServiceFilter = z.infer<typeof serviceFilterSchema>;

/**
 * Service order input (purchasing a service)
 */
export const serviceOrderSchema = z.object({
  serviceId: uuidSchema,
  tierId: uuidSchema,
  addons: z
    .array(
      z.object({
        addonId: uuidSchema,
        quantity: z.number().int().positive().default(1),
      })
    )
    .optional(),
  requirements: z
    .array(
      z.object({
        requirementId: uuidSchema,
        answer: z.string().optional(),
        fileUrl: z.string().url().optional(),
        selectedOptions: z.array(z.string()).optional(),
      })
    )
    .optional(),
  message: z.string().max(2000).optional(),
  useSkillpod: z.boolean().default(false),
});
export type ServiceOrder = z.infer<typeof serviceOrderSchema>;
