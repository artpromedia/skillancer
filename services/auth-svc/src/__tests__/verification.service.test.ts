/**
 * @module @skillancer/auth-svc/__tests__/verification.service.test
 * Unit tests for VerificationService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock PersonaService singleton - must be before imports
const mockPersonaService = {
  isConfigured: vi.fn(() => true),
  getTemplateId: vi.fn((type: string) => `tmpl_${type.toLowerCase()}`),
  createInquiry: vi.fn(),
  resumeInquiry: vi.fn(),
  getInquiry: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  mapInquiryStatus: vi.fn((status: string) => {
    const map: Record<string, string> = {
      created: 'PENDING',
      pending: 'PENDING',
      completed: 'COMPLETED',
      approved: 'APPROVED',
      declined: 'DECLINED',
      expired: 'EXPIRED',
    };
    return map[status] ?? 'PENDING';
  }),
  getInquiryExpiryDate: vi.fn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
};

// Mock dependencies - hoisted automatically
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

// Mock config
vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    persona: {
      apiKey: 'persona_test_key',
      apiVersion: '2023-01-05',
      baseUrl: 'https://withpersona.com/api/v1',
      webhookSecret: 'test_webhook_secret',
      templates: {
        basic: 'tmpl_basic',
        enhanced: 'tmpl_enhanced',
        premium: 'tmpl_premium',
      },
    },
    jwt: {
      secret: 'test-jwt-secret-for-testing-only',
    },
    redis: {
      url: 'redis://localhost:6379',
    },
    appUrl: 'http://localhost:3000',
  })),
}));

// Mock PersonaService module - return the singleton mock
vi.mock('../services/persona.service.js', () => ({
  getPersonaService: () => mockPersonaService,
  PersonaService: vi.fn(() => mockPersonaService),
}));

// Create mock Prisma client
const createMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  verificationInquiry: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  userVerificationBadge: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  verificationDocument: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
});

import { VerificationService } from '../services/verification.service.js';

describe('VerificationService', () => {
  let verificationService: VerificationService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    emailVerified: true,
    identityVerified: false,
    verificationTier: null,
  };

  const mockInquiry = {
    id: 'inquiry-123',
    userId: 'user-123',
    personaInquiryId: 'inq_abc123',
    personaTemplateId: 'tmpl_basic',
    verificationType: 'BASIC',
    status: 'PENDING',
    initiatedAt: new Date(),
    completedAt: null,
    verificationLevel: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    verificationService = new VerificationService(mockPrisma as any);

    // Reset default mock implementations
    mockPersonaService.isConfigured.mockReturnValue(true);
    mockPersonaService.getTemplateId.mockImplementation(
      (type: string) => `tmpl_${type.toLowerCase()}`
    );
    mockPersonaService.mapInquiryStatus.mockImplementation((status: string) => {
      const map: Record<string, string> = {
        created: 'PENDING',
        pending: 'PENDING',
        completed: 'COMPLETED',
        approved: 'APPROVED',
        declined: 'DECLINED',
        expired: 'EXPIRED',
      };
      return map[status] ?? 'PENDING';
    });
    mockPersonaService.getInquiryExpiryDate.mockReturnValue(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('startVerification', () => {
    it('should throw error when Persona is not configured', async () => {
      mockPersonaService.isConfigured.mockReturnValue(false);

      await expect(
        verificationService.startVerification({
          userId: 'user-123',
          verificationType: 'BASIC',
        })
      ).rejects.toThrow('Identity verification service not configured');
    });

    it('should resume existing pending inquiry', async () => {
      mockPersonaService.isConfigured.mockReturnValue(true);
      mockPrisma.verificationInquiry.findFirst.mockResolvedValue(mockInquiry);
      mockPersonaService.resumeInquiry.mockResolvedValue({
        meta: { 'session-token': 'resumed_session_token' },
      });

      const result = await verificationService.startVerification({
        userId: 'user-123',
        verificationType: 'BASIC',
      });

      expect(result.inquiryId).toBe('inquiry-123');
      expect(result.sessionToken).toBe('resumed_session_token');
      expect(mockPersonaService.resumeInquiry).toHaveBeenCalledWith('inq_abc123');
    });

    it('should create new inquiry when no pending exists', async () => {
      mockPrisma.verificationInquiry.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      mockPersonaService.createInquiry.mockResolvedValue({
        data: {
          id: 'inq_new123',
          type: 'inquiry',
          attributes: {
            status: 'created',
            'reference-id': 'user-123',
          },
        },
        meta: {
          'session-token': 'new_session_token',
        },
      });

      mockPrisma.verificationInquiry.create.mockResolvedValue({
        ...mockInquiry,
        id: 'inquiry-new',
        personaInquiryId: 'inq_new123',
      });

      const result = await verificationService.startVerification({
        userId: 'user-123',
        verificationType: 'BASIC',
        redirectUri: 'http://localhost:3000/verification/callback',
      });

      expect(result.inquiryId).toBe('inquiry-new');
      expect(result.personaInquiryId).toBe('inq_new123');
      expect(result.sessionToken).toBe('new_session_token');
      expect(mockPersonaService.createInquiry).toHaveBeenCalled();
      expect(mockPrisma.verificationInquiry.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockPersonaService.isConfigured.mockReturnValue(true);
      mockPrisma.verificationInquiry.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        verificationService.startVerification({
          userId: 'nonexistent-user',
          verificationType: 'BASIC',
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return null for non-existent inquiry', async () => {
      mockPrisma.verificationInquiry.findFirst.mockResolvedValue(null);

      const result = await verificationService.getVerificationStatus('inquiry-999', 'user-123');

      expect(result).toBeNull();
    });

    it('should return inquiry status for valid inquiry', async () => {
      mockPrisma.verificationInquiry.findFirst.mockResolvedValue(mockInquiry);

      const result = await verificationService.getVerificationStatus('inquiry-123', 'user-123');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('PENDING');
      expect(result?.verificationType).toBe('BASIC');
    });
  });

  describe('getVerificationHistory', () => {
    it('should return empty history for users with no verifications', async () => {
      mockPrisma.verificationInquiry.findMany.mockResolvedValue([]);
      mockPrisma.userVerificationBadge.findMany.mockResolvedValue([]);

      const result = await verificationService.getVerificationHistory('user-123');

      expect(result.inquiries).toEqual([]);
      expect(result.currentBadges).toEqual([]);
      expect(result.highestLevel).toBe('NONE');
    });

    it('should return verification history with badges', async () => {
      const mockHistory = [{ ...mockInquiry, status: 'APPROVED', verificationLevel: 'BASIC' }];
      const mockBadges = [
        {
          id: 'badge-1',
          userId: 'user-123',
          level: 'BASIC',
          grantedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      ];

      mockPrisma.verificationInquiry.findMany.mockResolvedValue(mockHistory);
      mockPrisma.userVerificationBadge.findMany.mockResolvedValue(mockBadges);

      const result = await verificationService.getVerificationHistory('user-123');

      expect(result.inquiries).toHaveLength(1);
      expect(result.currentBadges).toHaveLength(1);
      expect(result.highestLevel).toBe('BASIC');
    });
  });

  describe('processWebhook', () => {
    const mockPersonaInquiry = {
      id: 'inq_abc123',
      type: 'inquiry',
      attributes: {
        status: 'completed',
        'reference-id': 'user-123',
      },
    };

    it('should return failure for unknown inquiry', async () => {
      mockPrisma.verificationInquiry.findUnique.mockResolvedValue(null);

      const result = await verificationService.processWebhook(
        'inquiry.completed',
        mockPersonaInquiry as any,
        []
      );

      expect(result.success).toBe(false);
      expect(result.inquiryId).toBeNull();
    });

    it('should process inquiry completion event', async () => {
      const inquiryWithUser = {
        ...mockInquiry,
        user: mockUser,
      };
      mockPrisma.verificationInquiry.findUnique.mockResolvedValue(inquiryWithUser);
      mockPrisma.verificationInquiry.update.mockResolvedValue({
        ...mockInquiry,
        status: 'COMPLETED',
      });

      const result = await verificationService.processWebhook(
        'inquiry.completed',
        mockPersonaInquiry as any,
        []
      );

      expect(result.eventType).toBe('inquiry.completed');
      expect(mockPrisma.verificationInquiry.update).toHaveBeenCalled();
    });
  });
});
