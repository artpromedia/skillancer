/**
 * @module @skillancer/audit-svc/tests/audit-log.service.test
 * Unit tests for audit log service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';

// Mock dependencies
vi.mock('../src/repositories/audit-log.repository.js', () => ({
  insertAuditLog: vi.fn(),
  findAuditLogById: vi.fn(),
  getLastAuditLog: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    close: vi.fn(),
  })),
}));

import {
  createAuditLog,
  createAuditLogSync,
  calculateIntegrityHash,
  verifyIntegrity,
  redactSensitiveData,
} from '../src/services/audit-log.service.js';
import * as repo from '../src/repositories/audit-log.repository.js';
import { ActorType, AuditCategory } from '../src/types/index.js';

describe('Audit Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAuditLog', () => {
    const validParams = {
      eventType: 'USER_CREATED',
      eventCategory: AuditCategory.USER_MANAGEMENT,
      action: 'Created new user',
      actor: {
        id: 'user-123',
        type: ActorType.USER,
        email: 'test@example.com',
      },
      resource: {
        type: 'user',
        id: 'user-456',
      },
      outcome: {
        status: 'SUCCESS' as const,
        duration: 100,
      },
    };

    it('should create an audit log with all required fields', async () => {
      vi.mocked(repo.getLastAuditLog).mockResolvedValue(null);
      vi.mocked(repo.insertAuditLog).mockImplementation(async (log) => log);

      const result = await createAuditLog(validParams);

      expect(result).toBeDefined();
      expect(result.eventType).toBe('USER_CREATED');
      expect(result.eventCategory).toBe(AuditCategory.USER_MANAGEMENT);
      expect(result.actor.id).toBe('user-123');
      expect(result.resource.id).toBe('user-456');
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.integrityHash).toBeDefined();
    });

    it('should chain hash with previous log', async () => {
      const previousLog = {
        id: 'prev-log-123',
        integrityHash: 'previous-hash-abc',
        timestamp: new Date(),
      };
      vi.mocked(repo.getLastAuditLog).mockResolvedValue(previousLog as never);
      vi.mocked(repo.insertAuditLog).mockImplementation(async (log) => log);

      const result = await createAuditLog(validParams);

      expect(result.previousHash).toBe('previous-hash-abc');
    });

    it('should handle missing previous log gracefully', async () => {
      vi.mocked(repo.getLastAuditLog).mockResolvedValue(null);
      vi.mocked(repo.insertAuditLog).mockImplementation(async (log) => log);

      const result = await createAuditLog(validParams);

      expect(result.previousHash).toBeUndefined();
    });

    it('should redact sensitive data from changes', async () => {
      vi.mocked(repo.getLastAuditLog).mockResolvedValue(null);
      vi.mocked(repo.insertAuditLog).mockImplementation(async (log) => log);

      const paramsWithSensitiveData = {
        ...validParams,
        changes: {
          before: { password: 'old-secret', email: 'old@example.com' },
          after: { password: 'new-secret', email: 'new@example.com' },
        },
      };

      const result = await createAuditLog(paramsWithSensitiveData);

      expect(result.changes?.before?.password).toBe('[REDACTED]');
      expect(result.changes?.after?.password).toBe('[REDACTED]');
      expect(result.changes?.before?.email).toBe('old@example.com');
      expect(result.changes?.after?.email).toBe('new@example.com');
    });
  });

  describe('calculateIntegrityHash', () => {
    it('should calculate consistent hash for same data', () => {
      const log = {
        id: 'test-123',
        eventType: 'TEST_EVENT',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'test action',
      };

      const hash1 = calculateIntegrityHash(log as never);
      const hash2 = calculateIntegrityHash(log as never);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different data', () => {
      const log1 = {
        id: 'test-123',
        eventType: 'EVENT_A',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'action A',
      };

      const log2 = {
        ...log1,
        eventType: 'EVENT_B',
      };

      const hash1 = calculateIntegrityHash(log1 as never);
      const hash2 = calculateIntegrityHash(log2 as never);

      expect(hash1).not.toBe(hash2);
    });

    it('should include previousHash in calculation when present', () => {
      const logWithoutPrev = {
        id: 'test-123',
        eventType: 'TEST_EVENT',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'test action',
      };

      const logWithPrev = {
        ...logWithoutPrev,
        previousHash: 'prev-hash-abc',
      };

      const hash1 = calculateIntegrityHash(logWithoutPrev as never);
      const hash2 = calculateIntegrityHash(logWithPrev as never);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyIntegrity', () => {
    it('should return true for valid integrity hash', () => {
      const log = {
        id: 'test-123',
        eventType: 'TEST_EVENT',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'test action',
        integrityHash: '', // Will be set below
      };

      // Calculate the correct hash
      const hashData = {
        id: log.id,
        eventType: log.eventType,
        actor: log.actor,
        resource: log.resource,
        timestamp: log.timestamp.toISOString(),
        action: log.action,
      };
      log.integrityHash = createHash('sha256').update(JSON.stringify(hashData)).digest('hex');

      const result = verifyIntegrity(log as never);

      expect(result).toBe(true);
    });

    it('should return false for tampered data', () => {
      const log = {
        id: 'test-123',
        eventType: 'TEST_EVENT',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'test action',
        integrityHash: 'invalid-hash-that-wont-match',
      };

      const result = verifyIntegrity(log as never);

      expect(result).toBe(false);
    });

    it('should return false for missing integrity hash', () => {
      const log = {
        id: 'test-123',
        eventType: 'TEST_EVENT',
        actor: { id: 'actor-1', type: ActorType.USER },
        resource: { type: 'test', id: 'res-1' },
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        action: 'test action',
      };

      const result = verifyIntegrity(log as never);

      expect(result).toBe(false);
    });
  });

  describe('redactSensitiveData', () => {
    it('should redact password fields', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };

      const result = redactSensitiveData(data);

      expect(result.password).toBe('[REDACTED]');
      expect(result.username).toBe('john');
      expect(result.email).toBe('john@example.com');
    });

    it('should redact token fields', () => {
      const data = {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        refreshToken: 'refresh-token-value',
        sessionId: 'session-123',
      };

      const result = redactSensitiveData(data);

      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
      expect(result.sessionId).toBe('session-123');
    });

    it('should redact credit card fields', () => {
      const data = {
        cardNumber: '4111111111111111',
        cvv: '123',
        expiryDate: '12/25',
        amount: 100,
      };

      const result = redactSensitiveData(data);

      expect(result.cardNumber).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
      expect(result.expiryDate).toBe('12/25');
      expect(result.amount).toBe(100);
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          id: '123',
          credentials: {
            password: 'secret',
            apiKey: 'key-123',
          },
        },
      };

      const result = redactSensitiveData(data);

      expect(result.user.id).toBe('123');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.apiKey).toBe('[REDACTED]');
    });

    it('should handle null and undefined values', () => {
      const data = {
        name: 'John',
        password: null,
        token: undefined,
      };

      const result = redactSensitiveData(data);

      expect(result.name).toBe('John');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const data = {
        items: [
          { id: 1, secret: 'value1' },
          { id: 2, secret: 'value2' },
        ],
      };

      const result = redactSensitiveData(data);

      expect(result.items[0].id).toBe(1);
      expect(result.items[0].secret).toBe('[REDACTED]');
      expect(result.items[1].id).toBe(2);
      expect(result.items[1].secret).toBe('[REDACTED]');
    });
  });
});
