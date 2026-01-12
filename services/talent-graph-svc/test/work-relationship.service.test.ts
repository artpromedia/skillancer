import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkRelationshipService } from '../src/services/work-relationship.service';
import type { PrismaClient } from '@prisma/client';

// Create a mock Prisma client
function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workRelationship: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    warmIntroduction: {
      count: vi.fn(),
    },
    teamReunionMember: {
      count: vi.fn(),
    },
  } as unknown as PrismaClient;
}

describe('WorkRelationshipService', () => {
  let service: WorkRelationshipService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new WorkRelationshipService(mockPrisma);
  });

  describe('createRelationship', () => {
    it('should create a new work relationship', async () => {
      const input = {
        userId: 'user-123',
        relatedUserId: 'user-456',
        relationshipType: 'COLLEAGUE',
        company: 'Acme Corp',
        startDate: new Date('2022-01-01'),
        endDate: new Date('2024-01-01'),
        skills: ['JavaScript', 'React'],
      };

      (mockPrisma.workRelationship.findFirst as any).mockResolvedValue(null);
      (mockPrisma.workRelationship.create as any).mockResolvedValue({
        id: 'rel-123',
        ...input,
        strength: 'STRONG', // 24 months -> STRONG
        verified: false,
        relatedUser: {
          id: 'user-456',
          firstName: 'Jane',
          lastName: 'Doe',
        },
      });

      const result = await service.createRelationship(input);

      expect(result).toBeDefined();
      expect(result.id).toBe('rel-123');
      expect(result.strength).toBe('STRONG');
      expect(result.verified).toBe(false);
    });

    it('should set strength to WEAK for short-term relationships', async () => {
      const input = {
        userId: 'user-123',
        relatedUserId: 'user-456',
        relationshipType: 'COLLEAGUE',
        company: 'Acme Corp',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'), // 2 months
      };

      (mockPrisma.workRelationship.findFirst as any).mockResolvedValue(null);
      (mockPrisma.workRelationship.create as any).mockResolvedValue({
        id: 'rel-123',
        ...input,
        strength: 'WEAK',
        verified: false,
        relatedUser: {},
      });

      const result = await service.createRelationship(input);

      expect(result.strength).toBe('WEAK');
    });

    it('should throw error if relationship already exists', async () => {
      (mockPrisma.workRelationship.findFirst as any).mockResolvedValue({
        id: 'existing-rel',
      });

      await expect(
        service.createRelationship({
          userId: 'user-123',
          relatedUserId: 'user-456',
          relationshipType: 'COLLEAGUE',
          company: 'Acme Corp',
          startDate: new Date(),
        })
      ).rejects.toThrow('Relationship already exists');
    });
  });

  describe('getRelationshipById', () => {
    it('should return relationship with user details', async () => {
      const mockRelationship = {
        id: 'rel-123',
        userId: 'user-123',
        relatedUserId: 'user-456',
        user: { id: 'user-123', firstName: 'John' },
        relatedUser: { id: 'user-456', firstName: 'Jane' },
      };

      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue(mockRelationship);

      const result = await service.getRelationshipById('rel-123');

      expect(result).toEqual(mockRelationship);
    });

    it('should return null for non-existent relationship', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue(null);

      const result = await service.getRelationshipById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserRelationships', () => {
    it('should return paginated relationships', async () => {
      const mockRelationships = [
        { id: 'rel-1', userId: 'user-123', company: 'Acme' },
        { id: 'rel-2', userId: 'user-123', company: 'Tech Inc' },
      ];

      (mockPrisma.workRelationship.findMany as any).mockResolvedValue(mockRelationships);
      (mockPrisma.workRelationship.count as any).mockResolvedValue(10);

      const result = await service.getUserRelationships('user-123');

      expect(result.relationships).toHaveLength(2);
      expect(result.pagination.total).toBe(10);
    });

    it('should filter by company', async () => {
      (mockPrisma.workRelationship.findMany as any).mockResolvedValue([]);
      (mockPrisma.workRelationship.count as any).mockResolvedValue(0);

      await service.getUserRelationships('user-123', { company: 'Acme' });

      expect(mockPrisma.workRelationship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company: 'Acme',
          }),
        })
      );
    });

    it('should filter by verified status', async () => {
      (mockPrisma.workRelationship.findMany as any).mockResolvedValue([]);
      (mockPrisma.workRelationship.count as any).mockResolvedValue(0);

      await service.getUserRelationships('user-123', { verified: true });

      expect(mockPrisma.workRelationship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verified: true,
          }),
        })
      );
    });
  });

  describe('verifyRelationship', () => {
    it('should verify relationship when requested by related user', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        userId: 'user-123',
        relatedUserId: 'user-456',
      });
      (mockPrisma.workRelationship.update as any).mockResolvedValue({
        id: 'rel-123',
        verified: true,
        verifiedAt: new Date(),
      });

      const result = await service.verifyRelationship('rel-123', 'user-456');

      expect(result.verified).toBe(true);
      expect(result.verifiedAt).toBeDefined();
    });

    it('should throw error if verifier is not the related user', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        userId: 'user-123',
        relatedUserId: 'user-456',
      });

      await expect(
        service.verifyRelationship('rel-123', 'user-789')
      ).rejects.toThrow('Only the related user can verify');
    });

    it('should throw error for non-existent relationship', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue(null);

      await expect(
        service.verifyRelationship('non-existent', 'user-456')
      ).rejects.toThrow('Relationship not found');
    });
  });

  describe('addEndorsement', () => {
    it('should add endorsement from related user', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        relatedUserId: 'user-456',
      });
      (mockPrisma.workRelationship.update as any).mockResolvedValue({
        id: 'rel-123',
        endorsement: 'Great to work with!',
        endorsedAt: new Date(),
      });

      const result = await service.addEndorsement('rel-123', 'Great to work with!', 'user-456');

      expect(result.endorsement).toBe('Great to work with!');
      expect(result.endorsedAt).toBeDefined();
    });

    it('should throw error if endorser is not the related user', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        relatedUserId: 'user-456',
      });

      await expect(
        service.addEndorsement('rel-123', 'Endorsement', 'user-999')
      ).rejects.toThrow('Only the related user can endorse');
    });
  });

  describe('getNetworkStats', () => {
    it('should return network statistics', async () => {
      (mockPrisma.workRelationship.findMany as any).mockResolvedValue([
        { company: 'Acme', strength: 'STRONG' },
        { company: 'Tech Inc', strength: 'MODERATE' },
        { company: 'Acme', strength: 'STRONG' },
      ]);
      (mockPrisma.warmIntroduction.count as any).mockResolvedValueOnce(5); // introsMade
      (mockPrisma.warmIntroduction.count as any).mockResolvedValueOnce(3); // introsReceived
      (mockPrisma.teamReunionMember.count as any).mockResolvedValue(2);

      const result = await service.getNetworkStats('user-123');

      expect(result.totalConnections).toBe(3);
      expect(result.strongConnections).toBe(2);
      expect(result.companiesWorkedWith).toBe(2); // Unique companies
      expect(result.introductionsMade).toBe(5);
      expect(result.introductionsReceived).toBe(3);
      expect(result.teamReunionsJoined).toBe(2);
    });
  });

  describe('getMutualConnections', () => {
    it('should find mutual connections between two users', async () => {
      (mockPrisma.workRelationship.findMany as any)
        .mockResolvedValueOnce([
          { userId: 'user-1', relatedUserId: 'mutual-1' },
          { userId: 'user-1', relatedUserId: 'mutual-2' },
          { userId: 'user-1', relatedUserId: 'only-1' },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-2', relatedUserId: 'mutual-1' },
          { userId: 'user-2', relatedUserId: 'mutual-2' },
          { userId: 'user-2', relatedUserId: 'only-2' },
        ]);

      (mockPrisma.user.findMany as any).mockResolvedValue([
        { id: 'mutual-1', firstName: 'Mutual', lastName: 'One' },
        { id: 'mutual-2', firstName: 'Mutual', lastName: 'Two' },
      ]);

      const result = await service.getMutualConnections('user-1', 'user-2');

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteRelationship', () => {
    it('should delete relationship when requested by participant', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        userId: 'user-123',
        relatedUserId: 'user-456',
      });
      (mockPrisma.workRelationship.delete as any).mockResolvedValue({});

      const result = await service.deleteRelationship('rel-123', 'user-123');

      expect(result.success).toBe(true);
    });

    it('should throw error if requester is not a participant', async () => {
      (mockPrisma.workRelationship.findUnique as any).mockResolvedValue({
        id: 'rel-123',
        userId: 'user-123',
        relatedUserId: 'user-456',
      });

      await expect(
        service.deleteRelationship('rel-123', 'user-999')
      ).rejects.toThrow('Not authorized to delete');
    });
  });
});
