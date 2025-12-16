/**
 * @module @skillancer/skillpod-svc/services/pod
 * Pod lifecycle management service
 */

import type { MetricsService } from './metrics.service.js';
import type { StorageService } from './storage.service.js';
import type { TemplateService } from './template.service.js';
import type {
  EnvironmentPodRepository,
  PodWithRelations,
} from '../repositories/environment-pod.repository.js';
import type { ResourcePoolRepository } from '../repositories/resource-pool.repository.js';
import type {
  CreatePodParams,
  ResizePodParams,
  PodConnectionDetails,
  ResourceSpec,
  PodErrorCode,
} from '../types/environment.types.js';
import type { Pod, PodStatus, Prisma } from '@prisma/client';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface PodService {
  createPod(params: CreatePodParams): Promise<Pod>;
  getPodById(podId: string): Promise<PodWithRelations | null>;
  getPodByKasmId(kasmWorkspaceId: string): Promise<Pod | null>;
  listPods(params: ListPodsParams): Promise<{ pods: PodWithRelations[]; total: number }>;
  startPod(podId: string): Promise<Pod>;
  stopPod(podId: string): Promise<Pod>;
  hibernatePod(podId: string): Promise<Pod>;
  resumePod(podId: string): Promise<Pod>;
  terminatePod(podId: string): Promise<void>;
  resizePod(podId: string, params: ResizePodParams): Promise<Pod>;
  extendSession(podId: string, additionalMinutes: number): Promise<Pod>;
  getConnectionDetails(podId: string, userId: string): Promise<PodConnectionDetails>;
  refreshConnectionToken(podId: string, userId: string): Promise<PodConnectionDetails>;
}

export interface ListPodsParams {
  tenantId?: string;
  userId?: string;
  status?: PodStatus[];
  templateId?: string;
  page?: number;
  limit?: number;
}

export class PodError extends Error {
  constructor(
    public code: PodErrorCode,
    message?: string
  ) {
    super(message || code);
    this.name = 'PodError';
  }
}

interface KasmWorkspacesService {
  createWorkspace(params: CreateKasmWorkspaceParams): Promise<KasmWorkspace>;
  terminateWorkspace(kasmId: string): Promise<void>;
  pauseWorkspace(kasmId: string): Promise<void>;
  resumeWorkspace(kasmId: string): Promise<void>;
  getWorkspaceStatus(kasmId: string): Promise<string>;
  getConnectionToken(kasmId: string, userId: string): Promise<ConnectionToken>;
  resizeWorkspace(kasmId: string, resources: ResourceSpec): Promise<void>;
}

interface CreateKasmWorkspaceParams {
  kasmImageId: string;
  userId: string;
  tenantId: string;
  resources: ResourceSpec;
  environmentVars?: Record<string, string>;
  securityPolicyId?: string;
  persistentVolumeId?: string;
}

interface KasmWorkspace {
  kasmId: string;
  status: string;
  connectionUrl: string;
}

interface ConnectionToken {
  token: string;
  connectionUrl: string;
  expiresAt: Date;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createPodService(
  podRepository: EnvironmentPodRepository,
  resourcePoolRepository: ResourcePoolRepository,
  templateService: TemplateService,
  metricsService: MetricsService,
  storageService: StorageService,
  kasmService: KasmWorkspacesService,
  redis: RedisType
): PodService {
  /**
   * Create a new pod
   */
  async function createPod(params: CreatePodParams): Promise<Pod> {
    // Validate template exists
    const template = await templateService.getTemplateById(params.templateId);
    if (!template) {
      throw new PodError('TEMPLATE_NOT_FOUND', 'Template not found');
    }

    // Validate resources against template limits
    const resources = params.resources || (template.defaultResources as ResourceSpec);
    validateResources(
      resources,
      template.minResources as ResourceSpec,
      template.maxResources as ResourceSpec
    );

    // Check tenant quota
    const quota = await resourcePoolRepository.findQuotaByTenant(params.tenantId);
    if (quota) {
      const currentUsage = await podRepository.sumResourcesByTenant(params.tenantId);
      if (currentUsage.totalCpu + resources.cpu > quota.maxCpu) {
        throw new PodError('QUOTA_EXCEEDED', 'CPU quota exceeded');
      }
      if (currentUsage.totalMemory + resources.memory > quota.maxMemory) {
        throw new PodError('QUOTA_EXCEEDED', 'Memory quota exceeded');
      }
      if (quota.activePods >= quota.maxPods) {
        throw new PodError('QUOTA_EXCEEDED', 'Maximum pod count exceeded');
      }
    }

    // Create persistent storage if requested
    let persistentVolumeId: string | undefined;
    if (params.persistentStorage) {
      const volume = await storageService.createVolume({
        sizeGb: resources.storage,
        volumeType: 'gp3',
        tags: {
          tenantId: params.tenantId,
          userId: params.userId,
          templateId: params.templateId,
        },
      });
      persistentVolumeId = volume.volumeId;
    }

    // Create Kasm workspace
    const kasmWorkspace = await kasmService.createWorkspace({
      kasmImageId: template.kasmImageId!,
      userId: params.userId,
      tenantId: params.tenantId,
      resources,
      environmentVars: {
        ...(template.environmentVars as Record<string, string>),
        ...params.environmentVars,
      },
      securityPolicyId: params.securityPolicyId,
      persistentVolumeId,
    });

    // Calculate expiration
    const sessionDuration = params.sessionDurationMinutes || 480; // 8 hours default
    const expiresAt = new Date(Date.now() + sessionDuration * 60 * 1000);

    // Create pod record
    const pod = await podRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      templateId: params.templateId,
      name: params.name,
      kasmWorkspaceId: kasmWorkspace.kasmId,
      status: 'STARTING',
      resources: resources as unknown as Prisma.InputJsonValue,
      connectionUrl: kasmWorkspace.connectionUrl,
      persistentVolumeId: persistentVolumeId || null,
      expiresAt,
      autoScalingEnabled: params.autoScaling?.enabled ?? true,
      autoScalingConfig: (params.autoScaling || {
        enabled: true,
        minResources: template.minResources as ResourceSpec,
        maxResources: template.maxResources as ResourceSpec,
        cpuThreshold: 80,
        memoryThreshold: 85,
        scaleUpCooldownSeconds: 300,
        scaleDownCooldownSeconds: 600,
      }) as unknown as Prisma.InputJsonValue,
      securityPolicyId: params.securityPolicyId || null,
    });

    // Update quota usage
    if (quota) {
      await resourcePoolRepository.incrementActivePods(params.tenantId);
      await resourcePoolRepository.incrementUsage(
        params.tenantId,
        resources.cpu,
        resources.memory,
        resources.storage
      );
    }

    // Increment template usage
    await templateService.incrementUsageCount(params.templateId);

    // Create initial session
    await podRepository.createSession({
      podId: pod.id,
      userId: params.userId,
      ipAddress: null,
      userAgent: null,
    });

    // Start status monitoring
    startStatusMonitoring(pod.id, kasmWorkspace.kasmId);

    return pod;
  }

  /**
   * Get pod by ID
   */
  async function getPodById(podId: string): Promise<PodWithRelations | null> {
    return podRepository.findById(podId);
  }

  /**
   * Get pod by Kasm workspace ID
   */
  async function getPodByKasmId(kasmWorkspaceId: string): Promise<Pod | null> {
    return podRepository.findByKasmId(kasmWorkspaceId);
  }

  /**
   * List pods with filtering
   */
  async function listPods(params: ListPodsParams): Promise<{
    pods: PodWithRelations[];
    total: number;
  }> {
    return podRepository.findMany(
      {
        tenantId: params.tenantId,
        userId: params.userId,
        status: params.status,
        templateId: params.templateId,
      },
      {
        page: params.page,
        limit: params.limit,
      }
    );
  }

  /**
   * Start a stopped pod
   */
  async function startPod(podId: string): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    if (pod.status !== 'STOPPED' && pod.status !== 'HIBERNATED') {
      throw new PodError('INVALID_STATUS', `Cannot start pod in ${pod.status} state`);
    }

    await kasmService.resumeWorkspace(pod.kasmWorkspaceId);

    return podRepository.update(podId, {
      status: 'RUNNING',
      lastActivityAt: new Date(),
    });
  }

  /**
   * Stop a running pod
   */
  async function stopPod(podId: string): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    if (pod.status !== 'RUNNING') {
      throw new PodError('INVALID_STATUS', `Cannot stop pod in ${pod.status} state`);
    }

    await kasmService.pauseWorkspace(pod.kasmWorkspaceId);

    return podRepository.update(podId, {
      status: 'STOPPED',
    });
  }

  /**
   * Hibernate pod (save state to storage)
   */
  async function hibernatePod(podId: string): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    if (pod.status !== 'RUNNING') {
      throw new PodError('INVALID_STATUS', `Cannot hibernate pod in ${pod.status} state`);
    }

    // Pause workspace with state preservation
    await kasmService.pauseWorkspace(pod.kasmWorkspaceId);

    return podRepository.update(podId, {
      status: 'HIBERNATED',
    });
  }

  /**
   * Resume hibernated pod
   */
  async function resumePod(podId: string): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    if (pod.status !== 'HIBERNATED') {
      throw new PodError('INVALID_STATUS', `Cannot resume pod in ${pod.status} state`);
    }

    await kasmService.resumeWorkspace(pod.kasmWorkspaceId);

    return podRepository.update(podId, {
      status: 'RUNNING',
      lastActivityAt: new Date(),
    });
  }

  /**
   * Terminate pod completely
   */
  async function terminatePod(podId: string): Promise<void> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    // Terminate Kasm workspace
    await kasmService.terminateWorkspace(pod.kasmWorkspaceId);

    // Delete persistent storage if exists
    if (pod.persistentVolumeId) {
      try {
        await storageService.deleteVolume(pod.persistentVolumeId);
      } catch (error) {
        console.error(`Failed to delete volume ${pod.persistentVolumeId}:`, error);
      }
    }

    // Update quota usage
    const quota = await resourcePoolRepository.findQuotaByTenant(pod.tenantId);
    if (quota) {
      const resources = pod.resources as ResourceSpec;
      await resourcePoolRepository.decrementActivePods(pod.tenantId);
      await resourcePoolRepository.decrementUsage(
        pod.tenantId,
        resources.cpu,
        resources.memory,
        resources.storage
      );
    }

    // Clear metrics cache
    await metricsService.clearMetrics(podId);

    // Delete pod
    await podRepository.delete(podId);
  }

  /**
   * Resize pod resources
   */
  async function resizePod(podId: string, params: ResizePodParams): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    const template = await templateService.getTemplateById(pod.templateId);
    if (!template) {
      throw new PodError('TEMPLATE_NOT_FOUND', 'Template not found');
    }

    // Validate new resources
    const currentResources = pod.resources as ResourceSpec;
    const newResources: ResourceSpec = {
      cpu: params.cpu ?? currentResources.cpu,
      memory: params.memory ?? currentResources.memory,
      storage: params.storage ?? currentResources.storage,
      gpu: params.gpu ?? currentResources.gpu,
      gpuType: params.gpuType ?? currentResources.gpuType,
    };

    validateResources(
      newResources,
      template.minResources as ResourceSpec,
      template.maxResources as ResourceSpec
    );

    // Check quota for resource delta
    const quota = await resourcePoolRepository.findQuotaByTenant(pod.tenantId);
    if (quota) {
      const cpuDelta = newResources.cpu - currentResources.cpu;
      const memoryDelta = newResources.memory - currentResources.memory;

      const currentUsage = await podRepository.sumResourcesByTenant(pod.tenantId);

      if (cpuDelta > 0 && currentUsage.totalCpu + cpuDelta > quota.maxCpu) {
        throw new PodError('QUOTA_EXCEEDED', 'CPU quota would be exceeded');
      }
      if (memoryDelta > 0 && currentUsage.totalMemory + memoryDelta > quota.maxMemory) {
        throw new PodError('QUOTA_EXCEEDED', 'Memory quota would be exceeded');
      }
    }

    // Resize in Kasm
    await kasmService.resizeWorkspace(pod.kasmWorkspaceId, newResources);

    // Record resource history
    await podRepository.createResourceHistory({
      podId,
      fromResources: currentResources as unknown as Prisma.InputJsonValue,
      toResources: newResources as unknown as Prisma.InputJsonValue,
      reason: params.reason || 'manual',
      triggeredBy: params.triggeredBy || 'manual',
    });

    // Update quota usage
    if (quota) {
      const cpuDelta = newResources.cpu - currentResources.cpu;
      const memoryDelta = newResources.memory - currentResources.memory;
      const storageDelta = newResources.storage - currentResources.storage;

      if (cpuDelta > 0 || memoryDelta > 0 || storageDelta > 0) {
        await resourcePoolRepository.incrementUsage(
          pod.tenantId,
          Math.max(0, cpuDelta),
          Math.max(0, memoryDelta),
          Math.max(0, storageDelta)
        );
      }
      if (cpuDelta < 0 || memoryDelta < 0 || storageDelta < 0) {
        await resourcePoolRepository.decrementUsage(
          pod.tenantId,
          Math.abs(Math.min(0, cpuDelta)),
          Math.abs(Math.min(0, memoryDelta)),
          Math.abs(Math.min(0, storageDelta))
        );
      }
    }

    // Update pod
    return podRepository.update(podId, {
      resources: newResources as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Extend pod session
   */
  async function extendSession(podId: string, additionalMinutes: number): Promise<Pod> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    const maxExtension = 24 * 60; // 24 hours max
    if (additionalMinutes > maxExtension) {
      throw new PodError('INVALID_DURATION', 'Maximum extension is 24 hours');
    }

    const currentExpiry = pod.expiresAt || new Date();
    const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

    return podRepository.update(podId, {
      expiresAt: newExpiry,
    });
  }

  /**
   * Get connection details for a pod
   */
  async function getConnectionDetails(
    podId: string,
    userId: string
  ): Promise<PodConnectionDetails> {
    const pod = await podRepository.findById(podId);
    if (!pod) {
      throw new PodError('POD_NOT_FOUND', 'Pod not found');
    }

    // Check user has access
    if (pod.userId !== userId) {
      // Could add additional permission checks here
      throw new PodError('UNAUTHORIZED', 'User does not have access to this pod');
    }

    if (pod.status !== 'RUNNING') {
      throw new PodError('INVALID_STATUS', 'Pod is not running');
    }

    // Get connection token from Kasm
    const tokenData = await kasmService.getConnectionToken(pod.kasmWorkspaceId, userId);

    // Update last activity
    await podRepository.update(podId, {
      lastActivityAt: new Date(),
    });

    return {
      podId: pod.id,
      connectionUrl: pod.connectionUrl,
      connectionToken: tokenData.token,
      expiresAt: tokenData.expiresAt,
      resources: pod.resources as ResourceSpec,
      status: pod.status,
    };
  }

  /**
   * Refresh connection token
   */
  async function refreshConnectionToken(
    podId: string,
    userId: string
  ): Promise<PodConnectionDetails> {
    return getConnectionDetails(podId, userId);
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  function validateResources(resources: ResourceSpec, min: ResourceSpec, max: ResourceSpec): void {
    if (resources.cpu < min.cpu || resources.cpu > max.cpu) {
      throw new PodError('INVALID_RESOURCES', `CPU must be between ${min.cpu} and ${max.cpu}`);
    }
    if (resources.memory < min.memory || resources.memory > max.memory) {
      throw new PodError(
        'INVALID_RESOURCES',
        `Memory must be between ${min.memory} and ${max.memory}`
      );
    }
    if (resources.storage < min.storage || resources.storage > max.storage) {
      throw new PodError(
        'INVALID_RESOURCES',
        `Storage must be between ${min.storage} and ${max.storage}`
      );
    }
    if (resources.gpu && !max.gpu) {
      throw new PodError('INVALID_RESOURCES', 'GPU not allowed for this template');
    }
  }

  function startStatusMonitoring(podId: string, kasmId: string): void {
    // Start background status monitoring
    const checkStatus = async () => {
      try {
        const status = await kasmService.getWorkspaceStatus(kasmId);

        // Map Kasm status to our status
        const statusMapping: Record<string, PodStatus> = {
          starting: 'STARTING',
          running: 'RUNNING',
          stopped: 'STOPPED',
          paused: 'HIBERNATED',
          error: 'ERROR',
        };

        const mappedStatus = statusMapping[status.toLowerCase()] || 'RUNNING';

        await podRepository.update(podId, {
          status: mappedStatus,
        });

        // Continue monitoring if still active
        if (mappedStatus !== 'TERMINATED' && mappedStatus !== 'ERROR') {
          setTimeout(checkStatus, 30000); // Check every 30 seconds
        }
      } catch (error) {
        console.error(`Failed to check status for pod ${podId}:`, error);
      }
    };

    // Start initial status check after a delay
    setTimeout(checkStatus, 5000);
  }

  return {
    createPod,
    getPodById,
    getPodByKasmId,
    listPods,
    startPod,
    stopPod,
    hibernatePod,
    resumePod,
    terminatePod,
    resizePod,
    extendSession,
    getConnectionDetails,
    refreshConnectionToken,
  };
}
