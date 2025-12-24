/**
 * @module @skillancer/admin
 * Platform Administration Console
 *
 * Comprehensive admin system for the Skillancer platform including:
 * - User Management (accounts, roles, permissions, impersonation)
 * - Content Moderation (courses, jobs, profiles, reviews)
 * - System Configuration (feature flags, settings)
 * - Operations (health monitoring, queues, cache, database)
 * - Support Tools (user lookup, notes, bulk operations)
 * - Compliance (audit logs, data requests)
 */

// Models
export * from './models/index.js';

// Services
export * from './services/index.js';

// API Routes
export * from './api/index.js';
