/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/contract-template
 * Contract Template data access layer
 */

import type {
  CreateContractTemplateInput,
  UpdateContractTemplateInput,
  ContractTemplateWithDetails,
} from '../types/contract.types.js';
import type { PrismaClient, Prisma, ContractTypeV2 } from '@skillancer/database';

/**
 * Contract Template Repository
 *
 * Handles database operations for contract templates.
 */
export class ContractTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a contract template
   */
  async create(data: CreateContractTemplateInput) {
    // If this is set as default, unset other defaults for same type
    if (data.isDefault) {
      await this.unsetDefaultForType(data.tenantId ?? null, data.contractType);
    }

    return this.prisma.contractTemplate.create({
      data: {
        tenantId: data.tenantId ?? null,
        name: data.name,
        description: data.description ?? null,
        contractType: data.contractType,
        rateType: data.rateType,
        templateContent: data.templateContent,
        variables: data.variables as Prisma.InputJsonValue,
        clauses: data.clauses as Prisma.InputJsonValue,
        isDefault: data.isDefault || false,
        isActive: true,
      },
    });
  }

  /**
   * Find template by ID
   */
  async findById(id: string) {
    return this.prisma.contractTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Find template by ID with usage count
   * Note: ContractV2 doesn't have templateId, so we can't count usage directly
   */
  async findByIdWithUsage(id: string): Promise<ContractTemplateWithDetails | null> {
    const template = await this.prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) return null;

    // Since ContractV2 doesn't track templateId, we can't count usage
    // This could be extended if contracts store template reference in metadata
    return { ...template, usageCount: 0 };
  }

  /**
   * Update template
   */
  async update(id: string, data: UpdateContractTemplateInput) {
    // If setting as default, unset other defaults for same type
    if (data.isDefault) {
      const template = await this.findById(id);
      if (template) {
        await this.unsetDefaultForType(template.tenantId, template.contractType);
      }
    }

    const updateData: Prisma.ContractTemplateUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.templateContent) updateData.templateContent = data.templateContent;
    if (data.variables) updateData.variables = data.variables as Prisma.InputJsonValue;
    if (data.clauses) updateData.clauses = data.clauses as Prisma.InputJsonValue;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    return this.prisma.contractTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete template (soft delete by setting inactive)
   */
  async delete(id: string) {
    return this.prisma.contractTemplate.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Hard delete template
   */
  async hardDelete(id: string) {
    return this.prisma.contractTemplate.delete({
      where: { id },
    });
  }

  /**
   * List templates for a tenant
   */
  async listByTenant(
    tenantId: string,
    options?: {
      contractType?: ContractTypeV2;
      isActive?: boolean;
      search?: string;
    }
  ): Promise<ContractTemplateWithDetails[]> {
    const where: Prisma.ContractTemplateWhereInput = { tenantId };

    if (options?.contractType) {
      where.contractType = options.contractType;
    }
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const templates = await this.prisma.contractTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    // Note: ContractV2 doesn't track templateId, so usage count is not available
    // If needed, could track template usage via metadata in contracts
    return templates.map((t) => ({
      ...t,
      usageCount: 0,
    }));
  }

  /**
   * Get default template for a contract type
   */
  async getDefault(tenantId: string, contractType: ContractTypeV2) {
    return this.prisma.contractTemplate.findFirst({
      where: {
        tenantId,
        contractType,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Get active templates for a contract type
   */
  async getActiveByType(tenantId: string, contractType: ContractTypeV2) {
    return this.prisma.contractTemplate.findMany({
      where: {
        tenantId,
        contractType,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Unset default flag for all templates of a type
   */
  private async unsetDefaultForType(tenantId: string | null, contractType: ContractTypeV2) {
    await this.prisma.contractTemplate.updateMany({
      where: {
        tenantId,
        contractType,
        isDefault: true,
      },
      data: {
        isDefault: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName: string) {
    const source = await this.findById(id);
    if (!source) {
      throw new Error('Template not found');
    }

    return this.prisma.contractTemplate.create({
      data: {
        tenantId: source.tenantId,
        name: newName,
        description: source.description,
        contractType: source.contractType,
        rateType: source.rateType,
        templateContent: source.templateContent,
        variables: source.variables as Prisma.InputJsonValue,
        clauses: source.clauses as Prisma.InputJsonValue,
        isDefault: false,
        isActive: true,
      },
    });
  }

  /**
   * Check if template name exists in tenant
   */
  async nameExists(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.ContractTemplateWhereInput = {
      tenantId,
      name,
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma.contractTemplate.count({ where });
    return count > 0;
  }

  /**
   * Get template statistics for a tenant
   */
  async getStatistics(tenantId: string) {
    const [total, active, byType] = await Promise.all([
      this.prisma.contractTemplate.count({ where: { tenantId } }),
      this.prisma.contractTemplate.count({ where: { tenantId, isActive: true } }),
      this.prisma.contractTemplate.groupBy({
        by: ['contractType'],
        where: { tenantId, isActive: true },
        _count: true,
      }),
    ]);

    const typeCounts: Partial<Record<ContractTypeV2, number>> = {};
    for (const t of byType) {
      typeCounts[t.contractType] = t._count;
    }

    return {
      total,
      active,
      inactive: total - active,
      byType: typeCounts,
    };
  }
}
