// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/time-category
 * Time Category data access layer
 */

import type { PrismaClient, TimeCategory, Prisma } from '@skillancer/database';

export class TimeCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find category by ID
   */
  async findById(id: string): Promise<TimeCategory | null> {
    return this.prisma.timeCategory.findUnique({
      where: { id },
    });
  }

  /**
   * Find categories by user (including system categories)
   */
  async findByUser(userId: string): Promise<TimeCategory[]> {
    return this.prisma.timeCategory.findMany({
      where: {
        OR: [{ freelancerUserId: userId }, { freelancerUserId: null, isSystem: true }],
        isActive: true,
      },
      orderBy: [{ isSystem: 'desc' }, { orderIndex: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find category by name for user
   */
  async findByName(userId: string | null, name: string): Promise<TimeCategory | null> {
    return this.prisma.timeCategory.findUnique({
      where: {
        freelancerUserId_name: {
          freelancerUserId: userId ?? '',
          name,
        },
      },
    });
  }

  /**
   * Create category
   */
  async create(data: {
    freelancerUserId?: string | null;
    name: string;
    color?: string | null;
    icon?: string | null;
    defaultBillable?: boolean;
    orderIndex?: number;
    isSystem?: boolean;
  }): Promise<TimeCategory> {
    return this.prisma.timeCategory.create({
      data: {
        freelancerUserId: data.freelancerUserId ?? null,
        name: data.name,
        color: data.color ?? null,
        icon: data.icon ?? null,
        defaultBillable: data.defaultBillable ?? true,
        orderIndex: data.orderIndex ?? 0,
        isSystem: data.isSystem ?? false,
        isActive: true,
      },
    });
  }

  /**
   * Update category
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      color: string | null;
      icon: string | null;
      defaultBillable: boolean;
      orderIndex: number;
      isActive: boolean;
    }>
  ): Promise<TimeCategory> {
    const updateData: Prisma.TimeCategoryUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.defaultBillable !== undefined) updateData.defaultBillable = data.defaultBillable;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.timeCategory.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete category (soft delete by marking inactive)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.timeCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete category
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.timeCategory.delete({
      where: { id },
    });
  }

  /**
   * Reorder categories
   */
  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      orderedIds.map((id, index) =>
        this.prisma.timeCategory.updateMany({
          where: { id, freelancerUserId: userId },
          data: { orderIndex: index },
        })
      )
    );
  }

  /**
   * Get system categories
   */
  async getSystemCategories(): Promise<TimeCategory[]> {
    return this.prisma.timeCategory.findMany({
      where: {
        isSystem: true,
        isActive: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Ensure system categories exist
   */
  async ensureSystemCategories(): Promise<void> {
    const systemCategories = [
      { name: 'Development', color: '#3B82F6', icon: 'code' },
      { name: 'Design', color: '#8B5CF6', icon: 'palette' },
      { name: 'Meeting', color: '#F59E0B', icon: 'users' },
      { name: 'Research', color: '#10B981', icon: 'search' },
      { name: 'Writing', color: '#EC4899', icon: 'file-text' },
      { name: 'Admin', color: '#6B7280', icon: 'settings' },
      { name: 'Communication', color: '#06B6D4', icon: 'message-circle' },
      { name: 'Testing', color: '#EF4444', icon: 'check-circle' },
    ];

    for (let i = 0; i < systemCategories.length; i++) {
      const cat = systemCategories[i];
      if (!cat) continue;

      const existing = await this.prisma.timeCategory.findFirst({
        where: { name: cat.name, isSystem: true },
      });

      if (!existing) {
        await this.prisma.timeCategory.create({
          data: {
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            freelancerUserId: null,
            defaultBillable: true,
            orderIndex: i,
            isSystem: true,
            isActive: true,
          },
        });
      }
    }
  }

  /**
   * Count time entries using a category
   */
  async countEntriesUsingCategory(categoryName: string, userId: string): Promise<number> {
    return this.prisma.cockpitTimeEntry.count({
      where: {
        freelancerUserId: userId,
        category: categoryName,
      },
    });
  }
}

