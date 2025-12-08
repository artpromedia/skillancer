/**
 * @module @skillancer/cache/session-store
 * Redis-based session storage for authentication
 */

import type Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface DeviceInfo {
  /** User agent string */
  userAgent: string;
  /** Client IP address */
  ip: string;
  /** Device type (mobile, desktop, tablet) */
  deviceType?: string;
  /** Browser name */
  browser?: string;
  /** Operating system */
  os?: string;
}

export interface SessionData {
  /** User ID */
  userId: string;
  /** Tenant ID (for multi-tenant) */
  tenantId?: string;
  /** User roles */
  roles: string[];
  /** User permissions */
  permissions?: string[];
  /** Device information */
  deviceInfo: DeviceInfo;
  /** Session creation time */
  createdAt: Date;
  /** Session expiration time */
  expiresAt: Date;
  /** Last activity time */
  lastActivityAt?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface SessionStoreOptions {
  /** Key prefix for sessions */
  prefix?: string;
  /** Default TTL in seconds (default: 24 hours) */
  ttl?: number;
  /** Whether to track sessions per user */
  trackUserSessions?: boolean;
  /** Maximum sessions per user (0 = unlimited) */
  maxSessionsPerUser?: number;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastActivityAt: Date | undefined;
  deviceInfo: DeviceInfo;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PREFIX = 'session';
const DEFAULT_TTL = 24 * 60 * 60; // 24 hours
const USER_SESSIONS_KEY = 'user_sessions';

// ============================================================================
// SESSION STORE
// ============================================================================

/**
 * Redis-based session store for managing user sessions
 *
 * Features:
 * - Session CRUD operations
 * - User session tracking
 * - Automatic session expiration
 * - Session refresh
 * - Multi-device support
 *
 * @example
 * ```typescript
 * import { SessionStore } from '@skillancer/cache/session';
 * import { getRedisClient } from '@skillancer/cache';
 *
 * const sessions = new SessionStore(getRedisClient(), {
 *   ttl: 7 * 24 * 60 * 60, // 7 days
 *   trackUserSessions: true,
 *   maxSessionsPerUser: 5,
 * });
 *
 * // Create session
 * await sessions.create('session-id', {
 *   userId: 'user-123',
 *   roles: ['user'],
 *   deviceInfo: { userAgent: '...', ip: '...' },
 *   createdAt: new Date(),
 *   expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
 * });
 *
 * // Get session
 * const session = await sessions.get('session-id');
 *
 * // Refresh session
 * await sessions.refresh('session-id');
 *
 * // Delete all user sessions
 * await sessions.deleteUserSessions('user-123');
 * ```
 */
export class SessionStore {
  private readonly prefix: string;
  private readonly ttl: number;
  private readonly trackUserSessions: boolean;
  private readonly maxSessionsPerUser: number;

  constructor(
    private readonly redis: Redis,
    options: SessionStoreOptions = {}
  ) {
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.trackUserSessions = options.trackUserSessions ?? true;
    this.maxSessionsPerUser = options.maxSessionsPerUser ?? 0;
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * Create a new session
   *
   * @param sessionId - Unique session identifier
   * @param data - Session data
   */
  async create(sessionId: string, data: SessionData): Promise<void> {
    const key = this.buildSessionKey(sessionId);
    const serialized = this.serialize(data);

    // Calculate TTL from expiresAt or use default
    const ttl = data.expiresAt
      ? Math.max(1, Math.floor((data.expiresAt.getTime() - Date.now()) / 1000))
      : this.ttl;

    await this.redis.setex(key, ttl, serialized);

    // Track session for user
    if (this.trackUserSessions) {
      await this.addUserSession(data.userId, sessionId, data);

      // Enforce max sessions per user
      if (this.maxSessionsPerUser > 0) {
        await this.enforceMaxSessions(data.userId);
      }
    }
  }

  /**
   * Get session data
   *
   * @param sessionId - Session identifier
   * @returns Session data or null if not found/expired
   */
  async get(sessionId: string): Promise<SessionData | null> {
    const key = this.buildSessionKey(sessionId);
    const data = await this.redis.get(key);

    if (!data) return null;

    return this.deserialize(data);
  }

  /**
   * Update session data
   *
   * @param sessionId - Session identifier
   * @param data - Partial session data to update
   */
  async update(sessionId: string, data: Partial<SessionData>): Promise<void> {
    const existing = await this.get(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated: SessionData = {
      ...existing,
      ...data,
      lastActivityAt: new Date(),
    };

    const key = this.buildSessionKey(sessionId);
    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      await this.redis.setex(key, ttl, this.serialize(updated));
    }
  }

  /**
   * Delete a session
   *
   * @param sessionId - Session identifier
   */
  async delete(sessionId: string): Promise<void> {
    // Get session to find userId
    const session = await this.get(sessionId);

    // Delete session
    const key = this.buildSessionKey(sessionId);
    await this.redis.del(key);

    // Remove from user sessions
    if (session && this.trackUserSessions) {
      await this.removeUserSession(session.userId, sessionId);
    }
  }

  /**
   * Refresh session expiration
   *
   * @param sessionId - Session identifier
   * @param ttl - New TTL in seconds (optional, uses default)
   */
  async refresh(sessionId: string, ttl?: number): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const newTtl = ttl ?? this.ttl;
    const key = this.buildSessionKey(sessionId);

    // Update expiration
    await this.redis.expire(key, newTtl);

    // Update session data
    session.expiresAt = new Date(Date.now() + newTtl * 1000);
    session.lastActivityAt = new Date();
    await this.redis.setex(key, newTtl, this.serialize(session));
  }

  /**
   * Check if a session exists and is valid
   *
   * @param sessionId - Session identifier
   * @returns true if session exists and is not expired
   */
  async exists(sessionId: string): Promise<boolean> {
    const key = this.buildSessionKey(sessionId);
    const result = await this.redis.exists(key);
    return result > 0;
  }

  // ==========================================================================
  // USER SESSIONS
  // ==========================================================================

  /**
   * Get all session IDs for a user
   *
   * @param userId - User identifier
   * @returns Array of session IDs
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const key = this.buildUserSessionsKey(userId);
    return this.redis.smembers(key);
  }

  /**
   * Get detailed info for all user sessions
   *
   * @param userId - User identifier
   * @returns Array of session info
   */
  async getUserSessionsInfo(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.getUserSessions(userId);
    const sessions: SessionInfo[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.get(sessionId);
      if (session) {
        sessions.push({
          sessionId,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          deviceInfo: session.deviceInfo,
        });
      } else {
        // Session expired, remove from tracking
        await this.removeUserSession(userId, sessionId);
      }
    }

    return sessions;
  }

  /**
   * Delete all sessions for a user
   *
   * @param userId - User identifier
   * @returns Number of sessions deleted
   */
  async deleteUserSessions(userId: string): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);

    if (sessionIds.length === 0) return 0;

    // Delete all sessions
    const pipeline = this.redis.pipeline();
    for (const sessionId of sessionIds) {
      pipeline.del(this.buildSessionKey(sessionId));
    }

    // Delete user sessions set
    pipeline.del(this.buildUserSessionsKey(userId));

    await pipeline.exec();
    return sessionIds.length;
  }

  /**
   * Delete all sessions for a user except the current one
   *
   * @param userId - User identifier
   * @param currentSessionId - Session to keep
   * @returns Number of sessions deleted
   */
  async deleteOtherUserSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);
    const toDelete = sessionIds.filter((id) => id !== currentSessionId);

    if (toDelete.length === 0) return 0;

    const pipeline = this.redis.pipeline();
    for (const sessionId of toDelete) {
      pipeline.del(this.buildSessionKey(sessionId));
      pipeline.srem(this.buildUserSessionsKey(userId), sessionId);
    }

    await pipeline.exec();
    return toDelete.length;
  }

  /**
   * Get session count for a user
   *
   * @param userId - User identifier
   * @returns Number of active sessions
   */
  async getUserSessionCount(userId: string): Promise<number> {
    const key = this.buildUserSessionsKey(userId);
    return this.redis.scard(key);
  }

  // ==========================================================================
  // HEALTH & MAINTENANCE
  // ==========================================================================

  /**
   * Check if the session store is healthy
   *
   * @returns true if Redis connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired sessions from user tracking
   * Run this periodically to maintain consistency
   *
   * @param userId - User identifier (optional, cleans all if not provided)
   */
  async cleanup(userId?: string): Promise<number> {
    let cleaned = 0;

    if (userId) {
      cleaned = await this.cleanupUserSessions(userId);
    } else {
      // Scan all user session keys and clean
      const pattern = `${this.prefix}:${USER_SESSIONS_KEY}:*`;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        for (const key of keys) {
          const uid = key.split(':').pop();
          if (uid) {
            cleaned += await this.cleanupUserSessions(uid);
          }
        }
      } while (cursor !== '0');
    }

    return cleaned;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Add session to user's session tracking
   */
  private async addUserSession(
    userId: string,
    sessionId: string,
    _data: SessionData
  ): Promise<void> {
    const key = this.buildUserSessionsKey(userId);
    await this.redis.sadd(key, sessionId);
  }

  /**
   * Remove session from user's session tracking
   */
  private async removeUserSession(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const key = this.buildUserSessionsKey(userId);
    await this.redis.srem(key, sessionId);
  }

  /**
   * Enforce maximum sessions per user (remove oldest)
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessionsInfo(userId);

    if (sessions.length <= this.maxSessionsPerUser) return;

    // Sort by creation time (oldest first)
    sessions.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Remove oldest sessions
    const toRemove = sessions.slice(
      0,
      sessions.length - this.maxSessionsPerUser
    );
    for (const session of toRemove) {
      await this.delete(session.sessionId);
    }
  }

  /**
   * Clean up expired sessions from user tracking
   */
  private async cleanupUserSessions(userId: string): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);
    let cleaned = 0;

    for (const sessionId of sessionIds) {
      const exists = await this.exists(sessionId);
      if (!exists) {
        await this.removeUserSession(userId, sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Build session key
   */
  private buildSessionKey(sessionId: string): string {
    return `${this.prefix}:${sessionId}`;
  }

  /**
   * Build user sessions key
   */
  private buildUserSessionsKey(userId: string): string {
    return `${this.prefix}:${USER_SESSIONS_KEY}:${userId}`;
  }

  /**
   * Serialize session data
   */
  private serialize(data: SessionData): string {
    return JSON.stringify({
      ...data,
      createdAt: data.createdAt.toISOString(),
      expiresAt: data.expiresAt.toISOString(),
      lastActivityAt: data.lastActivityAt?.toISOString(),
    });
  }

  /**
   * Deserialize session data
   */
  private deserialize(data: string): SessionData {
    const parsed = JSON.parse(data) as {
      userId: string;
      tenantId?: string;
      roles: string[];
      permissions?: string[];
      deviceInfo: DeviceInfo;
      createdAt: string;
      expiresAt: string;
      lastActivityAt?: string;
      metadata?: Record<string, unknown>;
    };
    
    const result: SessionData = {
      userId: parsed.userId,
      roles: parsed.roles,
      deviceInfo: parsed.deviceInfo,
      createdAt: new Date(parsed.createdAt),
      expiresAt: new Date(parsed.expiresAt),
    };
    
    if (parsed.tenantId !== undefined) {
      result.tenantId = parsed.tenantId;
    }
    
    if (parsed.permissions !== undefined) {
      result.permissions = parsed.permissions;
    }
    
    if (parsed.lastActivityAt !== undefined) {
      result.lastActivityAt = new Date(parsed.lastActivityAt);
    }
    
    if (parsed.metadata !== undefined) {
      result.metadata = parsed.metadata;
    }
    
    return result;
  }
}
