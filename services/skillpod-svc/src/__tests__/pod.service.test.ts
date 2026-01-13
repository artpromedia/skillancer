/**
 * @module @skillancer/skillpod-svc/tests/pod.service
 * Unit tests for pod service
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
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createPodService, PodError } from '../services/pod.service.js';

import type {
  EnvironmentPodRepository,
  PodWithRelations,
} from '../repositories/environment-pod.repository.js';
import type { ResourcePoolRepository } from '../repositories/resource-pool.repository.js';
import type { MetricsService } from '../services/metrics.service.js';
import type { StorageService } from '../services/storage.service.js';
import type { TemplateService } from '../services/template.service.js';
import type { ResourceSpec } from '../types/environment.types.js';
import type { Pod, PodStatus } from '@/types/prisma-shim.js';

// =============================================================================
// MOCKS
// =============================================================================

const mockPodRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByKasmId: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findAutoScalingEnabled: vi.fn(),
  findRunning: vi.fn(),
  findExpired: vi.fn(),
  findIdle: vi.fn(),
  createResourceHistory: vi.fn(),
  getResourceHistory: vi.fn(),
  createSession: vi.fn(),
  endSession: vi.fn(),
  sumResourcesByTenant: vi.fn(),
} as unknown as EnvironmentPodRepository;

const mockResourcePoolRepository = {
  createPool: vi.fn(),
  findPoolById: vi.fn(),
  findPools: vi.fn(),
  findSharedPools: vi.fn(),
  updatePool: vi.fn(),
  createQuota: vi.fn(),
  findQuotaByTenant: vi.fn(),
  updateQuota: vi.fn(),
  incrementUsage: vi.fn(),
  decrementUsage: vi.fn(),
  incrementActivePods: vi.fn(),
  decrementActivePods: vi.fn(),
} as unknown as ResourcePoolRepository;

const mockTemplateService = {
  createTemplate: vi.fn(),
  getTemplateById: vi.fn(),
  getTemplateBySlug: vi.fn(),
  listTemplates: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  cloneTemplate: vi.fn(),
  rateTemplate: vi.fn(),
  incrementUsageCount: vi.fn(),
} as unknown as TemplateService;

const mockMetricsService = {
  getPodMetrics: vi.fn(),
  recordMetrics: vi.fn(),
  getMetricsHistory: vi.fn(),
  getAverageMetrics: vi.fn(),
  clearMetrics: vi.fn(),
} as unknown as MetricsService;

const mockStorageService = {
  createVolume: vi.fn(),
  getVolume: vi.fn(),
  deleteVolume: vi.fn(),
  resizeVolume: vi.fn(),
  attachVolume: vi.fn(),
  detachVolume: vi.fn(),
  listVolumes: vi.fn(),
} as unknown as StorageService;

const mockKasmService = {
  createWorkspace: vi.fn(),
  terminateWorkspace: vi.fn(),
  pauseWorkspace: vi.fn(),
  resumeWorkspace: vi.fn(),
  getWorkspaceStatus: vi.fn(),
  getConnectionToken: vi.fn(),
  resizeWorkspace: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
} as unknown as import('ioredis').Redis;

// =============================================================================
// TEST DATA
// =============================================================================

const mockTemplate = {
  id: 'template-id',
  tenantId: null,
  name: 'Full-Stack Development',
  slug: 'full-stack-development',
  kasmImageId: 'kasm-image-id',
  defaultResources: { cpu: 4, memory: 8192, storage: 50, gpu: false },
  minResources: { cpu: 2, memory: 4096, storage: 20, gpu: false },
  maxResources: { cpu: 16, memory: 32768, storage: 200, gpu: false },
  environmentVars: { NODE_ENV: 'development' },
  isActive: true,
};

const mockPod: Pod = {
  id: 'pod-id',
  tenantId: 'tenant-id',
  userId: 'user-id',
  templateId: 'template-id',
  name: 'My Development Pod',
  kasmWorkspaceId: 'kasm-workspace-id',
  status: 'RUNNING' as PodStatus,
  resources: { cpu: 4, memory: 8192, storage: 50, gpu: false },
  connectionUrl: 'https://kasm.example.com/session/123',
  persistentVolumeId: null,
  lastActivityAt: new Date(),
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  autoScalingEnabled: true,
  autoScalingConfig: {
    enabled: true,
    minResources: { cpu: 2, memory: 4096, storage: 20, gpu: false },
    maxResources: { cpu: 16, memory: 32768, storage: 200, gpu: false },
    cpuThreshold: 80,
    memoryThreshold: 85,
  },
  securityPolicyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockQuota = {
  tenantId: 'tenant-id',
  maxCpu: 64,
  maxMemory: 131072,
  maxStorage: 1000,
  maxGpus: 2,
  maxPods: 50,
  maxConcurrentPods: 20,
  usedCpu: 4,
  usedMemory: 8192,
  usedStorage: 50,
  activePods: 1,
};

// =============================================================================
// TESTS
// =============================================================================

describe('PodService', () => {
  let podService: ReturnType<typeof createPodService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    vi.mocked(mockTemplateService.getTemplateById).mockResolvedValue(mockTemplate as never);
    vi.mocked(mockResourcePoolRepository.findQuotaByTenant).mockResolvedValue(mockQuota as never);
    vi.mocked(mockPodRepository.sumResourcesByTenant).mockResolvedValue({
      totalCpu: 0,
      totalMemory: 0,
      totalStorage: 0,
      activePods: 0,
    });
    vi.mocked(mockKasmService.createWorkspace).mockResolvedValue({
      kasmId: 'kasm-workspace-id',
      status: 'starting',
      connectionUrl: 'https://kasm.example.com/session/123',
    });
    vi.mocked(mockPodRepository.create).mockResolvedValue(mockPod);
    vi.mocked(mockPodRepository.findById).mockResolvedValue(mockPod as PodWithRelations);
    vi.mocked(mockKasmService.getWorkspaceStatus).mockResolvedValue('running');

    podService = createPodService(
      mockPodRepository,
      mockResourcePoolRepository,
      mockTemplateService,
      mockMetricsService,
      mockStorageService,
      mockKasmService as never,
      mockRedis
    );
  });

  describe('createPod', () => {
    const createPodParams = {
      tenantId: 'tenant-id',
      userId: 'user-id',
      templateId: 'template-id',
      name: 'My Pod',
    };

    it('should create a new pod successfully', async () => {
      const result = await podService.createPod(createPodParams);

      expect(result).toEqual(mockPod);
      expect(mockTemplateService.getTemplateById).toHaveBeenCalledWith('template-id');
      expect(mockKasmService.createWorkspace).toHaveBeenCalled();
      expect(mockPodRepository.create).toHaveBeenCalled();
      expect(mockTemplateService.incrementUsageCount).toHaveBeenCalledWith('template-id');
    });

    it('should throw error if template not found', async () => {
      vi.mocked(mockTemplateService.getTemplateById).mockResolvedValue(null);

      await expect(podService.createPod(createPodParams)).rejects.toThrow(PodError);
      await expect(podService.createPod(createPodParams)).rejects.toThrow('Template not found');
    });

    it('should throw error if CPU quota exceeded', async () => {
      vi.mocked(mockPodRepository.sumResourcesByTenant).mockResolvedValue({
        totalCpu: 62,
        totalMemory: 0,
        totalStorage: 0,
        activePods: 0,
      });

      await expect(podService.createPod(createPodParams)).rejects.toThrow('CPU quota exceeded');
    });

    it('should throw error if memory quota exceeded', async () => {
      vi.mocked(mockPodRepository.sumResourcesByTenant).mockResolvedValue({
        totalCpu: 0,
        totalMemory: 130000,
        totalStorage: 0,
        activePods: 0,
      });

      await expect(podService.createPod(createPodParams)).rejects.toThrow('Memory quota exceeded');
    });

    it('should throw error if pod count quota exceeded', async () => {
      vi.mocked(mockResourcePoolRepository.findQuotaByTenant).mockResolvedValue({
        ...mockQuota,
        activePods: 50,
      } as never);

      await expect(podService.createPod(createPodParams)).rejects.toThrow(
        'Maximum pod count exceeded'
      );
    });

    it('should create persistent storage if requested', async () => {
      vi.mocked(mockStorageService.createVolume).mockResolvedValue({
        volumeId: 'vol-123',
        size: 50,
      } as never);

      await podService.createPod({
        ...createPodParams,
        persistentStorage: true,
      });

      expect(mockStorageService.createVolume).toHaveBeenCalled();
    });

    it('should use custom resources if provided', async () => {
      const customResources: ResourceSpec = {
        cpu: 8,
        memory: 16384,
        storage: 100,
        gpu: false,
      };

      await podService.createPod({
        ...createPodParams,
        resources: customResources,
      });

      expect(mockKasmService.createWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: customResources,
        })
      );
    });
  });

  describe('getPodById', () => {
    it('should return pod by ID', async () => {
      const result = await podService.getPodById('pod-id');

      expect(result).toEqual(mockPod);
      expect(mockPodRepository.findById).toHaveBeenCalledWith('pod-id');
    });

    it('should return null if pod not found', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue(null);

      const result = await podService.getPodById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listPods', () => {
    it('should return paginated pods', async () => {
      vi.mocked(mockPodRepository.findMany).mockResolvedValue({
        pods: [mockPod as PodWithRelations],
        total: 1,
      });

      const result = await podService.listPods({
        tenantId: 'tenant-id',
        page: 1,
        limit: 20,
      });

      expect(result.pods).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('startPod', () => {
    it('should start a stopped pod', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        status: 'STOPPED',
      } as PodWithRelations);
      vi.mocked(mockPodRepository.update).mockResolvedValue({
        ...mockPod,
        status: 'RUNNING',
      });

      const result = await podService.startPod('pod-id');

      expect(result.status).toBe('RUNNING');
      expect(mockKasmService.resumeWorkspace).toHaveBeenCalledWith('kasm-workspace-id');
    });

    it('should throw error if pod not found', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue(null);

      await expect(podService.startPod('nonexistent')).rejects.toThrow(PodError);
    });

    it('should throw error if pod is already running', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue(mockPod as PodWithRelations);

      await expect(podService.startPod('pod-id')).rejects.toThrow(
        'Cannot start pod in RUNNING state'
      );
    });
  });

  describe('stopPod', () => {
    it('should stop a running pod', async () => {
      vi.mocked(mockPodRepository.update).mockResolvedValue({
        ...mockPod,
        status: 'STOPPED',
      });

      const result = await podService.stopPod('pod-id');

      expect(result.status).toBe('STOPPED');
      expect(mockKasmService.pauseWorkspace).toHaveBeenCalledWith('kasm-workspace-id');
    });

    it('should throw error if pod is not running', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        status: 'STOPPED',
      } as PodWithRelations);

      await expect(podService.stopPod('pod-id')).rejects.toThrow(
        'Cannot stop pod in STOPPED state'
      );
    });
  });

  describe('hibernatePod', () => {
    it('should hibernate a running pod', async () => {
      vi.mocked(mockPodRepository.update).mockResolvedValue({
        ...mockPod,
        status: 'HIBERNATED',
      });

      const result = await podService.hibernatePod('pod-id');

      expect(result.status).toBe('HIBERNATED');
      expect(mockKasmService.pauseWorkspace).toHaveBeenCalled();
    });
  });

  describe('resumePod', () => {
    it('should resume a hibernated pod', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        status: 'HIBERNATED',
      } as PodWithRelations);
      vi.mocked(mockPodRepository.update).mockResolvedValue({
        ...mockPod,
        status: 'RUNNING',
      });

      const result = await podService.resumePod('pod-id');

      expect(result.status).toBe('RUNNING');
      expect(mockKasmService.resumeWorkspace).toHaveBeenCalled();
    });
  });

  describe('terminatePod', () => {
    it('should terminate pod and cleanup resources', async () => {
      await podService.terminatePod('pod-id');

      expect(mockKasmService.terminateWorkspace).toHaveBeenCalledWith('kasm-workspace-id');
      expect(mockMetricsService.clearMetrics).toHaveBeenCalledWith('pod-id');
      expect(mockPodRepository.delete).toHaveBeenCalledWith('pod-id');
      expect(mockResourcePoolRepository.decrementActivePods).toHaveBeenCalled();
    });

    it('should delete persistent volume if exists', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        persistentVolumeId: 'vol-123',
      } as PodWithRelations);

      await podService.terminatePod('pod-id');

      expect(mockStorageService.deleteVolume).toHaveBeenCalledWith('vol-123');
    });
  });

  describe('resizePod', () => {
    it('should resize pod resources', async () => {
      const newResources = { cpu: 8, memory: 16384 };
      vi.mocked(mockPodRepository.update).mockResolvedValue({
        ...mockPod,
        resources: { ...(mockPod.resources as object), ...newResources },
      } as Pod);

      await podService.resizePod('pod-id', newResources);

      expect(mockKasmService.resizeWorkspace).toHaveBeenCalled();
      expect(mockPodRepository.createResourceHistory).toHaveBeenCalled();
    });

    it('should throw error if resources exceed template limits', async () => {
      await expect(
        podService.resizePod('pod-id', { cpu: 32 }) // Exceeds max of 16
      ).rejects.toThrow('CPU must be between 2 and 16');
    });

    it('should throw error if quota would be exceeded', async () => {
      vi.mocked(mockPodRepository.sumResourcesByTenant).mockResolvedValue({
        totalCpu: 60,
        totalMemory: 0,
        totalStorage: 0,
        activePods: 1,
      });

      await expect(
        podService.resizePod('pod-id', { cpu: 8 }) // Would bring total to 64 (current 4 -> 8, so +4)
      ).rejects.toThrow('CPU quota would be exceeded');
    });
  });

  describe('extendSession', () => {
    it('should extend pod session', async () => {
      const originalExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        expiresAt: originalExpiry,
      } as PodWithRelations);
      vi.mocked(mockPodRepository.update).mockImplementation(
        async (id, data) =>
          ({
            ...mockPod,
            ...data,
          }) as Pod
      );

      const result = await podService.extendSession('pod-id', 60); // Extend by 1 hour

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt!.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should throw error if extension exceeds 24 hours', async () => {
      await expect(
        podService.extendSession('pod-id', 1500) // 25 hours
      ).rejects.toThrow('Maximum extension is 24 hours');
    });
  });

  describe('getConnectionDetails', () => {
    it('should return connection details for pod owner', async () => {
      vi.mocked(mockKasmService.getConnectionToken).mockResolvedValue({
        token: 'connection-token',
        connectionUrl: 'https://kasm.example.com/session/123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await podService.getConnectionDetails('pod-id', 'user-id');

      expect(result.connectionUrl).toBe('https://kasm.example.com/session/123');
      expect(result.connectionToken).toBe('connection-token');
    });

    it('should throw error if user is not pod owner', async () => {
      await expect(podService.getConnectionDetails('pod-id', 'other-user-id')).rejects.toThrow(
        'User does not have access'
      );
    });

    it('should throw error if pod is not running', async () => {
      vi.mocked(mockPodRepository.findById).mockResolvedValue({
        ...mockPod,
        status: 'STOPPED',
      } as PodWithRelations);

      await expect(podService.getConnectionDetails('pod-id', 'user-id')).rejects.toThrow(
        'Pod is not running'
      );
    });
  });
});
