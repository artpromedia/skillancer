/**
 * @module @skillancer/market-svc/services/__tests__/project
 * Unit tests for the project service
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

// Mock ProjectRepository
const mockProjectRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByClientId: vi.fn(),
  search: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
  softDelete: vi.fn(),
  addSkills: vi.fn(),
  removeAllSkills: vi.fn(),
  isPublished: vi.fn(),
  isOwner: vi.fn(),
  getStats: vi.fn(),
};

vi.mock('../../repositories/project.repository.js', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => mockProjectRepository),
}));

// Create mock instances
const mockPrisma = {
  job: {
    findFirst: vi.fn(),
    count: vi.fn(),
  },
} as any;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

import { ProjectService } from '../project.service.js';
import { BiddingErrorCode } from '../../errors/bidding.errors.js';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    service = new ProjectService(mockPrisma, mockRedis, mockLogger);
  });

  describe('createProject', () => {
    const validInput = {
      title: 'Build a Mobile App',
      description: 'I need a React Native developer to build a mobile application for my business.',
      budgetType: 'FIXED' as const,
      budgetMin: 1000,
      budgetMax: 5000,
      experienceLevel: 'INTERMEDIATE' as const,
    };

    it('should create a project successfully', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null); // No existing slug
      const createdProject = {
        id: 'project-123',
        slug: 'build-a-mobile-app',
        status: 'DRAFT',
        ...validInput,
      };
      mockProjectRepository.create.mockResolvedValue(createdProject);
      mockProjectRepository.findById.mockResolvedValue(createdProject);

      const result = await service.createProject('client-123', validInput);

      expect(result.id).toBe('project-123');
      expect(result.slug).toBe('build-a-mobile-app');
      expect(mockProjectRepository.create).toHaveBeenCalledWith({
        ...validInput,
        clientId: 'client-123',
        slug: 'build-a-mobile-app',
      });
    });

    it('should generate unique slug with suffix if slug exists', async () => {
      mockPrisma.job.findFirst
        .mockResolvedValueOnce({ id: 'existing' }) // First slug exists
        .mockResolvedValueOnce(null); // Second slug is unique
      mockPrisma.job.count.mockResolvedValue(1);
      const createdProject = {
        id: 'project-123',
        slug: 'build-a-mobile-app-1',
        ...validInput,
      };
      mockProjectRepository.create.mockResolvedValue(createdProject);
      mockProjectRepository.findById.mockResolvedValue(createdProject);

      const result = await service.createProject('client-123', validInput);

      expect(result.slug).toBe('build-a-mobile-app-1');
    });

    it('should add skills if provided', async () => {
      const inputWithSkills = {
        ...validInput,
        skills: ['skill-1', 'skill-2'],
      };

      mockPrisma.job.findFirst.mockResolvedValue(null);
      // Mock prisma.skill.findMany for addSkillsToProject - returns skill IDs
      mockPrisma.skill = {
        findMany: vi.fn().mockResolvedValue([{ id: 'skill-id-1' }, { id: 'skill-id-2' }]),
      };
      const createdProject = {
        id: 'project-123',
        slug: 'build-a-mobile-app',
        ...validInput,
      };
      mockProjectRepository.create.mockResolvedValue(createdProject);
      mockProjectRepository.findById.mockResolvedValue(createdProject);

      await service.createProject('client-123', inputWithSkills);

      // Service converts slugs to IDs via prisma.skill.findMany
      expect(mockProjectRepository.addSkills).toHaveBeenCalledWith('project-123', [
        'skill-id-1',
        'skill-id-2',
      ]);
    });
  });

  describe('getProject', () => {
    it('should return project from cache', async () => {
      const cachedProject = {
        id: 'project-123',
        title: 'Test Project',
        status: 'PUBLISHED',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedProject));

      const result = await service.getProject('project-123');

      expect(result).toEqual(cachedProject);
      expect(mockProjectRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch and cache project from database', async () => {
      const project = {
        id: 'project-123',
        title: 'Test Project',
        status: 'PUBLISHED',
      };
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await service.getProject('project-123');

      expect(result).toEqual(project);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'project:project-123',
        300,
        JSON.stringify(project)
      );
    });

    it('should throw error for non-existent project', async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      await expect(service.getProject('project-123')).rejects.toMatchObject({
        code: BiddingErrorCode.PROJECT_NOT_FOUND,
      });
    });
  });

  describe('updateProject', () => {
    it('should update project owned by user', async () => {
      const originalProject = {
        id: 'project-123',
        clientId: 'client-123',
        status: 'DRAFT',
        title: 'Original Title',
      };
      const updatedProject = {
        id: 'project-123',
        clientId: 'client-123',
        status: 'DRAFT',
        title: 'Updated Title',
      };
      mockProjectRepository.findById
        .mockResolvedValueOnce(originalProject) // First call for ownership check
        .mockResolvedValueOnce(updatedProject); // Second call from getProject
      mockProjectRepository.update.mockResolvedValue(updatedProject);

      const result = await service.updateProject('project-123', 'client-123', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should reject update from non-owner', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        clientId: 'other-user',
        status: 'DRAFT',
      });

      await expect(
        service.updateProject('project-123', 'client-123', { title: 'New Title' })
      ).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });

    it('should update skills if provided', async () => {
      const project = {
        id: 'project-123',
        clientId: 'client-123',
        status: 'DRAFT',
      };
      mockProjectRepository.findById.mockResolvedValue(project);
      mockProjectRepository.update.mockResolvedValue(project);
      // Mock prisma.skill.findMany for addSkillsToProject - returns skill IDs
      mockPrisma.skill = {
        findMany: vi.fn().mockResolvedValue([{ id: 'skill-id-1' }, { id: 'skill-id-2' }]),
      };

      await service.updateProject('project-123', 'client-123', {
        skills: ['skill-new-1', 'skill-new-2'],
      });

      expect(mockProjectRepository.removeAllSkills).toHaveBeenCalledWith('project-123');
      expect(mockProjectRepository.addSkills).toHaveBeenCalledWith('project-123', [
        'skill-id-1',
        'skill-id-2',
      ]);
    });
  });

  describe('publishProject', () => {
    it('should publish draft project', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'DRAFT',
        clientId: 'client-123',
        title: 'Test Project',
        description: 'A detailed description of the project requirements.',
        budgetType: 'FIXED',
      });
      mockProjectRepository.publish.mockResolvedValue({
        id: 'project-123',
        status: 'PUBLISHED',
      });

      const result = await service.publishProject('project-123', 'client-123');

      expect(result.status).toBe('PUBLISHED');
      expect(mockProjectRepository.publish).toHaveBeenCalledWith('project-123');
    });

    it('should reject publishing by non-owner', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'DRAFT',
        clientId: 'client-123',
      });

      await expect(service.publishProject('project-123', 'other-user')).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });

    it('should reject publishing already published project', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'PUBLISHED',
        clientId: 'client-123',
      });

      await expect(service.publishProject('project-123', 'client-123')).rejects.toMatchObject({
        code: BiddingErrorCode.PROJECT_ALREADY_PUBLISHED,
      });
    });
  });

  describe('closeProject', () => {
    it('should close published project', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'PUBLISHED',
        clientId: 'client-123',
      });
      mockProjectRepository.close.mockResolvedValue({
        id: 'project-123',
        status: 'COMPLETED',
      });

      const result = await service.closeProject('project-123', 'client-123', 'completed');

      expect(result.status).toBe('COMPLETED');
      expect(mockProjectRepository.close).toHaveBeenCalledWith('project-123', 'COMPLETED');
    });

    it('should reject closing already closed project', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'CLOSED',
        clientId: 'client-123',
      });

      await expect(service.closeProject('project-123', 'client-123')).rejects.toMatchObject({
        code: BiddingErrorCode.PROJECT_ALREADY_CLOSED,
      });
    });
  });

  describe('searchProjects', () => {
    it('should search projects with filters', async () => {
      mockProjectRepository.search.mockResolvedValue({
        projects: [
          {
            id: 'project-1',
            title: 'React App',
            slug: 'react-app',
            description: 'A React app',
            budgetType: 'FIXED',
            budgetMin: 1000,
            budgetMax: 5000,
            currency: 'USD',
            duration: null,
            experienceLevel: 'INTERMEDIATE',
            isRemote: true,
            location: null,
            skills: [],
            tags: [],
            _count: { bids: 5 },
            publishedAt: new Date(),
            client: {
              id: 'client-1',
              displayName: 'Client One',
              avatarUrl: null,
              ratingAggregation: null,
              profile: null,
            },
          },
          {
            id: 'project-2',
            title: 'Node Backend',
            slug: 'node-backend',
            description: 'A Node backend',
            budgetType: 'HOURLY',
            budgetMin: 50,
            budgetMax: 100,
            currency: 'USD',
            duration: null,
            experienceLevel: 'EXPERT',
            isRemote: false,
            location: 'US',
            skills: [],
            tags: [],
            _count: { bids: 3 },
            publishedAt: new Date(),
            client: {
              id: 'client-2',
              displayName: 'Client Two',
              avatarUrl: null,
              ratingAggregation: null,
              profile: null,
            },
          },
        ],
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      });

      const result = await service.searchProjects({
        query: 'react',
        budgetMin: 1000,
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('validateProjectForBidding', () => {
    it('should return project if open for bidding', async () => {
      const project = {
        id: 'project-123',
        status: 'PUBLISHED',
        clientId: 'client-123',
        title: 'Test Project',
      };
      mockProjectRepository.findById.mockResolvedValue(project);

      const result = await service.validateProjectForBidding('project-123', 'freelancer-123');

      expect(result.id).toBe('project-123');
    });

    it('should reject if project is not published', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'DRAFT',
        clientId: 'client-123',
      });

      await expect(
        service.validateProjectForBidding('project-123', 'freelancer-123')
      ).rejects.toMatchObject({
        code: BiddingErrorCode.PROJECT_NOT_PUBLISHED,
      });
    });

    it('should reject if freelancer is project owner', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        status: 'PUBLISHED',
        clientId: 'client-123',
      });

      await expect(
        service.validateProjectForBidding('project-123', 'client-123')
      ).rejects.toMatchObject({
        code: BiddingErrorCode.CANNOT_BID_OWN_PROJECT,
      });
    });
  });

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      mockProjectRepository.isOwner.mockResolvedValue(true);
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        clientId: 'client-123',
      });
      mockProjectRepository.getStats.mockResolvedValue({
        bidCount: 25,
        averageBidAmount: 2500,
        averageQualityScore: 0.8,
        invitationCount: 5,
        questionCount: 10,
      });

      const result = await service.getProjectStats('project-123', 'client-123');

      expect(result.bidCount).toBe(25);
    });

    it('should reject stats request from non-owner', async () => {
      mockProjectRepository.findById.mockResolvedValue({
        id: 'project-123',
        clientId: 'other-client',
      });

      await expect(service.getProjectStats('project-123', 'other-user')).rejects.toMatchObject({
        code: BiddingErrorCode.NOT_PROJECT_OWNER,
      });
    });
  });
});
