/**
 * @module @skillancer/skillpod-svc/services/template
 * Template management service for pod templates
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import type { ECRService } from './ecr.service.js';
import type { ImageRepository } from '../repositories/image.repository.js';
import type {
  TemplateRepository,
  TemplateWithRelations,
} from '../repositories/template.repository.js';
import type {
  CreateTemplateParams,
  UpdateTemplateParams,
  ListTemplatesParams,
  CloneTemplateParams,
  RateTemplateParams,
  ResourceSpec,
  ToolDefinition,
  TemplateErrorCode,
} from '../types/environment.types.js';
import type { PodTemplate, TemplateCategory, BaseImage } from '@prisma/client';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateService {
  createTemplate(params: CreateTemplateParams): Promise<PodTemplate>;
  getTemplateById(templateId: string): Promise<TemplateWithRelations | null>;
  getTemplateBySlug(tenantId: string | null, slug: string): Promise<PodTemplate | null>;
  listTemplates(params: ListTemplatesParams): Promise<{
    templates: TemplateWithRelations[];
    total: number;
  }>;
  updateTemplate(templateId: string, updates: UpdateTemplateParams): Promise<PodTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  cloneTemplate(templateId: string, params: CloneTemplateParams): Promise<PodTemplate>;
  rateTemplate(params: RateTemplateParams): Promise<void>;
  incrementUsageCount(templateId: string): Promise<void>;
}

export class TemplateError extends Error {
  constructor(
    public code: TemplateErrorCode,
    message?: string
  ) {
    super(message || code);
    this.name = 'TemplateError';
  }
}

interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}

// =============================================================================
// CACHE SERVICE IMPLEMENTATION
// =============================================================================

function createCacheService(redis: RedisType): CacheService {
  return {
    async get<T>(key: string): Promise<T | null> {
      const value = await redis.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },

    async set(key: string, value: unknown, ttl = 300): Promise<void> {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    },

    async delete(key: string): Promise<void> {
      await redis.del(key);
    },

    async deletePattern(pattern: string): Promise<void> {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },
  };
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createTemplateService(
  templateRepository: TemplateRepository,
  imageRepository: ImageRepository,
  ecrService: ECRService,
  redis: RedisType
): TemplateService {
  const cache = createCacheService(redis);

  /**
   * Create a new template
   */
  async function createTemplate(params: CreateTemplateParams): Promise<PodTemplate> {
    // Validate base image exists
    const baseImage = await imageRepository.findById(params.baseImageId);
    if (!baseImage) {
      throw new TemplateError('BASE_IMAGE_NOT_FOUND', 'Base image not found');
    }

    // Validate slug uniqueness
    const existingTemplate = await templateRepository.findBySlug(
      params.tenantId ?? null,
      params.slug
    );
    if (existingTemplate) {
      throw new TemplateError('SLUG_EXISTS', 'Template with this slug already exists');
    }

    // Build Docker image with installed tools
    const imageUri = await buildTemplateImage(baseImage, params.installedTools, params);

    // Register with Kasm (in production, would call Kasm API)
    const kasmImageId = await registerWithKasm(params, imageUri);

    // Create template record
    const template = await templateRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      slug: params.slug,
      description: params.description,
      shortDescription: params.shortDescription,
      category: params.category,
      tags: params.tags || [],
      baseImageId: params.baseImageId,
      kasmImageId,
      ecrImageUri: imageUri,
      installedTools: params.installedTools,
      defaultConfig: params.defaultConfig || {},
      defaultResources: params.defaultResources,
      minResources: params.minResources || getMinResources(params.category),
      maxResources: params.maxResources || getMaxResources(params.category),
      startupScript: params.startupScript,
      environmentVars: params.environmentVars,
      iconUrl: params.iconUrl,
      screenshotUrls: params.screenshotUrls || [],
      documentationUrl: params.documentationUrl,
      isPublic: params.isPublic ?? false,
      isActive: true,
      estimatedLaunchSeconds: estimateLaunchTime(params),
    });

    // Invalidate cache
    await cache.deletePattern(`templates:${params.tenantId || 'global'}:*`);

    return template;
  }

  /**
   * Get template by ID
   */
  async function getTemplateById(templateId: string): Promise<TemplateWithRelations | null> {
    const cacheKey = `template:${templateId}`;
    const cached = await cache.get<TemplateWithRelations>(cacheKey);
    if (cached) return cached;

    const template = await templateRepository.findById(templateId);
    if (template) {
      await cache.set(cacheKey, template, 300);
    }

    return template;
  }

  /**
   * Get template by slug
   */
  async function getTemplateBySlug(
    tenantId: string | null,
    slug: string
  ): Promise<PodTemplate | null> {
    return templateRepository.findBySlug(tenantId, slug);
  }

  /**
   * List templates with filtering
   */
  async function listTemplates(params: ListTemplatesParams): Promise<{
    templates: TemplateWithRelations[];
    total: number;
  }> {
    const cacheKey = `templates:${params.tenantId || 'global'}:${JSON.stringify(params)}`;
    const cached = await cache.get<{ templates: TemplateWithRelations[]; total: number }>(cacheKey);
    if (cached) return cached;

    const result = await templateRepository.findMany(
      {
        tenantId: params.tenantId,
        category: params.category,
        tags: params.tags,
        search: params.search,
        includeGlobal: params.includeGlobal,
        isActive: true,
      },
      {
        page: params.page,
        limit: params.limit,
      }
    );

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Update template
   */
  async function updateTemplate(
    templateId: string,
    updates: UpdateTemplateParams
  ): Promise<PodTemplate> {
    const template = await templateRepository.findById(templateId);
    if (!template) {
      throw new TemplateError('TEMPLATE_NOT_FOUND', 'Template not found');
    }

    // If tools changed, rebuild image
    if (updates.installedTools) {
      const baseImage = await imageRepository.findById(updates.baseImageId || template.baseImageId);

      if (!baseImage) {
        throw new TemplateError('BASE_IMAGE_NOT_FOUND', 'Base image not found');
      }

      const imageUri = await buildTemplateImage(baseImage, updates.installedTools, {
        slug: template.slug,
        defaultResources: (updates.defaultResources || template.defaultResources) as ResourceSpec,
        environmentVars: (updates.environmentVars || template.environmentVars) as Record<
          string,
          string
        >,
        startupScript: updates.startupScript || template.startupScript || undefined,
      } as CreateTemplateParams);

      updates.ecrImageUri = imageUri;
    }

    // Increment version
    const newVersion = incrementVersion(template.version);

    const updatedTemplate = await templateRepository.update(templateId, {
      ...updates,
      version: newVersion,
    });

    // Invalidate cache
    await cache.delete(`template:${templateId}`);
    await cache.deletePattern('templates:*');

    return updatedTemplate;
  }

  /**
   * Delete template
   */
  async function deleteTemplate(templateId: string): Promise<void> {
    const template = await templateRepository.findById(templateId);
    if (!template) {
      throw new TemplateError('TEMPLATE_NOT_FOUND', 'Template not found');
    }

    await templateRepository.delete(templateId);

    // Invalidate cache
    await cache.delete(`template:${templateId}`);
    await cache.deletePattern('templates:*');
  }

  /**
   * Clone template with customizations
   */
  async function cloneTemplate(
    templateId: string,
    params: CloneTemplateParams
  ): Promise<PodTemplate> {
    const sourceTemplate = await templateRepository.findById(templateId);
    if (!sourceTemplate) {
      throw new TemplateError('TEMPLATE_NOT_FOUND', 'Source template not found');
    }

    // Merge tools
    let installedTools = [...(sourceTemplate.installedTools as ToolDefinition[])];

    if (params.customizations?.removeTools) {
      installedTools = installedTools.filter(
        (tool) => !params.customizations!.removeTools!.includes(tool.name)
      );
    }

    if (params.customizations?.additionalTools) {
      installedTools.push(...params.customizations.additionalTools);
    }

    // Merge resources
    const defaultResources: ResourceSpec = {
      ...(sourceTemplate.defaultResources as ResourceSpec),
      ...params.customizations?.overrideResources,
    };

    // Merge config
    const defaultConfig = {
      ...(sourceTemplate.defaultConfig as Record<string, unknown>),
      ...params.customizations?.overrideConfig,
    };

    return createTemplate({
      tenantId: params.tenantId,
      name: params.name,
      slug: params.slug,
      description: sourceTemplate.description || undefined,
      shortDescription: sourceTemplate.shortDescription || undefined,
      category: sourceTemplate.category,
      tags: sourceTemplate.tags,
      baseImageId: sourceTemplate.baseImageId,
      installedTools,
      defaultConfig,
      defaultResources,
      minResources: sourceTemplate.minResources as ResourceSpec,
      maxResources: sourceTemplate.maxResources as ResourceSpec,
      startupScript: sourceTemplate.startupScript || undefined,
      environmentVars: sourceTemplate.environmentVars as Record<string, string>,
      iconUrl: sourceTemplate.iconUrl || undefined,
      screenshotUrls: sourceTemplate.screenshotUrls,
      isPublic: false, // Cloned templates start as private
    });
  }

  /**
   * Rate a template
   */
  async function rateTemplate(params: RateTemplateParams): Promise<void> {
    if (params.rating < 1 || params.rating > 5) {
      throw new TemplateError('INVALID_RATING', 'Rating must be between 1 and 5');
    }

    await templateRepository.upsertRating({
      templateId: params.templateId,
      userId: params.userId,
      rating: params.rating,
      review: params.review,
    });

    // Recalculate average rating
    const ratings = await templateRepository.getRatings(params.templateId);
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await templateRepository.update(params.templateId, {
      avgRating,
      ratingCount: ratings.length,
    });

    // Invalidate cache
    await cache.delete(`template:${params.templateId}`);
  }

  /**
   * Increment template usage count
   */
  async function incrementUsageCount(templateId: string): Promise<void> {
    await templateRepository.incrementUsageCount(templateId);
    await cache.delete(`template:${templateId}`);
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  async function buildTemplateImage(
    baseImage: BaseImage,
    tools: ToolDefinition[],
    params: Partial<CreateTemplateParams>
  ): Promise<string> {
    // Generate Dockerfile
    const dockerfile = generateDockerfile(baseImage, tools, params);

    // Build and push to ECR
    const imageTag = `${params.slug}:${Date.now()}`;
    const imageUri = await ecrService.buildAndPush({
      repositoryName: 'skillancer-templates',
      imageTag,
      dockerfile,
      buildArgs: {
        BASE_IMAGE: `${baseImage.registryUri}:${baseImage.imageTag}`,
      },
    });

    return imageUri;
  }

  function generateDockerfile(
    baseImage: BaseImage,
    tools: ToolDefinition[],
    params: Partial<CreateTemplateParams>
  ): string {
    const lines: string[] = [
      `FROM ${baseImage.registryUri}:${baseImage.imageTag}`,
      '',
      '# Set environment variables',
      'ENV DEBIAN_FRONTEND=noninteractive',
    ];

    // Add custom environment variables
    if (params.environmentVars) {
      for (const [key, value] of Object.entries(params.environmentVars)) {
        lines.push(`ENV ${key}="${value}"`);
      }
    }

    lines.push('');
    lines.push('# Install tools');

    // Group tools by installation method
    const aptTools: string[] = [];
    const customTools: ToolDefinition[] = [];

    for (const tool of tools) {
      if (tool.installCommand) {
        customTools.push(tool);
      } else {
        aptTools.push(getAptPackageName(tool));
      }
    }

    // Install apt packages in one layer
    if (aptTools.length > 0) {
      lines.push('RUN apt-get update && apt-get install -y \\');
      lines.push(`    ${aptTools.join(' \\\n    ')} \\`);
      lines.push('    && rm -rf /var/lib/apt/lists/*');
    }

    // Install custom tools
    for (const tool of customTools) {
      lines.push('');
      lines.push(`# Install ${tool.name}`);
      lines.push(`RUN ${tool.installCommand}`);

      if (tool.verifyCommand) {
        lines.push(`RUN ${tool.verifyCommand}`);
      }
    }

    // Add startup script
    if (params.startupScript) {
      lines.push('');
      lines.push('# Add startup script');
      lines.push('COPY startup.sh /usr/local/bin/startup.sh');
      lines.push('RUN chmod +x /usr/local/bin/startup.sh');
    }

    // Set working directory
    lines.push('');
    lines.push('WORKDIR /home/kasm-user');
    lines.push('');
    lines.push('# Switch to non-root user');
    lines.push('USER 1000');

    return lines.join('\n');
  }

  function getAptPackageName(tool: ToolDefinition): string {
    const mapping: Record<string, string> = {
      Git: 'git',
      'Node.js': 'nodejs',
      Python: 'python3',
      'Python 3': 'python3',
      pip: 'python3-pip',
      Docker: 'docker.io',
      curl: 'curl',
      wget: 'wget',
      vim: 'vim',
      nano: 'nano',
    };

    return mapping[tool.name] || tool.name.toLowerCase();
  }

  async function registerWithKasm(params: CreateTemplateParams, imageUri: string): Promise<string> {
    // In production, this would call the Kasm API to register the image
    // For now, we'll generate a mock Kasm image ID
    const kasmImageId = `kasm-${params.slug}-${Date.now().toString(36)}`;

    console.log(`Registering image with Kasm:`);
    console.log(`  Name: ${params.name}`);
    console.log(`  Image URI: ${imageUri}`);
    console.log(`  Kasm ID: ${kasmImageId}`);

    return kasmImageId;
  }

  function getMinResources(category: TemplateCategory): ResourceSpec {
    const defaults: Record<TemplateCategory, ResourceSpec> = {
      DEVELOPMENT: { cpu: 2, memory: 4096, storage: 20, gpu: false },
      FINANCE: { cpu: 2, memory: 4096, storage: 20, gpu: false },
      DESIGN: { cpu: 4, memory: 8192, storage: 50, gpu: false },
      DATA_SCIENCE: { cpu: 4, memory: 8192, storage: 50, gpu: false },
      GENERAL: { cpu: 1, memory: 2048, storage: 10, gpu: false },
      SECURITY: { cpu: 2, memory: 4096, storage: 20, gpu: false },
      DEVOPS: { cpu: 2, memory: 4096, storage: 30, gpu: false },
      CUSTOM: { cpu: 1, memory: 2048, storage: 10, gpu: false },
    };

    return defaults[category];
  }

  function getMaxResources(category: TemplateCategory): ResourceSpec {
    const defaults: Record<TemplateCategory, ResourceSpec> = {
      DEVELOPMENT: { cpu: 8, memory: 32768, storage: 200, gpu: true },
      FINANCE: { cpu: 8, memory: 16384, storage: 100, gpu: false },
      DESIGN: { cpu: 16, memory: 65536, storage: 500, gpu: true },
      DATA_SCIENCE: { cpu: 32, memory: 131072, storage: 1000, gpu: true, gpuType: 'nvidia-t4' },
      GENERAL: { cpu: 4, memory: 8192, storage: 50, gpu: false },
      SECURITY: { cpu: 8, memory: 16384, storage: 100, gpu: false },
      DEVOPS: { cpu: 8, memory: 16384, storage: 200, gpu: false },
      CUSTOM: { cpu: 16, memory: 65536, storage: 500, gpu: true },
    };

    return defaults[category];
  }

  function estimateLaunchTime(params: CreateTemplateParams): number {
    let estimate = 60; // Base time in seconds

    // Add time for tools
    estimate += params.installedTools.length * 5;

    // Add time for storage
    estimate += Math.floor(params.defaultResources.storage / 10) * 5;

    // Add time for GPU
    if (params.defaultResources.gpu) {
      estimate += 30;
    }

    return Math.min(estimate, 300); // Cap at 5 minutes
  }

  function incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  return {
    createTemplate,
    getTemplateById,
    getTemplateBySlug,
    listTemplates,
    updateTemplate,
    deleteTemplate,
    cloneTemplate,
    rateTemplate,
    incrementUsageCount,
  };
}
