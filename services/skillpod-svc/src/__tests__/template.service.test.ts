/**
 * @module @skillancer/skillpod-svc/tests/template.service
 * Unit tests for template service
 */

// @ts-nocheck - FUTURE: Fix TypeScript errors in test mocks
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/consistent-type-imports */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createTemplateService, TemplateError } from '../services/template.service.js';

import type { ImageRepository } from '../repositories/image.repository.js';
import type {
  TemplateRepository,
  TemplateWithRelations,
} from '../repositories/template.repository.js';
import type { ECRService } from '../services/ecr.service.js';
import type { ResourceSpec, ToolDefinition } from '../types/environment.types.js';
import type { PodTemplate, TemplateCategory } from '@prisma/client';

// =============================================================================
// MOCKS
// =============================================================================

const mockTemplateRepository: TemplateRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  incrementUsageCount: vi.fn(),
  upsertRating: vi.fn(),
  getRatings: vi.fn(),
};

const mockImageRepository: ImageRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByKasmImageId: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  countActiveByType: vi.fn(),
};

const mockEcrService: ECRService = {
  buildAndPush: vi.fn(),
  getImageDigest: vi.fn(),
  deleteImage: vi.fn(),
  createRepository: vi.fn(),
  listImages: vi.fn(),
  getAuthorizationToken: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
} as unknown as import('ioredis').Redis;

// =============================================================================
// TEST DATA
// =============================================================================

const mockBaseImage = {
  id: 'base-image-id',
  name: 'Ubuntu 22.04',
  slug: 'ubuntu-22.04',
  registryUri: 'kasmweb/ubuntu-jammy-desktop',
  imageTag: '1.14.0',
  osType: 'LINUX' as const,
  registryType: 'KASM' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTemplate: PodTemplate = {
  id: 'template-id',
  tenantId: 'tenant-id',
  name: 'Full-Stack Development',
  slug: 'full-stack-development',
  description: 'Complete development environment',
  shortDescription: 'Node.js, Python, Docker',
  category: 'DEVELOPMENT' as TemplateCategory,
  tags: ['nodejs', 'python', 'docker'],
  version: '1.0.0',
  baseImageId: 'base-image-id',
  kasmImageId: 'kasm-full-stack-123',
  ecrImageUri: 'ecr.aws/skillancer/templates:full-stack-123',
  installedTools: [
    { name: 'Git', version: 'latest', category: 'version-control' },
    { name: 'Node.js', version: '20.x', category: 'runtime' },
  ] as unknown as object,
  defaultConfig: {},
  defaultResources: { cpu: 4, memory: 8192, storage: 50, gpu: false },
  minResources: { cpu: 2, memory: 4096, storage: 20, gpu: false },
  maxResources: { cpu: 16, memory: 32768, storage: 200, gpu: false },
  startupScript: null,
  environmentVars: { NODE_ENV: 'development' },
  iconUrl: null,
  screenshotUrls: [],
  documentationUrl: null,
  avgRating: 4.5,
  ratingCount: 10,
  usageCount: 100,
  isPublic: true,
  isActive: true,
  estimatedLaunchSeconds: 90,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createTemplateParams = {
  tenantId: 'tenant-id',
  name: 'Test Template',
  slug: 'test-template',
  description: 'Test description',
  category: 'DEVELOPMENT' as TemplateCategory,
  tags: ['test'],
  baseImageId: 'base-image-id',
  installedTools: [
    { name: 'Git', version: 'latest', category: 'version-control' },
  ] as ToolDefinition[],
  defaultResources: { cpu: 4, memory: 8192, storage: 50, gpu: false } as ResourceSpec,
  isPublic: false,
};

// =============================================================================
// TESTS
// =============================================================================

describe('TemplateService', () => {
  let templateService: ReturnType<typeof createTemplateService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    vi.mocked(mockImageRepository.findById).mockResolvedValue(mockBaseImage as never);
    vi.mocked(mockTemplateRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(mockEcrService.buildAndPush).mockResolvedValue('ecr.aws/repo:tag');
    vi.mocked(mockTemplateRepository.create).mockResolvedValue(mockTemplate);
    vi.mocked(mockRedis.get).mockResolvedValue(null);
    vi.mocked(mockRedis.set).mockResolvedValue('OK');

    templateService = createTemplateService(
      mockTemplateRepository,
      mockImageRepository,
      mockEcrService,
      mockRedis
    );
  });

  describe('createTemplate', () => {
    it('should create a new template successfully', async () => {
      const result = await templateService.createTemplate(createTemplateParams);

      expect(result).toEqual(mockTemplate);
      expect(mockImageRepository.findById).toHaveBeenCalledWith('base-image-id');
      expect(mockTemplateRepository.findBySlug).toHaveBeenCalledWith('tenant-id', 'test-template');
      expect(mockEcrService.buildAndPush).toHaveBeenCalled();
      expect(mockTemplateRepository.create).toHaveBeenCalled();
    });

    it('should throw error if base image not found', async () => {
      vi.mocked(mockImageRepository.findById).mockResolvedValue(null);

      await expect(templateService.createTemplate(createTemplateParams)).rejects.toThrow(
        TemplateError
      );
      await expect(templateService.createTemplate(createTemplateParams)).rejects.toThrow(
        'Base image not found'
      );
    });

    it('should throw error if slug already exists', async () => {
      vi.mocked(mockTemplateRepository.findBySlug).mockResolvedValue(mockTemplate);

      await expect(templateService.createTemplate(createTemplateParams)).rejects.toThrow(
        TemplateError
      );
      await expect(templateService.createTemplate(createTemplateParams)).rejects.toThrow(
        'already exists'
      );
    });

    it('should generate correct default resources based on category', async () => {
      await templateService.createTemplate(createTemplateParams);

      const createCall = vi.mocked(mockTemplateRepository.create).mock.calls[0][0];
      expect(createCall.minResources).toBeDefined();
      expect(createCall.maxResources).toBeDefined();
    });
  });

  describe('getTemplateById', () => {
    it('should return cached template if available', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockTemplate));

      const result = await templateService.getTemplateById('template-id');

      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from repository and cache if not cached', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(
        mockTemplate as TemplateWithRelations
      );

      const result = await templateService.getTemplateById('template-id');

      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.findById).toHaveBeenCalledWith('template-id');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should return null if template not found', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(null);

      const result = await templateService.getTemplateById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should return paginated templates', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockTemplateRepository.findMany).mockResolvedValue({
        templates: [mockTemplate as TemplateWithRelations],
        total: 1,
      });

      const result = await templateService.listTemplates({
        tenantId: 'tenant-id',
        page: 1,
        limit: 20,
      });

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockTemplateRepository.findMany).mockResolvedValue({
        templates: [],
        total: 0,
      });

      await templateService.listTemplates({
        tenantId: 'tenant-id',
        category: 'DEVELOPMENT',
      });

      expect(mockTemplateRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'DEVELOPMENT' }),
        expect.any(Object)
      );
    });

    it('should use cached results if available', async () => {
      const cachedResult = { templates: [mockTemplate], total: 1 };
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedResult));

      const result = await templateService.listTemplates({
        tenantId: 'tenant-id',
      });

      expect(result).toEqual(cachedResult);
      expect(mockTemplateRepository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(
        mockTemplate as TemplateWithRelations
      );
      vi.mocked(mockTemplateRepository.update).mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Name',
      });

      const result = await templateService.updateTemplate('template-id', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockRedis.del).toHaveBeenCalledWith('template:template-id');
    });

    it('should throw error if template not found', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(null);

      await expect(templateService.updateTemplate('nonexistent', { name: 'Test' })).rejects.toThrow(
        TemplateError
      );
    });

    it('should rebuild image if tools changed', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(
        mockTemplate as TemplateWithRelations
      );
      vi.mocked(mockTemplateRepository.update).mockResolvedValue(mockTemplate);

      await templateService.updateTemplate('template-id', {
        installedTools: [{ name: 'Python', version: '3.12', category: 'runtime' }],
      });

      expect(mockEcrService.buildAndPush).toHaveBeenCalled();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(
        mockTemplate as TemplateWithRelations
      );
      vi.mocked(mockTemplateRepository.delete).mockResolvedValue(undefined);

      await templateService.deleteTemplate('template-id');

      expect(mockTemplateRepository.delete).toHaveBeenCalledWith('template-id');
      expect(mockRedis.del).toHaveBeenCalledWith('template:template-id');
    });

    it('should throw error if template not found', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(null);

      await expect(templateService.deleteTemplate('nonexistent')).rejects.toThrow(TemplateError);
    });
  });

  describe('cloneTemplate', () => {
    it('should clone template with customizations', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(
        mockTemplate as TemplateWithRelations
      );

      await templateService.cloneTemplate('template-id', {
        tenantId: 'tenant-id',
        name: 'Cloned Template',
        slug: 'cloned-template',
        customizations: {
          additionalTools: [{ name: 'Docker', version: 'latest', category: 'container' }],
        },
      });

      expect(mockTemplateRepository.create).toHaveBeenCalled();
      const createCall = vi.mocked(mockTemplateRepository.create).mock.calls[0][0];
      expect(createCall.name).toBe('Cloned Template');
      expect(createCall.slug).toBe('cloned-template');
    });

    it('should throw error if source template not found', async () => {
      vi.mocked(mockTemplateRepository.findById).mockResolvedValue(null);

      await expect(
        templateService.cloneTemplate('nonexistent', {
          tenantId: 'tenant-id',
          name: 'Clone',
          slug: 'clone',
        })
      ).rejects.toThrow(TemplateError);
    });
  });

  describe('rateTemplate', () => {
    it('should add rating successfully', async () => {
      vi.mocked(mockTemplateRepository.upsertRating).mockResolvedValue(undefined);
      vi.mocked(mockTemplateRepository.getRatings).mockResolvedValue([
        { rating: 5, userId: 'user-1', review: null },
        { rating: 4, userId: 'user-2', review: 'Great!' },
      ] as never);
      vi.mocked(mockTemplateRepository.update).mockResolvedValue(mockTemplate);

      await templateService.rateTemplate({
        templateId: 'template-id',
        userId: 'user-id',
        rating: 5,
        review: 'Excellent!',
      });

      expect(mockTemplateRepository.upsertRating).toHaveBeenCalledWith({
        templateId: 'template-id',
        userId: 'user-id',
        rating: 5,
        review: 'Excellent!',
      });
      expect(mockTemplateRepository.update).toHaveBeenCalled();
    });

    it('should throw error for invalid rating', async () => {
      await expect(
        templateService.rateTemplate({
          templateId: 'template-id',
          userId: 'user-id',
          rating: 6, // Invalid
        })
      ).rejects.toThrow('Rating must be between 1 and 5');

      await expect(
        templateService.rateTemplate({
          templateId: 'template-id',
          userId: 'user-id',
          rating: 0, // Invalid
        })
      ).rejects.toThrow('Rating must be between 1 and 5');
    });
  });

  describe('incrementUsageCount', () => {
    it('should increment usage count and invalidate cache', async () => {
      vi.mocked(mockTemplateRepository.incrementUsageCount).mockResolvedValue(undefined);

      await templateService.incrementUsageCount('template-id');

      expect(mockTemplateRepository.incrementUsageCount).toHaveBeenCalledWith('template-id');
      expect(mockRedis.del).toHaveBeenCalledWith('template:template-id');
    });
  });
});
