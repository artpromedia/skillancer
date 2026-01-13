/**
 * @module @skillancer/cockpit-svc/repositories/integration-mapping
 * Integration Mapping Repository - Database operations for entity mappings
 */

import type { CreateMappingParams, UpdateMappingParams } from '../types/integration.types.js';
import type {
  IntegrationMapping,
  MappingEntityType,
  IntegrationSyncDirection,
  Prisma,
} from '../types/prisma-shim.js';
import type { PrismaClient } from '../types/prisma-shim.js';

export class IntegrationMappingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: CreateMappingParams): Promise<IntegrationMapping> {
    return this.prisma.integrationMapping.create({
      data: {
        integrationId: params.integrationId,
        entityType: params.entityType,
        externalId: params.externalId,
        externalType: params.externalType,
        externalName: params.externalName,
        externalData: (params.externalData as Prisma.InputJsonValue) ?? undefined,
        internalId: params.internalId,
        internalType: params.internalType,
        syncDirection: params.syncDirection ?? 'BIDIRECTIONAL',
        isActive: params.isActive ?? true,
      },
    });
  }

  async upsert(params: CreateMappingParams): Promise<IntegrationMapping> {
    const existing = await this.findByExternalId(
      params.integrationId,
      params.entityType,
      params.externalId
    );

    if (existing) {
      return this.prisma.integrationMapping.update({
        where: { id: existing.id },
        data: {
          internalId: params.internalId,
          internalType: params.internalType,
          externalType: params.externalType,
          externalName: params.externalName,
          externalData: (params.externalData as Prisma.InputJsonValue) ?? undefined,
          syncDirection: params.syncDirection,
          lastSyncAt: new Date(),
          isActive: params.isActive ?? true,
        },
      });
    }

    return this.create(params);
  }

  async findById(id: string): Promise<IntegrationMapping | null> {
    return this.prisma.integrationMapping.findUnique({
      where: { id },
    });
  }

  async findByIntegration(integrationId: string): Promise<IntegrationMapping[]> {
    return this.prisma.integrationMapping.findMany({
      where: {
        integrationId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByExternalId(
    integrationId: string,
    entityType: MappingEntityType,
    externalId: string
  ): Promise<IntegrationMapping | null> {
    return this.prisma.integrationMapping.findFirst({
      where: {
        integrationId,
        entityType,
        externalId,
      },
    });
  }

  async findByInternalId(
    integrationId: string,
    internalId: string,
    internalType: string
  ): Promise<IntegrationMapping | null> {
    return this.prisma.integrationMapping.findFirst({
      where: {
        integrationId,
        internalId,
        internalType,
      },
    });
  }

  async findByEntityType(
    integrationId: string,
    entityType: MappingEntityType
  ): Promise<IntegrationMapping[]> {
    return this.prisma.integrationMapping.findMany({
      where: {
        integrationId,
        entityType,
        isActive: true,
      },
    });
  }

  async findByExternalIds(
    integrationId: string,
    entityType: MappingEntityType,
    externalIds: string[]
  ): Promise<IntegrationMapping[]> {
    return this.prisma.integrationMapping.findMany({
      where: {
        integrationId,
        entityType,
        externalId: { in: externalIds },
        isActive: true,
      },
    });
  }

  async update(id: string, params: UpdateMappingParams): Promise<IntegrationMapping> {
    return this.prisma.integrationMapping.update({
      where: { id },
      data: {
        externalType: params.externalType,
        externalName: params.externalName,
        externalData: (params.externalData as Prisma.InputJsonValue) ?? undefined,
        syncDirection: params.syncDirection,
        lastSyncAt: params.lastSyncAt,
        lastSyncHash: params.lastSyncHash,
        isActive: params.isActive,
      },
    });
  }

  async updateLastSync(id: string, syncHash?: string): Promise<void> {
    await this.prisma.integrationMapping.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastSyncHash: syncHash,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.integrationMapping.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.integrationMapping.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deleteByIntegration(integrationId: string): Promise<number> {
    const result = await this.prisma.integrationMapping.deleteMany({
      where: { integrationId },
    });
    return result.count;
  }

  async countByIntegration(integrationId: string): Promise<number> {
    return this.prisma.integrationMapping.count({
      where: {
        integrationId,
        isActive: true,
      },
    });
  }

  async getMappingSummary(
    integrationId: string
  ): Promise<{ entityType: MappingEntityType; count: number }[]> {
    const result = await this.prisma.integrationMapping.groupBy({
      by: ['entityType'],
      where: {
        integrationId,
        isActive: true,
      },
      _count: { _all: true },
    });

    return result.map((r) => ({
      entityType: r.entityType,
      count: r._count._all,
    }));
  }
}
