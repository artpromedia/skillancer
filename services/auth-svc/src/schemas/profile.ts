/**
 * @module @skillancer/auth-svc/schemas/profile
 * Validation schemas for profile endpoints
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'api',
  'www',
  'mail',
  'email',
  'ftp',
  'ssh',
  'login',
  'register',
  'signup',
  'signin',
  'signout',
  'logout',
  'auth',
  'oauth',
  'settings',
  'profile',
  'profiles',
  'user',
  'users',
  'account',
  'accounts',
  'dashboard',
  'home',
  'about',
  'contact',
  'terms',
  'privacy',
  'legal',
  'blog',
  'news',
  'jobs',
  'careers',
  'hire',
  'freelancer',
  'freelancers',
  'client',
  'clients',
  'skillancer',
  'skillpod',
  'cockpit',
  'market',
  'marketplace',
  'billing',
  'payment',
  'payments',
  'invoice',
  'invoices',
  'pricing',
  'plans',
  'enterprise',
  'team',
  'teams',
  'org',
  'organization',
  'company',
  'null',
  'undefined',
  'test',
  'demo',
  'example',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'INR', 'BRL'] as const;

const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

// =============================================================================
// PROFILE SCHEMAS
// =============================================================================

/**
 * Update profile request schema
 */
export const updateProfileSchema = z.object({
  title: z.string().max(200).trim().optional().nullable(),
  bio: z.string().max(2000).trim().optional().nullable(),
  hourlyRate: z.number().min(0).max(10000).optional().nullable(),
  currency: z.enum(CURRENCIES).optional(),
  yearsExperience: z.number().int().min(0).max(70).optional().nullable(),
  country: z.string().length(2).toUpperCase().optional().nullable(),
  city: z.string().max(100).trim().optional().nullable(),
  linkedinUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .nullable()
    .refine((val) => !val || val.includes('linkedin.com'), 'Must be a LinkedIn URL'),
  githubUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .nullable()
    .refine((val) => !val || val.includes('github.com'), 'Must be a GitHub URL'),
  portfolioUrl: z.string().url().max(500).optional().nullable(),
  twitterUrl: z
    .string()
    .url()
    .max(500)
    .optional()
    .nullable()
    .refine(
      (val) => !val || val.includes('twitter.com') || val.includes('x.com'),
      'Must be a Twitter/X URL'
    ),
  isPublic: z.boolean().optional(),
  showEmail: z.boolean().optional(),
  showRate: z.boolean().optional(),
  showLocation: z.boolean().optional(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

/**
 * Username schema
 */
export const usernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .toLowerCase()
    .trim()
    .regex(
      /^[a-z][a-z0-9_-]*[a-z0-9]$/,
      'Username must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, underscores, and hyphens'
    )
    .refine((val) => !RESERVED_USERNAMES.includes(val), 'This username is reserved'),
});

export type UsernameRequest = z.infer<typeof usernameSchema>;

/**
 * Profile search filters schema
 */
export const profileSearchSchema = z.object({
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val;
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }),
  minRate: z.coerce.number().min(0).optional(),
  maxRate: z.coerce.number().min(0).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  query: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['relevance', 'rate_asc', 'rate_desc', 'experience']).default('relevance'),
});

export type ProfileSearchRequest = z.infer<typeof profileSearchSchema>;

// =============================================================================
// SKILLS SCHEMAS
// =============================================================================

/**
 * Add skill to profile schema
 */
export const addSkillSchema = z.object({
  level: z.enum(SKILL_LEVELS).optional(),
  yearsExp: z.number().int().min(0).max(70).optional(),
  isPrimary: z.boolean().optional(),
});

export type AddSkillRequest = z.infer<typeof addSkillSchema>;

/**
 * Update skill schema
 */
export const updateSkillSchema = z.object({
  level: z.enum(SKILL_LEVELS).optional(),
  yearsExp: z.number().int().min(0).max(70).optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export type UpdateSkillRequest = z.infer<typeof updateSkillSchema>;

/**
 * Reorder skills schema
 */
export const reorderSkillsSchema = z.object({
  skillIds: z.array(z.string().uuid()).min(1),
});

export type ReorderSkillsRequest = z.infer<typeof reorderSkillsSchema>;

/**
 * Set all skills schema
 */
export const setSkillsSchema = z.object({
  skills: z
    .array(
      z.object({
        skillId: z.string().uuid(),
        level: z.enum(SKILL_LEVELS).optional(),
        yearsExp: z.number().int().min(0).max(70).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .max(50, 'Maximum 50 skills allowed'),
});

export type SetSkillsRequest = z.infer<typeof setSkillsSchema>;

/**
 * Create custom skill schema
 */
export const createCustomSkillSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  category: z.string().min(2).max(100).trim(),
  description: z.string().max(500).trim().optional(),
});

export type CreateCustomSkillRequest = z.infer<typeof createCustomSkillSchema>;
