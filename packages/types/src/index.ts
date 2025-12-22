/**
 * @skillancer/types
 * Shared TypeScript types with Zod schemas for runtime validation
 *
 * This package provides comprehensive type definitions and Zod schemas
 * for the Skillancer platform, covering all three products:
 * - SkillPod: Virtual Desktop Infrastructure (VDI)
 * - Market: Freelance marketplace
 * - Cockpit: Dashboard and business management
 *
 * @example
 * ```typescript
 * // Import all types
 * import * as types from '@skillancer/types';
 *
 * // Import specific modules
 * import { User, userSchema } from '@skillancer/types/auth';
 * import { Job, createJobSchema } from '@skillancer/types/market';
 * import { Pod, sessionSchema } from '@skillancer/types/skillpod';
 * import { Client, calendarEventSchema } from '@skillancer/types/cockpit';
 * import { Payment, invoiceSchema } from '@skillancer/types/billing';
 *
 * // Validate data
 * const result = userSchema.safeParse(data);
 * if (result.success) {
 *   const user: User = result.data;
 * }
 * ```
 */

// Re-export Zod for convenience
export { z } from 'zod';

// Common base types
export * from './common';

// Auth types (users, tenants, sessions)
export * from './auth';

// Market types (jobs, bids, contracts, services, reviews)
export * from './market';

// SkillPod types (pods, sessions, policies)
export * from './skillpod';

// Cockpit types (clients, calendar, alerts)
export * from './cockpit';

// Billing types (payments, subscriptions, invoices)
export * from './billing';

// Credential integration types (SkillPod ↔ Market)
export * from './credential';
