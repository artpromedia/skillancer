import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient, OKRStatus } from '@prisma/client';

// Get the mocked prisma instance
const mockPrisma = new PrismaClient() as unknown as {
  objective: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  keyResult: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  keyResultUpdate: {
    create: ReturnType<typeof vi.fn>;
  };
  oKRCheckIn: {
    create: ReturnType<typeof vi.fn>;
  };
};

// Import service after mock is set up
import { OKRService, type CreateObjectiveInput, type CreateKeyResultInput } from '../src/services/okr.service';

describe('OKRService', () => {
  let service: OKRService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OKRService();
  });

  describe('createObjective', () => {
    it('should create a new objective', async () => {
      const input: CreateObjectiveInput = {
        engagementId: 'engagement-123',
        title: 'Increase Revenue',
        description: 'Grow quarterly revenue by 20%',
        ownerId: 'user-123',
        timeframe: 'Q1-2024',
      };

      const mockObjective = {
        id: 'obj-123',
        ...input,
        status: OKRStatus.NOT_STARTED,
        progress: 0,
        keyResults: [],
        parentObjective: null,
      };

      mockPrisma.objective.create.mockResolvedValue(mockObjective);

      const result = await service.createObjective(input);

      expect(result).toEqual(mockObjective);
      expect(mockPrisma.objective.create).toHaveBeenCalledWith({
        data: {
          engagementId: input.engagementId,
          title: input.title,
          description: input.description,
          ownerId: input.ownerId,
          timeframe: input.timeframe,
          startDate: undefined,
          endDate: undefined,
          parentObjectiveId: undefined,
          status: OKRStatus.NOT_STARTED,
          progress: 0,
        },
        include: {
          keyResults: true,
          parentObjective: { select: { id: true, title: true } },
        },
      });
    });
  });

  describe('getObjectives', () => {
    it('should return objectives for an engagement', async () => {
      const mockObjectives = [
        { id: 'obj-1', title: 'Objective 1', status: OKRStatus.ON_TRACK, keyResults: [] },
        { id: 'obj-2', title: 'Objective 2', status: OKRStatus.AT_RISK, keyResults: [] },
      ];

      mockPrisma.objective.findMany.mockResolvedValue(mockObjectives);

      const result = await service.getObjectives('engagement-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.objective.findMany).toHaveBeenCalledWith({
        where: { engagementId: 'engagement-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter objectives by timeframe', async () => {
      mockPrisma.objective.findMany.mockResolvedValue([]);

      await service.getObjectives('engagement-123', { timeframe: 'Q2-2024' });

      expect(mockPrisma.objective.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { engagementId: 'engagement-123', timeframe: 'Q2-2024' },
        })
      );
    });
  });

  describe('getObjective', () => {
    it('should return a single objective with full details', async () => {
      const mockObjective = {
        id: 'obj-123',
        title: 'Objective 1',
        keyResults: [{ id: 'kr-1', title: 'Key Result 1' }],
        childObjectives: [],
        checkIns: [],
      };

      mockPrisma.objective.findUnique.mockResolvedValue(mockObjective);

      const result = await service.getObjective('obj-123');

      expect(result).toEqual(mockObjective);
      expect(mockPrisma.objective.findUnique).toHaveBeenCalledWith({
        where: { id: 'obj-123' },
        include: expect.objectContaining({
          keyResults: true,
          parentObjective: true,
        }),
      });
    });

    it('should return null for non-existent objective', async () => {
      mockPrisma.objective.findUnique.mockResolvedValue(null);

      const result = await service.getObjective('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateObjective', () => {
    it('should update an objective', async () => {
      const mockUpdatedObjective = {
        id: 'obj-123',
        title: 'Updated Title',
        status: OKRStatus.ON_TRACK,
        keyResults: [],
      };

      mockPrisma.objective.update.mockResolvedValue(mockUpdatedObjective);
      mockPrisma.objective.findUnique.mockResolvedValue({
        ...mockUpdatedObjective,
        keyResults: [],
      });

      const result = await service.updateObjective('obj-123', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(mockPrisma.objective.update).toHaveBeenCalledWith({
        where: { id: 'obj-123' },
        data: { title: 'Updated Title' },
        include: { keyResults: true },
      });
    });
  });

  describe('deleteObjective', () => {
    it('should delete an objective', async () => {
      mockPrisma.objective.delete.mockResolvedValue({ id: 'obj-123' });

      await service.deleteObjective('obj-123');

      expect(mockPrisma.objective.delete).toHaveBeenCalledWith({
        where: { id: 'obj-123' },
      });
    });
  });

  describe('createKeyResult', () => {
    it('should create a key result and recalculate objective progress', async () => {
      const input: CreateKeyResultInput = {
        objectiveId: 'obj-123',
        title: 'Increase sales by 20%',
        ownerId: 'user-123',
        targetValue: 100,
        startValue: 0,
        unit: 'percent',
        keyResultType: 'PERCENTAGE',
      };

      const mockKeyResult = {
        id: 'kr-123',
        ...input,
        currentValue: 0,
        status: OKRStatus.NOT_STARTED,
        progress: 0,
        objective: { id: 'obj-123', title: 'Parent Objective' },
      };

      mockPrisma.keyResult.create.mockResolvedValue(mockKeyResult);
      mockPrisma.objective.findUnique.mockResolvedValue({
        id: 'obj-123',
        keyResults: [mockKeyResult],
      });
      mockPrisma.objective.update.mockResolvedValue({});

      const result = await service.createKeyResult(input);

      expect(result).toEqual(mockKeyResult);
      expect(mockPrisma.keyResult.create).toHaveBeenCalled();
    });
  });

  describe('updateKeyResultValue', () => {
    it('should update key result value and calculate progress', async () => {
      const mockKeyResult = {
        id: 'kr-123',
        objectiveId: 'obj-123',
        targetValue: 100,
        startValue: 0,
        currentValue: 0,
      };

      mockPrisma.keyResult.findUnique.mockResolvedValue(mockKeyResult);
      mockPrisma.keyResultUpdate.create.mockResolvedValue({});
      mockPrisma.keyResult.update.mockResolvedValue({
        ...mockKeyResult,
        currentValue: 50,
        progress: 50,
        objective: { id: 'obj-123', title: 'Parent' },
      });
      mockPrisma.objective.findUnique.mockResolvedValue({
        id: 'obj-123',
        keyResults: [{ ...mockKeyResult, currentValue: 50, progress: 50 }],
      });
      mockPrisma.objective.update.mockResolvedValue({});

      const result = await service.updateKeyResultValue('kr-123', 'user-123', {
        currentValue: 50,
        confidence: 70,
      });

      expect(result.currentValue).toBe(50);
      expect(mockPrisma.keyResultUpdate.create).toHaveBeenCalled();
      expect(mockPrisma.keyResult.update).toHaveBeenCalled();
    });

    it('should throw error for non-existent key result', async () => {
      mockPrisma.keyResult.findUnique.mockResolvedValue(null);

      await expect(
        service.updateKeyResultValue('non-existent', 'user-123', { currentValue: 50 })
      ).rejects.toThrow('Key result not found');
    });
  });

  describe('createCheckIn', () => {
    it('should create a check-in for an objective', async () => {
      const mockObjective = { id: 'obj-123', title: 'Objective' };
      const mockCheckIn = {
        id: 'checkin-123',
        objectiveId: 'obj-123',
        confidence: 75,
        notes: 'Making good progress',
        objective: mockObjective,
      };

      mockPrisma.objective.findUnique.mockResolvedValue(mockObjective);
      mockPrisma.oKRCheckIn.create.mockResolvedValue(mockCheckIn);

      const result = await service.createCheckIn({
        objectiveId: 'obj-123',
        userId: 'user-123',
        notes: 'Making good progress',
        overallConfidence: 75,
      });

      expect(result).toEqual(mockCheckIn);
      expect(mockPrisma.oKRCheckIn.create).toHaveBeenCalled();
    });

    it('should throw error for non-existent objective', async () => {
      mockPrisma.objective.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckIn({
          objectiveId: 'non-existent',
          userId: 'user-123',
          overallConfidence: 50,
        })
      ).rejects.toThrow('Objective not found');
    });
  });

  describe('getOKRTree', () => {
    it('should return hierarchical OKR tree', async () => {
      const mockTree = [
        {
          id: 'obj-1',
          title: 'Company OKR',
          keyResults: [],
          childObjectives: [
            {
              id: 'obj-2',
              title: 'Team OKR',
              keyResults: [{ id: 'kr-1' }],
              childObjectives: [],
            },
          ],
        },
      ];

      mockPrisma.objective.findMany.mockResolvedValue(mockTree);

      const result = await service.getOKRTree('engagement-123');

      expect(result).toEqual(mockTree);
      expect(mockPrisma.objective.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { engagementId: 'engagement-123', parentObjectiveId: null },
        })
      );
    });
  });

  describe('getOKRSummary', () => {
    it('should return OKR summary statistics', async () => {
      const mockObjectives = [
        { id: 'obj-1', title: 'Obj 1', progress: 80, status: OKRStatus.ON_TRACK, keyResults: [{ id: 'kr-1' }] },
        { id: 'obj-2', title: 'Obj 2', progress: 40, status: OKRStatus.AT_RISK, keyResults: [{ id: 'kr-2' }, { id: 'kr-3' }] },
        { id: 'obj-3', title: 'Obj 3', progress: 100, status: OKRStatus.ACHIEVED, keyResults: [] },
      ];

      mockPrisma.objective.findMany.mockResolvedValue(mockObjectives);

      const result = await service.getOKRSummary('engagement-123');

      expect(result.totalObjectives).toBe(3);
      expect(result.totalKeyResults).toBe(3);
      expect(result.avgProgress).toBe(73); // (80 + 40 + 100) / 3 = 73.33, rounded to 73
      expect(result.byStatus.onTrack).toBe(1);
      expect(result.byStatus.atRisk).toBe(1);
      expect(result.byStatus.completed).toBe(1);
    });

    it('should return zero averages for empty objectives', async () => {
      mockPrisma.objective.findMany.mockResolvedValue([]);

      const result = await service.getOKRSummary('engagement-123');

      expect(result.totalObjectives).toBe(0);
      expect(result.avgProgress).toBe(0);
    });
  });
});
