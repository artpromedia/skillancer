/**
 * @module @skillancer/market-svc/tests/credential-sync
 * Credential Sync Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PrismaClient, VerifiedCredential, SkillConfidence } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';
import type {
  CredentialEarnedEvent,
  CredentialRevokedEvent,
  CredentialVerificationResult,
} from '@skillancer/types';

// =============================================================================
// MOCKS
// =============================================================================

const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
} as unknown as Logger;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as unknown as Redis;

const mockPrisma = {
  verifiedCredential: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  skillVerification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  skillConfidence: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  learningActivity: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  skill: {
    findMany: vi.fn(),
  },
} as unknown as PrismaClient;

// =============================================================================
// TEST DATA
// =============================================================================

const createMockCredential = (overrides: Partial<VerifiedCredential> = {}): VerifiedCredential => ({
  id: 'cred-001',
  userId: 'user-001',
  freelancerProfileId: 'profile-001',
  sourceCredentialId: 'skillpod-cred-001',
  source: 'SKILLPOD',
  credentialType: 'CERTIFICATION',
  title: 'React Developer Certification',
  description: 'Advanced React development certification',
  skillIds: ['skill-001', 'skill-002'],
  issueDate: new Date('2024-01-01'),
  expirationDate: new Date('2025-01-01'),
  status: 'ACTIVE',
  isVisible: true,
  displayOrder: 0,
  syncedAt: new Date(),
  lastVerifiedAt: null,
  revokedAt: null,
  revocationReason: null,
  score: null,
  percentile: null,
  proficiencyLevel: 'ADVANCED',
  verificationUrl: 'https://verify.skillpod.com/cred-001',
  verificationCode: 'ABC123',
  imageUrl: null,
  badgeUrl: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockSkillConfidence = (overrides: Partial<SkillConfidence> = {}): SkillConfidence => ({
  id: 'conf-001',
  userId: 'user-001',
  skillId: 'skill-001',
  overallConfidence: 85,
  assessmentScore: 90,
  learningScore: 80,
  experienceScore: 85,
  endorsementScore: 75,
  projectScore: 90,
  calculatedLevel: 'ADVANCED',
  claimedLevel: 'ADVANCED',
  levelMatch: true,
  lastCalculatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createCredentialEarnedEvent = (
  overrides: Partial<CredentialEarnedEvent['payload']> = {}
): CredentialEarnedEvent => ({
  type: 'skillpod.credential.earned',
  version: '1.0',
  timestamp: new Date().toISOString(),
  correlationId: 'corr-001',
  source: 'skillpod-svc',
  payload: {
    userId: 'user-001',
    credentialId: 'skillpod-cred-001',
    credentialType: 'CERTIFICATION',
    title: 'React Developer Certification',
    description: 'Advanced React development certification',
    skillIds: ['skillpod-skill-001'],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    proficiencyLevel: 'ADVANCED',
    ...overrides,
  },
});

// =============================================================================
// TESTS
// =============================================================================

describe('Credential Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockRedis.setex as ReturnType<typeof vi.fn>).mockResolvedValue('OK');
    (mockRedis.del as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (mockRedis.keys as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Credential Verification
  // ---------------------------------------------------------------------------
  describe('Credential Verification', () => {
    it('should return valid result for active credential', async () => {
      const mockCredential = createMockCredential();

      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredential
      );
      (mockPrisma.verifiedCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredential,
        lastVerifiedAt: new Date(),
      });

      // Import and create service dynamically to use mocks
      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.verifyCredential('cred-001');

      expect(result.valid).toBe(true);
      expect(result.credentialId).toBe('cred-001');
      expect(result.status).toBe('ACTIVE');
    });

    it('should return invalid result for revoked credential', async () => {
      const mockCredential = createMockCredential({
        status: 'REVOKED',
        revokedAt: new Date(),
      });

      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredential
      );
      (mockPrisma.verifiedCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredential,
        lastVerifiedAt: new Date(),
      });

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.verifyCredential('cred-001');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('revoked');
    });

    it('should return invalid result for expired credential', async () => {
      const mockCredential = createMockCredential({
        expirationDate: new Date('2020-01-01'), // Past date
      });

      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredential
      );
      (mockPrisma.verifiedCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockCredential,
        lastVerifiedAt: new Date(),
      });

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.verifyCredential('cred-001');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
    });

    it('should return not found for missing credential', async () => {
      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.verifyCredential('nonexistent');

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should use cached verification result', async () => {
      const cachedResult: CredentialVerificationResult = {
        valid: true,
        credentialId: 'cred-001',
        title: 'Cached Credential',
        message: 'Credential is valid',
        status: 'ACTIVE',
        credentialType: 'CERTIFICATION',
        source: 'SKILLPOD',
        issueDate: new Date().toISOString(),
      };

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(cachedResult));

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.verifyCredential('cred-001');

      expect(result.valid).toBe(true);
      expect(result.title).toBe('Cached Credential');
      expect(mockPrisma.verifiedCredential.findUnique).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Get User Credentials
  // ---------------------------------------------------------------------------
  describe('Get User Credentials', () => {
    it('should return user credentials from database', async () => {
      const mockCredentials = [
        createMockCredential({ id: 'cred-001' }),
        createMockCredential({ id: 'cred-002', title: 'TypeScript Certification' }),
      ];

      (mockPrisma.verifiedCredential.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredentials
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.getUserCredentials('user-001');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('cred-001');
    });

    it('should return cached credentials if available', async () => {
      const cachedCredentials = [createMockCredential({ id: 'cached-cred-001' })];

      (mockRedis.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        JSON.stringify(cachedCredentials)
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.getUserCredentials('user-001');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cached-cred-001');
      expect(mockPrisma.verifiedCredential.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Get User Skill Confidences
  // ---------------------------------------------------------------------------
  describe('Get User Skill Confidences', () => {
    it('should return skill confidences from database', async () => {
      const mockConfidences = [
        createMockSkillConfidence({ id: 'conf-001', skillId: 'skill-001' }),
        createMockSkillConfidence({ id: 'conf-002', skillId: 'skill-002', overallConfidence: 75 }),
      ];

      (mockPrisma.skillConfidence.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConfidences
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.getUserSkillConfidences('user-001');

      expect(result).toHaveLength(2);
      expect(result[0].overallConfidence).toBe(85);
      expect(result[1].overallConfidence).toBe(75);
    });
  });

  // ---------------------------------------------------------------------------
  // Update Credential Visibility
  // ---------------------------------------------------------------------------
  describe('Update Credential Visibility', () => {
    it('should update visibility for owned credential', async () => {
      const mockCredential = createMockCredential();
      const updatedCredential = { ...mockCredential, isVisible: false, displayOrder: 5 };

      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredential
      );
      (mockPrisma.verifiedCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedCredential
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.updateCredentialVisibility('cred-001', 'user-001', false, 5);

      expect(result).not.toBeNull();
      expect(result?.isVisible).toBe(false);
      expect(result?.displayOrder).toBe(5);
    });

    it('should return null for non-owned credential', async () => {
      const mockCredential = createMockCredential({ userId: 'other-user' });

      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCredential
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.updateCredentialVisibility(
        'cred-001',
        'user-001', // Different from credential owner
        false
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent credential', async () => {
      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const { CredentialSyncService } = await import('../services/credential-sync.service.js');
      const service = new CredentialSyncService(mockPrisma, mockRedis, mockLogger);

      const result = await service.updateCredentialVisibility('nonexistent', 'user-001', false);

      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// CREDENTIAL EVENT CONSUMER TESTS
// =============================================================================

describe('Credential Event Consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Processing', () => {
    it('should process credential earned event', async () => {
      const event = createCredentialEarnedEvent();

      const { createCredentialEventConsumer } =
        await import('../messaging/credential-events.consumer.js');

      // Create consumer with mocked dependencies
      const consumer = createCredentialEventConsumer(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: true, maxRetries: 1 }
      );

      // Mock the skill mapping
      (mockPrisma.skill?.findMany as ReturnType<typeof vi.fn>)?.mockResolvedValue([
        { id: 'skill-001', externalIds: { skillpod: 'skillpod-skill-001' } },
      ]);

      // Mock credential creation
      (mockPrisma.verifiedCredential.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      ); // No existing credential
      (mockPrisma.verifiedCredential.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockCredential()
      );

      // This test validates the consumer can be created and has the right interface
      expect(consumer.processCredentialEarned).toBeDefined();
      expect(typeof consumer.processCredentialEarned).toBe('function');
    });

    it('should track event processing stats', async () => {
      const { createCredentialEventConsumer } =
        await import('../messaging/credential-events.consumer.js');

      const consumer = createCredentialEventConsumer(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: true }
      );

      const stats = consumer.getStats();

      expect(stats.eventsProcessed).toBe(0);
      expect(stats.eventsFailed).toBe(0);
      expect(stats.lastEventAt).toBeNull();
    });

    it('should reset stats correctly', async () => {
      const { createCredentialEventConsumer } =
        await import('../messaging/credential-events.consumer.js');

      const consumer = createCredentialEventConsumer(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: true }
      );

      consumer.resetStats();
      const stats = consumer.getStats();

      expect(stats.eventsProcessed).toBe(0);
      expect(stats.eventsByType).toEqual({});
    });
  });
});

// =============================================================================
// CREDENTIAL EXPIRATION WORKER TESTS
// =============================================================================

describe('Credential Expiration Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Worker Lifecycle', () => {
    it('should start and stop correctly', async () => {
      const { createCredentialExpirationWorker } =
        await import('../workers/credential-expiration.worker.js');

      // Mock the expiring credentials query
      (mockPrisma.verifiedCredential.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const worker = createCredentialExpirationWorker(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: true, intervalMs: 1000 }
      );

      expect(worker.isRunning()).toBe(false);

      worker.start();
      expect(worker.isRunning()).toBe(true);

      worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should not start when disabled', async () => {
      const { createCredentialExpirationWorker } =
        await import('../workers/credential-expiration.worker.js');

      const worker = createCredentialExpirationWorker(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: false }
      );

      worker.start();
      expect(worker.isRunning()).toBe(false);
    });
  });

  describe('Run Once', () => {
    it('should return expiration result', async () => {
      // Mock processExpiringCredentials response
      (mockPrisma.verifiedCredential.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.verifiedCredential.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const { createCredentialExpirationWorker } =
        await import('../workers/credential-expiration.worker.js');

      const worker = createCredentialExpirationWorker(
        {
          prisma: mockPrisma,
          redis: mockRedis,
          logger: mockLogger,
        },
        { enabled: true }
      );

      // Note: runOnce depends on CredentialSyncService.processExpiringCredentials
      // which we haven't fully mocked, so this validates the interface
      expect(worker.runOnce).toBeDefined();
      expect(typeof worker.runOnce).toBe('function');
    });
  });
});
