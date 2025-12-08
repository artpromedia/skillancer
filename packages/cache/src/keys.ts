/**
 * @module @skillancer/cache/keys
 * Cache key generators for consistent key naming
 */

// ============================================================================
// TYPES
// ============================================================================

export type CacheKeyGenerator<T extends unknown[] = unknown[]> = (
  ...args: T
) => string;

// ============================================================================
// CACHE KEYS
// ============================================================================

/**
 * Centralized cache key generators for Skillancer
 *
 * Using generators ensures consistent key naming and makes it easy to
 * find all cache usages for a particular entity.
 *
 * @example
 * ```typescript
 * import { CacheKeys } from '@skillancer/cache';
 *
 * // User keys
 * const userKey = CacheKeys.user('user-123');
 * // => 'user:user-123'
 *
 * // Job keys with filters
 * const jobListKey = CacheKeys.jobList({ status: 'published', page: 1 });
 * // => 'market:jobs:status=published&page=1'
 * ```
 */
export const CacheKeys = {
  // ==========================================================================
  // USER KEYS
  // ==========================================================================

  /** User by ID */
  user: (id: string) => `user:${id}`,

  /** User by email */
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,

  /** User sessions set */
  userSessions: (userId: string) => `user:${userId}:sessions`,

  /** User profile */
  userProfile: (userId: string) => `user:${userId}:profile`,

  /** User settings */
  userSettings: (userId: string) => `user:${userId}:settings`,

  /** User notifications count */
  userNotificationsCount: (userId: string) => `user:${userId}:notifications:count`,

  /** User permissions */
  userPermissions: (userId: string) => `user:${userId}:permissions`,

  /** User trust score */
  userTrustScore: (userId: string) => `user:${userId}:trust-score`,

  // ==========================================================================
  // MARKET (JOBS) KEYS
  // ==========================================================================

  /** Job by ID */
  job: (id: string) => `market:job:${id}`,

  /** Job list with filters */
  jobList: (filters: Record<string, unknown>) => {
    const sorted = Object.keys(filters)
      .sort()
      .map((k) => `${k}=${String(filters[k])}`)
      .join('&');
    return `market:jobs:${sorted || 'all'}`;
  },

  /** Job bids */
  jobBids: (jobId: string) => `market:job:${jobId}:bids`,

  /** Job bid count */
  jobBidCount: (jobId: string) => `market:job:${jobId}:bid-count`,

  /** Job view count */
  jobViewCount: (jobId: string) => `market:job:${jobId}:views`,

  /** Job search results */
  jobSearch: (query: string, page: number = 1) =>
    `market:search:${encodeURIComponent(query)}:${page}`,

  /** Featured jobs */
  featuredJobs: () => 'market:jobs:featured',

  /** Recent jobs */
  recentJobs: (limit: number = 10) => `market:jobs:recent:${limit}`,

  // ==========================================================================
  // BID KEYS
  // ==========================================================================

  /** Bid by ID */
  bid: (id: string) => `market:bid:${id}`,

  /** User's bids */
  userBids: (userId: string) => `market:user:${userId}:bids`,

  // ==========================================================================
  // CONTRACT KEYS
  // ==========================================================================

  /** Contract by ID */
  contract: (id: string) => `market:contract:${id}`,

  /** Contract milestones */
  contractMilestones: (contractId: string) =>
    `market:contract:${contractId}:milestones`,

  /** User's contracts */
  userContracts: (userId: string) => `market:user:${userId}:contracts`,

  // ==========================================================================
  // SERVICE KEYS
  // ==========================================================================

  /** Service by ID */
  service: (id: string) => `market:service:${id}`,

  /** Service list with filters */
  serviceList: (filters: Record<string, unknown>) => {
    const sorted = Object.keys(filters)
      .sort()
      .map((k) => `${k}=${String(filters[k])}`)
      .join('&');
    return `market:services:${sorted || 'all'}`;
  },

  /** User's services */
  userServices: (userId: string) => `market:user:${userId}:services`,

  // ==========================================================================
  // SKILLPOD KEYS
  // ==========================================================================

  /** SkillPod session by ID */
  session: (id: string) => `skillpod:session:${id}`,

  /** Active sessions for a tenant */
  activeSessions: (tenantId: string) =>
    `skillpod:tenant:${tenantId}:sessions:active`,

  /** Session participants */
  sessionParticipants: (sessionId: string) =>
    `skillpod:session:${sessionId}:participants`,

  /** Session chat messages */
  sessionMessages: (sessionId: string) =>
    `skillpod:session:${sessionId}:messages`,

  /** User's scheduled sessions */
  userScheduledSessions: (userId: string) =>
    `skillpod:user:${userId}:sessions:scheduled`,

  // ==========================================================================
  // TENANT KEYS
  // ==========================================================================

  /** Tenant by ID */
  tenant: (id: string) => `tenant:${id}`,

  /** Tenant by slug */
  tenantBySlug: (slug: string) => `tenant:slug:${slug}`,

  /** Tenant members */
  tenantMembers: (tenantId: string) => `tenant:${tenantId}:members`,

  /** Tenant settings */
  tenantSettings: (tenantId: string) => `tenant:${tenantId}:settings`,

  // ==========================================================================
  // SKILL KEYS
  // ==========================================================================

  /** All skills */
  skills: () => 'skills:all',

  /** Skills by category */
  skillsByCategory: (category: string) => `skills:category:${category}`,

  /** Popular skills */
  popularSkills: (limit: number = 20) => `skills:popular:${limit}`,

  /** Skill search */
  skillSearch: (query: string) => `skills:search:${encodeURIComponent(query)}`,

  // ==========================================================================
  // RATE LIMITING KEYS
  // ==========================================================================

  /** Generic rate limit key */
  rateLimit: (type: string, key: string) => `ratelimit:${type}:${key}`,

  /** API rate limit by IP */
  rateLimitIp: (ip: string) => `ratelimit:api:ip:${ip}`,

  /** API rate limit by user */
  rateLimitUser: (userId: string) => `ratelimit:api:user:${userId}`,

  /** Auth rate limit */
  rateLimitAuth: (identifier: string) => `ratelimit:auth:${identifier}`,

  // ==========================================================================
  // MISC KEYS
  // ==========================================================================

  /** Email verification token */
  emailVerification: (token: string) => `email:verify:${token}`,

  /** Password reset token */
  passwordReset: (token: string) => `password:reset:${token}`,

  /** Invite token */
  inviteToken: (token: string) => `invite:${token}`,

  /** Feature flags */
  featureFlags: (environment: string = 'production') =>
    `features:${environment}`,

  /** System health status */
  healthStatus: () => 'system:health',

  /** Statistics */
  stats: (type: string, period: string) => `stats:${type}:${period}`,
} as const;

// ============================================================================
// CACHE TAGS
// ============================================================================

/**
 * Cache tags for group invalidation
 *
 * @example
 * ```typescript
 * import { CacheTags, CacheService } from '@skillancer/cache';
 *
 * // Set with tags
 * await cache.set('user:123', userData, {
 *   ttl: 3600,
 *   tags: [CacheTags.users, CacheTags.user('123')]
 * });
 *
 * // Invalidate all user caches
 * await cache.deleteByTag(CacheTags.users);
 * ```
 */
export const CacheTags = {
  // Entity tags
  users: 'tag:users',
  user: (id: string) => `tag:user:${id}`,
  jobs: 'tag:jobs',
  job: (id: string) => `tag:job:${id}`,
  bids: 'tag:bids',
  contracts: 'tag:contracts',
  services: 'tag:services',
  sessions: 'tag:sessions',
  tenants: 'tag:tenants',
  tenant: (id: string) => `tag:tenant:${id}`,
  skills: 'tag:skills',

  // Feature tags
  market: 'tag:market',
  skillpod: 'tag:skillpod',
  cockpit: 'tag:cockpit',

  // Search/list tags
  searchResults: 'tag:search',
  listings: 'tag:listings',
} as const;
