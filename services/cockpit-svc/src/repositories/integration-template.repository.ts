/**
 * @module @skillancer/cockpit-svc/repositories/integration-template
 * Integration Template Repository - Database operations for integration templates
 */

import type {
  IntegrationTemplate,
  IntegrationProvider,
  IntegrationAuthType,
  IntegrationCategory,
} from '../types/prisma-shim.js';
import type { PrismaClient } from '../types/prisma-shim.js';

export interface CreateTemplateParams {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  authType: IntegrationAuthType;
  logoUrl: string;
  color: string;
  capabilities?: string[];
  oauthConfig?: Record<string, unknown>;
  apiKeyConfig?: Record<string, unknown>;
  syncOptionsSchema?: Record<string, unknown>;
  setupInstructions?: string;
  helpUrl?: string;
  isAvailable?: boolean;
  isBeta?: boolean;
  isPremium?: boolean;
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  category?: IntegrationCategory;
  authType?: IntegrationAuthType;
  logoUrl?: string;
  color?: string;
  capabilities?: string[];
  oauthConfig?: Record<string, unknown>;
  apiKeyConfig?: Record<string, unknown>;
  syncOptionsSchema?: Record<string, unknown>;
  setupInstructions?: string;
  helpUrl?: string;
  isAvailable?: boolean;
  isBeta?: boolean;
  isPremium?: boolean;
}

export class IntegrationTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: CreateTemplateParams): Promise<IntegrationTemplate> {
    return this.prisma.integrationTemplate.create({
      data: {
        provider: params.provider,
        name: params.name,
        description: params.description,
        category: params.category,
        authType: params.authType,
        logoUrl: params.logoUrl,
        color: params.color,
        capabilities: params.capabilities ?? [],
        oauthConfig: (params.oauthConfig as object) ?? undefined,
        apiKeyConfig: (params.apiKeyConfig as object) ?? undefined,
        syncOptionsSchema: (params.syncOptionsSchema as object) ?? undefined,
        setupInstructions: params.setupInstructions,
        helpUrl: params.helpUrl,
        isAvailable: params.isAvailable ?? true,
        isBeta: params.isBeta ?? false,
        isPremium: params.isPremium ?? false,
      },
    });
  }

  async findById(id: string): Promise<IntegrationTemplate | null> {
    return this.prisma.integrationTemplate.findUnique({
      where: { id },
    });
  }

  async findByProvider(provider: IntegrationProvider): Promise<IntegrationTemplate | null> {
    return this.prisma.integrationTemplate.findUnique({
      where: { provider },
    });
  }

  async findAvailable(): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: { isAvailable: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findByCategory(category: IntegrationCategory): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        category,
        isAvailable: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findByAuthType(authType: IntegrationAuthType): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        authType,
        isAvailable: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findNonPremium(): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        isAvailable: true,
        isPremium: false,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findPremium(): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        isAvailable: true,
        isPremium: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findBeta(): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        isAvailable: true,
        isBeta: true,
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async search(query: string): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      where: {
        isAvailable: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async update(id: string, params: UpdateTemplateParams): Promise<IntegrationTemplate> {
    return this.prisma.integrationTemplate.update({
      where: { id },
      data: {
        name: params.name,
        description: params.description,
        category: params.category,
        authType: params.authType,
        logoUrl: params.logoUrl,
        color: params.color,
        capabilities: params.capabilities,
        oauthConfig: (params.oauthConfig as object) ?? undefined,
        apiKeyConfig: (params.apiKeyConfig as object) ?? undefined,
        syncOptionsSchema: (params.syncOptionsSchema as object) ?? undefined,
        setupInstructions: params.setupInstructions,
        helpUrl: params.helpUrl,
        isAvailable: params.isAvailable,
        isBeta: params.isBeta,
        isPremium: params.isPremium,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integrationTemplate.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.integrationTemplate.update({
      where: { id },
      data: { isAvailable: false },
    });
  }

  async countByCategory(): Promise<{ category: IntegrationCategory; count: number }[]> {
    const result = await this.prisma.integrationTemplate.groupBy({
      by: ['category'],
      where: { isAvailable: true },
      _count: { _all: true },
    });

    return result.map((r) => ({
      category: r.category,
      count: r._count._all,
    }));
  }

  async getAll(): Promise<IntegrationTemplate[]> {
    return this.prisma.integrationTemplate.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
