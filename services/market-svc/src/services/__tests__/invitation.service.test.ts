/**
 * @module @skillancer/market-svc/services/__tests__/invitation
 * Unit tests for the invitation service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock ProjectService
vi.mock('../project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    getProject: vi.fn().mockResolvedValue({
      id: 'project-123',
      clientId: 'client-123',
      title: 'Test Project',
      status: 'PUBLISHED',
      client: { displayName: 'Test Client' },
    }),
  })),
}));

// Mock InvitationRepository
const mockInvitationRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByJobAndInvitee: vi.fn(),
  findSentByUser: vi.fn(),
  findReceivedByUser: vi.fn(),
  findByProjectId: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  markAsViewed: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
  exists: vi.fn(),
  countPendingByProject: vi.fn(),
  countPendingByUser: vi.fn(),
  expireOldInvitations: vi.fn(),
};

vi.mock('../../repositories/invitation.repository.js', () => ({
  InvitationRepository: vi.fn().mockImplementation(() => mockInvitationRepository),
}));

// Create mock instances
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
} as any;

const mockRedis = {
  lpush: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { InvitationService } from '../invitation.service.js';
import { BiddingError, BiddingErrorCode } from '../../errors/bidding.errors.js';

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.lpush.mockResolvedValue(1);
    service = new InvitationService(mockPrisma, mockRedis, mockLogger);
  });

  describe('sendInvitation', () => {
    const validInput = {
      jobId: 'project-123',
      freelancerId: 'freelancer-123',
      message: 'I would like to invite you to bid on my project.',
    };

    it('should send invitation successfully', async () => {
      mockInvitationRepository.exists.mockResolvedValue(false);
      mockInvitationRepository.countPendingByProject.mockResolvedValue(5);
      mockInvitationRepository.countPendingByUser.mockResolvedValue(10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'freelancer-123',
        role: 'FREELANCER',
        displayName: 'John Freelancer',
      });
      mockInvitationRepository.create.mockResolvedValue({
        id: 'invitation-123',
        ...validInput,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const result = await service.sendInvitation('client-123', validInput);

      expect(result.id).toBe('invitation-123');
      expect(mockInvitationRepository.create).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'invitation:notifications',
        expect.stringContaining('INVITATION_RECEIVED')
      );
    });

    it('should reject duplicate invitation', async () => {
      mockInvitationRepository.exists.mockResolvedValue(true);

      await expect(service.sendInvitation('client-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_ALREADY_SENT,
      });
    });

    it('should enforce project invitation limit', async () => {
      mockInvitationRepository.exists.mockResolvedValue(false);
      mockInvitationRepository.countPendingByProject.mockResolvedValue(50);

      await expect(service.sendInvitation('client-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_LIMIT_REACHED,
      });
    });

    it('should enforce user invitation limit', async () => {
      mockInvitationRepository.exists.mockResolvedValue(false);
      mockInvitationRepository.countPendingByProject.mockResolvedValue(5);
      mockInvitationRepository.countPendingByUser.mockResolvedValue(100);

      await expect(service.sendInvitation('client-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_LIMIT_REACHED,
      });
    });

    it('should reject inviting non-existent user', async () => {
      mockInvitationRepository.exists.mockResolvedValue(false);
      mockInvitationRepository.countPendingByProject.mockResolvedValue(5);
      mockInvitationRepository.countPendingByUser.mockResolvedValue(10);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.sendInvitation('client-123', validInput)).rejects.toMatchObject({
        code: BiddingErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe('respondToInvitation', () => {
    it('should accept invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviteeId: 'freelancer-123',
        inviterId: 'client-123',
        jobId: 'project-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        job: { title: 'Test Project' },
        invitee: { displayName: 'John Freelancer' },
      });

      await service.respondToInvitation(
        { invitationId: 'invitation-123', accept: true },
        'freelancer-123'
      );

      expect(mockInvitationRepository.accept).toHaveBeenCalledWith('invitation-123');
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'invitation:notifications',
        expect.stringContaining('INVITATION_ACCEPTED')
      );
    });

    it('should decline invitation with reason', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviteeId: 'freelancer-123',
        inviterId: 'client-123',
        jobId: 'project-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        job: { title: 'Test Project' },
        invitee: { displayName: 'John Freelancer' },
      });

      await service.respondToInvitation(
        {
          invitationId: 'invitation-123',
          accept: false,
          message: 'Too busy at the moment',
        },
        'freelancer-123'
      );

      expect(mockInvitationRepository.decline).toHaveBeenCalledWith(
        'invitation-123',
        'Too busy at the moment'
      );
    });

    it('should reject response from wrong user', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviteeId: 'freelancer-123',
        status: 'PENDING',
      });

      await expect(
        service.respondToInvitation({ invitationId: 'invitation-123', accept: true }, 'other-user')
      ).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_INVITATION_RECIPIENT,
      });
    });

    it('should reject response to already responded invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviteeId: 'freelancer-123',
        status: 'ACCEPTED',
      });

      await expect(
        service.respondToInvitation(
          { invitationId: 'invitation-123', accept: false },
          'freelancer-123'
        )
      ).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_ALREADY_RESPONDED,
      });
    });

    it('should reject response to expired invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviteeId: 'freelancer-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await expect(
        service.respondToInvitation(
          { invitationId: 'invitation-123', accept: true },
          'freelancer-123'
        )
      ).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_EXPIRED,
      });
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel pending invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviterId: 'client-123',
        status: 'PENDING',
      });

      await service.cancelInvitation('invitation-123', 'client-123');

      expect(mockInvitationRepository.updateStatus).toHaveBeenCalledWith(
        'invitation-123',
        'CANCELLED'
      );
    });

    it('should reject cancellation by non-owner', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviterId: 'client-123',
        status: 'PENDING',
      });

      await expect(service.cancelInvitation('invitation-123', 'other-user')).rejects.toMatchObject({
        code: BiddingErrorCode.FORBIDDEN,
      });
    });

    it('should reject cancellation of responded invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviterId: 'client-123',
        status: 'ACCEPTED',
      });

      await expect(service.cancelInvitation('invitation-123', 'client-123')).rejects.toMatchObject({
        code: BiddingErrorCode.INVITATION_ALREADY_RESPONDED,
      });
    });
  });

  describe('resendInvitation', () => {
    it('should resend expired invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviterId: 'client-123',
        inviteeId: 'freelancer-123',
        jobId: 'project-123',
        status: 'EXPIRED',
        job: { title: 'Test Project' },
        inviter: { displayName: 'Test Client' },
      });

      await service.resendInvitation('invitation-123', 'client-123');

      expect(mockInvitationRepository.update).toHaveBeenCalledWith(
        'invitation-123',
        expect.objectContaining({
          status: 'PENDING',
          viewedAt: null,
        })
      );
    });

    it('should reject resending active invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        id: 'invitation-123',
        inviterId: 'client-123',
        status: 'PENDING',
      });

      await expect(service.resendInvitation('invitation-123', 'client-123')).rejects.toMatchObject({
        code: BiddingErrorCode.VALIDATION_ERROR,
      });
    });
  });

  describe('expireOldInvitations', () => {
    it('should expire old invitations', async () => {
      mockInvitationRepository.expireOldInvitations.mockResolvedValue(5);

      const count = await service.expireOldInvitations();

      expect(count).toBe(5);
      expect(mockInvitationRepository.expireOldInvitations).toHaveBeenCalled();
    });
  });

  describe('getSentInvitations', () => {
    it('should return sent invitations with pagination', async () => {
      mockInvitationRepository.findSentByUser.mockResolvedValue({
        invitations: [
          {
            id: 'inv-1',
            status: 'PENDING',
            inviter: { id: 'c1', displayName: 'Client' },
            invitee: { id: 'f1', displayName: 'Freelancer 1' },
            job: { id: 'p1', title: 'Project 1', slug: 'project-1' },
          },
        ],
        total: 10,
      });

      const result = await service.getSentInvitations('client-123', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getReceivedInvitations', () => {
    it('should return received invitations with pagination', async () => {
      mockInvitationRepository.findReceivedByUser.mockResolvedValue({
        invitations: [
          {
            id: 'inv-1',
            status: 'PENDING',
            inviter: { id: 'c1', displayName: 'Client' },
            invitee: { id: 'f1', displayName: 'Freelancer' },
            job: { id: 'p1', title: 'Project 1', slug: 'project-1' },
          },
        ],
        total: 5,
      });

      const result = await service.getReceivedInvitations('freelancer-123', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(5);
    });
  });
});
