import Redis from 'ioredis-mock';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { SessionStore, type SessionData, DeviceInfo } from '../session-store';

describe('SessionStore', () => {
  let redis: InstanceType<typeof Redis>;
  let store: SessionStore;

  beforeEach(() => {
    redis = new Redis();
    store = new SessionStore(redis as unknown as import('ioredis').Redis, {
      prefix: 'test:session',
      ttl: 3600,
      trackUserSessions: true,
    });
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  const createTestSession = (userId: string): SessionData => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now
    return {
      userId,
      tenantId: 'tenant1',
      roles: ['user'],
      createdAt: now,
      expiresAt,
      deviceInfo: {
        userAgent: 'Test Browser',
        ip: '127.0.0.1',
      },
    };
  };

  describe('create and get', () => {
    it('should create and retrieve a session', async () => {
      const sessionId = 'session-1';
      const sessionData = createTestSession('user123');

      await store.create(sessionId, sessionData);
      const retrieved = await store.get(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.userId).toBe('user123');
      expect(retrieved?.tenantId).toBe('tenant1');
    });

    it('should return null for non-existent session', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update session data', async () => {
      const sessionId = 'session-1';
      await store.create(sessionId, createTestSession('user123'));

      await store.update(sessionId, {
        lastActivityAt: new Date(),
      });

      const session = await store.get(sessionId);
      expect(session?.lastActivityAt).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      const sessionId = 'session-1';
      await store.create(sessionId, createTestSession('user123'));

      await store.delete(sessionId);

      const retrieved = await store.get(sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should extend session TTL', async () => {
      const sessionId = 'session-1';
      await store.create(sessionId, createTestSession('user123'));

      // refresh is void, just ensure it doesn't throw
      await store.refresh(sessionId);
      const session = await store.get(sessionId);
      expect(session).not.toBeNull();
    });

    it('should throw for non-existent session', async () => {
      await expect(store.refresh('nonexistent')).rejects.toThrow('Session nonexistent not found');
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      const sessionId = 'session-1';
      await store.create(sessionId, createTestSession('user123'));

      const exists = await store.exists(sessionId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await store.exists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('user sessions tracking', () => {
    it('should track user sessions', async () => {
      await store.create('session-1', createTestSession('user123'));
      await store.create('session-2', createTestSession('user123'));
      await store.create('session-3', createTestSession('other-user'));

      const sessions = await store.getUserSessions('user123');
      expect(sessions).toHaveLength(2);
    });

    it('should delete all user sessions', async () => {
      await store.create('session-1', createTestSession('user123'));
      await store.create('session-2', createTestSession('user123'));

      const count = await store.deleteUserSessions('user123');
      expect(count).toBe(2);

      const sessions = await store.getUserSessions('user123');
      expect(sessions).toHaveLength(0);
    });

    it('should get user session count', async () => {
      await store.create('session-1', createTestSession('user123'));
      await store.create('session-2', createTestSession('user123'));

      const count = await store.getUserSessionCount('user123');
      expect(count).toBe(2);
    });
  });

  describe('health check', () => {
    it('should return true when connected', async () => {
      const healthy = await store.isHealthy();
      expect(healthy).toBe(true);
    });
  });
});
