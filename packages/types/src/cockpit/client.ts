/**
 * @skillancer/types - Cockpit: Client Types
 * Client management schemas for the dashboard
 */

import { z } from 'zod';

import {
  uuidSchema,
  emailSchema,
  dateSchema,
  currencyCodeSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Client Enums
// =============================================================================

/**
 * Client status
 */
export const clientStatusSchema = z.enum([
  'LEAD',
  'PROSPECT',
  'ACTIVE',
  'ON_HOLD',
  'CHURNED',
  'ARCHIVED',
]);
export type ClientStatus = z.infer<typeof clientStatusSchema>;

/**
 * Client tier/priority
 */
export const clientTierSchema = z.enum(['STANDARD', 'PREMIUM', 'VIP', 'ENTERPRISE']);
export type ClientTier = z.infer<typeof clientTierSchema>;

/**
 * Contact type
 */
export const contactTypeSchema = z.enum(['PRIMARY', 'BILLING', 'TECHNICAL', 'LEGAL', 'OTHER']);
export type ContactType = z.infer<typeof contactTypeSchema>;

// =============================================================================
// Client Sub-schemas
// =============================================================================

/**
 * Client contact person
 */
export const clientContactSchema = z.object({
  id: uuidSchema,
  type: contactTypeSchema,
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  email: emailSchema,
  phone: z.string().max(30).optional(),
  position: z.string().max(100).optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
export type ClientContact = z.infer<typeof clientContactSchema>;

/**
 * Client address
 */
export const clientAddressSchema = z.object({
  id: uuidSchema,
  type: z.enum(['BILLING', 'SHIPPING', 'OFFICE', 'OTHER']),
  street1: z.string().max(200),
  street2: z.string().max(200).optional(),
  city: z.string().max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  isPrimary: z.boolean().default(false),
});
export type ClientAddress = z.infer<typeof clientAddressSchema>;

/**
 * Client note
 */
export const clientNoteSchema = z.object({
  id: uuidSchema,
  content: z.string().max(5000),
  createdByUserId: uuidSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema.optional(),
  isPinned: z.boolean().default(false),
});
export type ClientNote = z.infer<typeof clientNoteSchema>;

/**
 * Client tag
 */
export const clientTagSchema = z.object({
  id: uuidSchema,
  name: z.string().max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});
export type ClientTag = z.infer<typeof clientTagSchema>;

// =============================================================================
// Main Client Schema
// =============================================================================

/**
 * Complete client schema
 */
export const clientSchema = z.object({
  id: uuidSchema,
  freelancerUserId: uuidSchema, // Owner of this client record
  tenantId: uuidSchema.optional(),

  // Basic info
  name: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional(),
  logo: z.string().url().optional(),

  // Status
  status: clientStatusSchema,
  tier: clientTierSchema.default('STANDARD'),

  // Platform connection (if they're also a Skillancer user)
  linkedUserId: uuidSchema.optional(),

  // Contacts
  contacts: z.array(clientContactSchema),
  addresses: z.array(clientAddressSchema).optional(),

  // Communication preferences
  preferredCurrency: currencyCodeSchema.default('USD'),
  preferredLanguage: z.string().length(2).default('en'),
  timezone: z.string().default('UTC'),

  // Billing
  taxId: z.string().max(50).optional(),
  paymentTermsDays: z.number().int().nonnegative().default(30),
  defaultHourlyRate: z.number().positive().optional(),

  // Stats
  totalContracts: z.number().int().nonnegative().default(0),
  activeContracts: z.number().int().nonnegative().default(0),
  totalRevenue: z.number().nonnegative().default(0),
  totalHoursWorked: z.number().nonnegative().default(0),
  averageRating: z.number().min(0).max(5).optional(),
  lastContractAt: dateSchema.optional(),
  lastContactAt: dateSchema.optional(),

  // Tags and notes
  tags: z.array(clientTagSchema).optional(),
  notes: z.array(clientNoteSchema).optional(),

  // Acquisition
  source: z
    .enum(['SKILLANCER', 'REFERRAL', 'WEBSITE', 'SOCIAL', 'COLD_OUTREACH', 'OTHER'])
    .optional(),
  referredBy: z.string().max(200).optional(),

  ...timestampsSchema.shape,
});
export type Client = z.infer<typeof clientSchema>;

// =============================================================================
// Client CRUD Schemas
// =============================================================================

/**
 * Create client input
 */
export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  displayName: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional(),
  status: clientStatusSchema.default('LEAD'),
  tier: clientTierSchema.default('STANDARD'),
  linkedUserId: uuidSchema.optional(),
  contacts: z.array(clientContactSchema.omit({ id: true })).min(1),
  addresses: z.array(clientAddressSchema.omit({ id: true })).optional(),
  preferredCurrency: currencyCodeSchema.default('USD'),
  preferredLanguage: z.string().length(2).default('en'),
  timezone: z.string().default('UTC'),
  taxId: z.string().max(50).optional(),
  paymentTermsDays: z.number().int().nonnegative().default(30),
  defaultHourlyRate: z.number().positive().optional(),
  tags: z.array(z.string().max(50)).optional(),
  source: z
    .enum(['SKILLANCER', 'REFERRAL', 'WEBSITE', 'SOCIAL', 'COLD_OUTREACH', 'OTHER'])
    .optional(),
  referredBy: z.string().max(200).optional(),
});
export type CreateClient = z.infer<typeof createClientSchema>;

/**
 * Update client input
 */
export const updateClientSchema = createClientSchema.partial();
export type UpdateClient = z.infer<typeof updateClientSchema>;

/**
 * Add client note input
 */
export const addClientNoteSchema = z.object({
  content: z.string().max(5000),
  isPinned: z.boolean().default(false),
});
export type AddClientNote = z.infer<typeof addClientNoteSchema>;

/**
 * Client filter parameters
 */
export const clientFilterSchema = z.object({
  status: z.array(clientStatusSchema).optional(),
  tier: z.array(clientTierSchema).optional(),
  industry: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minRevenue: z.number().nonnegative().optional(),
  maxRevenue: z.number().nonnegative().optional(),
  hasActiveContracts: z.boolean().optional(),
  lastContactAfter: dateSchema.optional(),
  lastContactBefore: dateSchema.optional(),
  search: z.string().optional(),
});
export type ClientFilter = z.infer<typeof clientFilterSchema>;
