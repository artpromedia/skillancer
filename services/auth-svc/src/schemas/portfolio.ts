/**
 * @module @skillancer/auth-svc/schemas/portfolio
 * Validation schemas for portfolio endpoints
 */

import { z } from 'zod';

// =============================================================================
// PORTFOLIO ITEM SCHEMAS
// =============================================================================

/**
 * Create portfolio item request schema
 */
export const createPortfolioItemSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  projectUrl: z.string().url().max(500).optional().nullable(),
  skills: z.array(z.string().max(100)).max(20).optional(),
  completedAt: z.coerce.date().optional().nullable(),
  clientName: z.string().max(200).trim().optional().nullable(),
  isConfidential: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
});

/**
 * Update portfolio item request schema
 */
export const updatePortfolioItemSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  projectUrl: z.string().url().max(500).optional().nullable(),
  skills: z.array(z.string().max(100)).max(20).optional(),
  completedAt: z.coerce.date().optional().nullable(),
  clientName: z.string().max(200).trim().optional().nullable(),
  isConfidential: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  displayOrder: z.number().int().min(1).optional(),
});

/**
 * Reorder portfolio items request schema
 */
export const reorderPortfolioItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
});

/**
 * Set video URL request schema
 */
export const setVideoUrlSchema = z.object({
  videoUrl: z
    .string()
    .url()
    .max(500)
    .refine(
      (url) => {
        // Allow YouTube, Vimeo, and direct video URLs
        const allowedDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'loom.com'];
        try {
          const urlObj = new URL(url);
          return allowedDomains.some((domain) => urlObj.hostname.includes(domain));
        } catch {
          return false;
        }
      },
      { message: 'Video URL must be from YouTube, Vimeo, or Loom' }
    )
    .nullable()
    .optional(),
});

/**
 * Portfolio list query schema
 */
export const portfolioListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  featuredOnly: z.coerce.boolean().optional(),
});

/**
 * Portfolio item ID parameter schema
 */
export const portfolioItemIdParamSchema = z.object({
  itemId: z.string().uuid(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;
export type ReorderPortfolioItemsInput = z.infer<typeof reorderPortfolioItemsSchema>;
export type SetVideoUrlInput = z.infer<typeof setVideoUrlSchema>;
export type PortfolioListQueryInput = z.infer<typeof portfolioListQuerySchema>;
