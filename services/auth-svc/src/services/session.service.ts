/**
 * @module @skillancer/auth-svc/services/session
 * Session management service using Redis
 */

import type { Redis } from 'ioredis';
import crypto from 'crypto';

import {
  SessionStore,
  type SessionData,
  type DeviceInfo as CacheDeviceInfo,
} from '@skillancer/cache';

import { getConfig } from '../config/index.js';
import { SessionExpiredError } from '../errors/index.js';
import type { DeviceInfo } from '../schemas/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateSessionInput {
  userId: string;
  deviceInfo: DeviceInfo;
  roles: string[];
  tenantId?: string;
  refreshTokenId?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  tenantId: string | undefined;
  roles: string[];
  deviceInfo: CacheDeviceInfo;
  refreshTokenId: string | undefined;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date | undefined;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert auth DeviceInfo to cache CacheDeviceInfo
 */
function toCacheDeviceInfo(deviceInfo: DeviceInfo): CacheDeviceInfo {
  const result: CacheDeviceInfo = {
    userAgent: deviceInfo.userAgent,
    ip: deviceInfo.ip,
  };
  if (deviceInfo.browser !== undefined) result.browser = deviceInfo.browser;
  if (deviceInfo.os !== undefined) result.os = deviceInfo.os;
  if (deviceInfo.deviceType !== undefined) result.deviceType = deviceInfo.deviceType;
  return result;
}

// =============================================================================
// SESSION SERVICE
// =============================================================================

/**
 * Session management service
 *
 * Handles:
 * - Session creation and storage in Redis
 * - Session validation and retrieval
 * - Session refresh/extension
 * - Session invalidation (single and bulk)
 *
 * @example
 * ```typescript
 * const sessionService = new SessionService(redis);
 *
 * // Create session
 * const session = await sessionService.createSession({
 *   userId: 'user-123',
 *   deviceInfo: { userAgent: '...', ip: '...' },
 *   roles: ['user'],
 * });
 *
 * // Get session
 * const sessionData = await sessionService.getSession(session.sessionId);
 *
 * // Invalidate session
 * await sessionService.invalidateSession(session.sessionId);
 * ```
 */
export class SessionService {
  private readonly sessionStore: SessionStore;
  private readonly config = getConfig();

  constructor(redis: Redis) {
    this.sessionStore = new SessionStore(redis, {
      prefix: 'auth:session',
      ttl: this.config.security.sessionTtl,
      trackUserSessions: true,
      maxSessionsPerUser: 10, // Allow up to 10 concurrent sessions
    });
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Create a new session for a user
   *
   * @param input - Session creation data
   * @returns Created session info
   */
  async createSession(input: CreateSessionInput): Promise<SessionInfo> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.security.sessionTtl * 1000);

    const cacheDeviceInfo = toCacheDeviceInfo(input.deviceInfo);

    // Build SessionData with proper handling of optional fields
    const sessionData: SessionData = {
      userId: input.userId,
      roles: input.roles,
      deviceInfo: cacheDeviceInfo,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      metadata: {
        refreshTokenId: input.refreshTokenId,
      },
    };
    // Only set tenantId if defined
    if (input.tenantId !== undefined) {
      sessionData.tenantId = input.tenantId;
    }

    await this.sessionStore.create(sessionId, sessionData);

    return {
      sessionId,
      userId: input.userId,
      tenantId: input.tenantId,
      roles: input.roles,
      deviceInfo: cacheDeviceInfo,
      refreshTokenId: input.refreshTokenId,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
    };
  }

  /**
   * Get session data by session ID
   *
   * @param sessionId - Session identifier
   * @returns Session info or null if not found/expired
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const session = await this.sessionStore.get(sessionId);

    if (!session) {
      return null;
    }

    return {
      sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      roles: session.roles,
      deviceInfo: session.deviceInfo,
      refreshTokenId: session.metadata?.refreshTokenId as string | undefined,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  /**
   * Validate session exists and is active
   *
   * @param sessionId - Session identifier
   * @throws SessionExpiredError if session not found or expired
   */
  async validateSession(sessionId: string): Promise<SessionInfo> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new SessionExpiredError();
    }

    return session;
  }

  /**
   * Update session activity timestamp (extends TTL)
   *
   * @param sessionId - Session identifier
   */
  async refreshSession(sessionId: string): Promise<void> {
    const exists = await this.sessionStore.exists(sessionId);

    if (!exists) {
      throw new SessionExpiredError();
    }

    await this.sessionStore.refresh(sessionId, this.config.security.sessionTtl);
  }

  /**
   * Update session's refresh token ID
   *
   * @param sessionId - Session identifier
   * @param refreshTokenId - New refresh token ID
   */
  async updateRefreshTokenId(sessionId: string, refreshTokenId: string): Promise<void> {
    const session = await this.sessionStore.get(sessionId);

    if (!session) {
      throw new SessionExpiredError();
    }

    await this.sessionStore.update(sessionId, {
      metadata: {
        ...session.metadata,
        refreshTokenId,
      },
    });
  }

  // ===========================================================================
  // SESSION INVALIDATION
  // ===========================================================================

  /**
   * Invalidate a single session
   *
   * @param sessionId - Session identifier
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.sessionStore.delete(sessionId);
  }

  /**
   * Invalidate all sessions for a user
   *
   * @param userId - User identifier
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.sessionStore.deleteUserSessions(userId);
  }

  /**
   * Invalidate all sessions except the current one
   *
   * @param userId - User identifier
   * @param currentSessionId - Session to keep
   */
  async invalidateOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    const sessionIds = await this.sessionStore.getUserSessions(userId);

    await Promise.all(
      sessionIds.filter((id) => id !== currentSessionId).map((id) => this.sessionStore.delete(id))
    );
  }

  // ===========================================================================
  // SESSION QUERIES
  // ===========================================================================

  /**
   * Get all active sessions for a user
   *
   * @param userId - User identifier
   * @returns List of active sessions
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.sessionStore.getUserSessions(userId);
    const sessions: SessionInfo[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Get count of active sessions for a user
   *
   * @param userId - User identifier
   * @returns Number of active sessions
   */
  async getUserSessionCount(userId: string): Promise<number> {
    const sessionIds = await this.sessionStore.getUserSessions(userId);
    return sessionIds.length;
  }

  /**
   * Check if session belongs to user
   *
   * @param sessionId - Session identifier
   * @param userId - User identifier
   * @returns True if session belongs to user
   */
  async isUserSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session?.userId === userId;
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let sessionServiceInstance: SessionService | null = null;

/**
 * Initialize session service with Redis client
 */
export function initializeSessionService(redis: Redis): SessionService {
  sessionServiceInstance = new SessionService(redis);
  return sessionServiceInstance;
}

/**
 * Get session service instance
 * @throws Error if not initialized
 */
export function getSessionService(): SessionService {
  if (!sessionServiceInstance) {
    throw new Error('Session service not initialized. Call initializeSessionService first.');
  }
  return sessionServiceInstance;
}

/**
 * Reset session service (for testing)
 */
export function resetSessionService(): void {
  sessionServiceInstance = null;
}
