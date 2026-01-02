/**
 * Session Security Hardening
 * SOC 2 compliant session management
 */

import { randomBytes, createHash } from 'crypto';

export interface SessionConfig {
  absoluteTimeoutMs: number; // Maximum session lifetime
  idleTimeoutMs: number; // Timeout after inactivity
  maxConcurrentSessions: number;
  bindToIP: boolean;
  bindToUserAgent: boolean;
  regenerateOnAuth: boolean;
  secureCookieAttributes: boolean;
  sessionIdLength: number; // in bytes
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  ip: string;
  userAgent: string;
  fingerprint: string;
  mfaVerified: boolean;
  privileges: string[];
  metadata: Record<string, unknown>;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: SessionEventType;
  timestamp: Date;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
}

export enum SessionEventType {
  CREATED = 'session_created',
  ACCESSED = 'session_accessed',
  REFRESHED = 'session_refreshed',
  EXPIRED = 'session_expired',
  INVALIDATED = 'session_invalidated',
  FORCED_LOGOUT = 'forced_logout',
  CONCURRENT_LIMIT = 'concurrent_limit_exceeded',
  IP_MISMATCH = 'ip_mismatch',
  UA_MISMATCH = 'user_agent_mismatch',
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  absoluteTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxConcurrentSessions: 5,
  bindToIP: false, // Can cause issues with mobile/VPN
  bindToUserAgent: true,
  regenerateOnAuth: true,
  secureCookieAttributes: true,
  sessionIdLength: 32, // 256 bits
};

// In-memory stores (use Redis in production)
const sessionStore: Map<string, Session> = new Map();
const userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
const sessionEvents: SessionEvent[] = [];

export class SessionManager {
  private config: SessionConfig;

  constructor(customConfig?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    ip: string,
    userAgent: string,
    mfaVerified: boolean = false,
    privileges: string[] = [],
    metadata: Record<string, unknown> = {}
  ): Promise<Session> {
    // Check concurrent session limit
    const existingSessions = userSessions.get(userId) || new Set();
    if (existingSessions.size >= this.config.maxConcurrentSessions) {
      // Remove oldest session
      const oldestSessionId = await this.getOldestSession(userId);
      if (oldestSessionId) {
        await this.invalidateSession(oldestSessionId, 'concurrent_limit');
      }
    }

    const now = new Date();
    const sessionId = this.generateSessionId();
    const fingerprint = this.generateFingerprint(ip, userAgent);

    const session: Session = {
      id: sessionId,
      userId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + this.config.absoluteTimeoutMs),
      ip,
      userAgent,
      fingerprint,
      mfaVerified,
      privileges,
      metadata,
    };

    sessionStore.set(sessionId, session);

    // Track user sessions
    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Set());
    }
    userSessions.get(userId)!.add(sessionId);

    this.logEvent(session, SessionEventType.CREATED);

    return session;
  }

  /**
   * Validate and refresh session
   */
  async validateSession(
    sessionId: string,
    ip: string,
    userAgent: string
  ): Promise<{ valid: boolean; session?: Session; error?: string }> {
    const session = sessionStore.get(sessionId);

    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    const now = new Date();

    // Check absolute timeout
    if (now >= session.expiresAt) {
      await this.invalidateSession(sessionId, 'expired');
      return { valid: false, error: 'Session expired' };
    }

    // Check idle timeout
    const idleTime = now.getTime() - session.lastActivityAt.getTime();
    if (idleTime > this.config.idleTimeoutMs) {
      await this.invalidateSession(sessionId, 'idle_timeout');
      return { valid: false, error: 'Session timed out due to inactivity' };
    }

    // Check IP binding
    if (this.config.bindToIP && session.ip !== ip) {
      this.logEvent(session, SessionEventType.IP_MISMATCH, {
        expectedIp: session.ip,
        actualIp: ip,
      });
      await this.invalidateSession(sessionId, 'ip_mismatch');
      return { valid: false, error: 'Session invalid: IP address changed' };
    }

    // Check User-Agent binding (more lenient - just log warning)
    if (this.config.bindToUserAgent) {
      const currentFingerprint = this.generateFingerprint(ip, userAgent);
      if (session.fingerprint !== currentFingerprint) {
        this.logEvent(session, SessionEventType.UA_MISMATCH, {
          expectedFingerprint: session.fingerprint,
          actualFingerprint: currentFingerprint,
        });
        // Don't invalidate, but log for monitoring
      }
    }

    // Update last activity
    session.lastActivityAt = now;
    sessionStore.set(sessionId, session);

    this.logEvent(session, SessionEventType.ACCESSED);

    return { valid: true, session };
  }

  /**
   * Regenerate session ID (after authentication/privilege change)
   */
  async regenerateSession(oldSessionId: string): Promise<Session | null> {
    const oldSession = sessionStore.get(oldSessionId);
    if (!oldSession) return null;

    const newSessionId = this.generateSessionId();
    const newSession: Session = {
      ...oldSession,
      id: newSessionId,
      lastActivityAt: new Date(),
    };

    // Remove old session
    sessionStore.delete(oldSessionId);
    userSessions.get(oldSession.userId)?.delete(oldSessionId);

    // Add new session
    sessionStore.set(newSessionId, newSession);
    userSessions.get(oldSession.userId)?.add(newSessionId);

    this.logEvent(newSession, SessionEventType.REFRESHED, { oldSessionId });

    return newSession;
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string, reason: string = 'logout'): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    sessionStore.delete(sessionId);
    userSessions.get(session.userId)?.delete(sessionId);

    const eventType =
      reason === 'expired'
        ? SessionEventType.EXPIRED
        : reason === 'concurrent_limit'
          ? SessionEventType.CONCURRENT_LIMIT
          : SessionEventType.INVALIDATED;

    this.logEvent(session, eventType, { reason });
  }

  /**
   * Invalidate all sessions for a user (password change, admin action)
   */
  async invalidateAllUserSessions(
    userId: string,
    reason: string = 'password_change'
  ): Promise<number> {
    const sessions = userSessions.get(userId);
    if (!sessions) return 0;

    let count = 0;
    for (const sessionId of sessions) {
      const session = sessionStore.get(sessionId);
      if (session) {
        this.logEvent(session, SessionEventType.FORCED_LOGOUT, { reason });
        sessionStore.delete(sessionId);
        count++;
      }
    }

    userSessions.delete(userId);
    return count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = userSessions.get(userId);
    if (!sessionIds) return [];

    const sessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = sessionStore.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Force logout (admin function)
   */
  async forceLogout(sessionId: string, adminUserId: string): Promise<void> {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    this.logEvent(session, SessionEventType.FORCED_LOGOUT, { adminUserId });
    await this.invalidateSession(sessionId, 'admin_forced');
  }

  /**
   * Get secure cookie options
   */
  getCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookieAttributes,
      sameSite: 'strict',
      path: '/',
      maxAge: this.config.absoluteTimeoutMs,
    };
  }

  /**
   * Get session events for audit
   */
  getSessionEvents(
    userId?: string,
    startDate?: Date,
    endDate?: Date,
    eventType?: SessionEventType
  ): SessionEvent[] {
    return sessionEvents.filter((event) => {
      if (userId && event.userId !== userId) return false;
      if (startDate && event.timestamp < startDate) return false;
      if (endDate && event.timestamp > endDate) return false;
      if (eventType && event.eventType !== eventType) return false;
      return true;
    });
  }

  /**
   * Update session privileges (after MFA verification, role change, etc.)
   */
  async updateSessionPrivileges(
    sessionId: string,
    privileges: string[],
    mfaVerified?: boolean
  ): Promise<Session | null> {
    const session = sessionStore.get(sessionId);
    if (!session) return null;

    session.privileges = privileges;
    if (mfaVerified !== undefined) {
      session.mfaVerified = mfaVerified;
    }

    // Regenerate session ID on privilege escalation
    if (this.config.regenerateOnAuth) {
      return this.regenerateSession(sessionId);
    }

    sessionStore.set(sessionId, session);
    return session;
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [sessionId, session] of sessionStore.entries()) {
      const idleTime = now.getTime() - session.lastActivityAt.getTime();

      if (now >= session.expiresAt || idleTime > this.config.idleTimeoutMs) {
        await this.invalidateSession(sessionId, 'cleanup');
        count++;
      }
    }

    return count;
  }

  // Private helpers

  private generateSessionId(): string {
    return randomBytes(this.config.sessionIdLength).toString('hex');
  }

  private generateFingerprint(ip: string, userAgent: string): string {
    // Create a fingerprint from user agent (not IP to allow mobility)
    const data = userAgent.toLowerCase();
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private async getOldestSession(userId: string): Promise<string | null> {
    const sessionIds = userSessions.get(userId);
    if (!sessionIds || sessionIds.size === 0) return null;

    let oldest: Session | null = null;
    let oldestId: string | null = null;

    for (const sessionId of sessionIds) {
      const session = sessionStore.get(sessionId);
      if (session && (!oldest || session.createdAt < oldest.createdAt)) {
        oldest = session;
        oldestId = sessionId;
      }
    }

    return oldestId;
  }

  private logEvent(
    session: Session,
    eventType: SessionEventType,
    details?: Record<string, unknown>
  ): void {
    const event: SessionEvent = {
      id: randomBytes(16).toString('hex'),
      sessionId: session.id,
      userId: session.userId,
      eventType,
      timestamp: new Date(),
      ip: session.ip,
      userAgent: session.userAgent,
      details,
    };

    sessionEvents.push(event);

    // Keep only last 10000 events in memory
    if (sessionEvents.length > 10000) {
      sessionEvents.shift();
    }

    // Log to console (integrate with audit service in production)
    console.log(
      `[Session] ${eventType}: user=${session.userId} session=${session.id.substring(0, 8)}...`
    );
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
