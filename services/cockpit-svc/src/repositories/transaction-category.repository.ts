// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/transaction-category
 * Transaction Category data access layer
 */

import type {
  CreateCategoryParams,
  UpdateCategoryParams,
  CategoryFilters,
  CategoryWithStats,
} from '../types/finance.types.js';
import type { TransactionCategory, FinancialTransactionType } from '@prisma/client';
import type { Prisma, PrismaClient } from '@skillancer/database';

// Default IRS Schedule C categories for freelancers
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Advertising', irsCategory: 'Advertising', scheduleC: 'Line 8' },
  { name: 'Car & Truck', irsCategory: 'Car and truck expenses', scheduleC: 'Line 9' },
  { name: 'Commissions & Fees', irsCategory: 'Commissions and fees', scheduleC: 'Line 10' },
  { name: 'Contract Labor', irsCategory: 'Contract labor', scheduleC: 'Line 11' },
  { name: 'Depreciation', irsCategory: 'Depreciation', scheduleC: 'Line 13' },
  { name: 'Insurance', irsCategory: 'Insurance (other than health)', scheduleC: 'Line 15' },
  { name: 'Interest', irsCategory: 'Interest', scheduleC: 'Line 16' },
  {
    name: 'Legal & Professional',
    irsCategory: 'Legal and professional services',
    scheduleC: 'Line 17',
  },
  { name: 'Office Expense', irsCategory: 'Office expense', scheduleC: 'Line 18' },
  { name: 'Rent & Lease', irsCategory: 'Rent or lease', scheduleC: 'Line 20' },
  { name: 'Repairs & Maintenance', irsCategory: 'Repairs and maintenance', scheduleC: 'Line 21' },
  { name: 'Supplies', irsCategory: 'Supplies', scheduleC: 'Line 22' },
  { name: 'Taxes & Licenses', irsCategory: 'Taxes and licenses', scheduleC: 'Line 23' },
  { name: 'Travel', irsCategory: 'Travel', scheduleC: 'Line 24a' },
  { name: 'Meals', irsCategory: 'Meals', scheduleC: 'Line 24b' },
  { name: 'Utilities', irsCategory: 'Utilities', scheduleC: 'Line 25' },
  { name: 'Software & Subscriptions', irsCategory: 'Other expenses', scheduleC: 'Line 27a' },
  { name: 'Bank Fees', irsCategory: 'Other expenses', scheduleC: 'Line 27a' },
  { name: 'Education & Training', irsCategory: 'Other expenses', scheduleC: 'Line 27a' },
  {
    name: 'Home Office',
    irsCategory: 'Expenses for business use of your home',
    scheduleC: 'Line 30',
  },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Client Payment', irsCategory: 'Gross receipts or sales' },
  { name: 'Product Sales', irsCategory: 'Gross receipts or sales' },
  { name: 'Consulting', irsCategory: 'Gross receipts or sales' },
  { name: 'Royalties', irsCategory: 'Gross receipts or sales' },
  { name: 'Affiliate Income', irsCategory: 'Gross receipts or sales' },
  { name: 'Returns & Allowances', irsCategory: 'Returns and allowances' },
  { name: 'Other Income', irsCategory: 'Gross receipts or sales' },
];

export class TransactionCategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new category
   */
  async create(data: CreateCategoryParams): Promise<TransactionCategory> {
    return this.prisma.transactionCategory.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        irsCategory: data.irsCategory ?? null,
        isDeductible: data.isDeductible ?? true,
        isSystem: false,
      },
    });
  }

  /**
   * Create default categories for a new user
   */
  async createDefaultCategories(userId: string): Promise<void> {
    const categories: Prisma.TransactionCategoryCreateManyInput[] = [
      // Expense categories
      ...DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
        userId,
        name: cat.name,
        type: 'EXPENSE' as FinancialTransactionType,
        irsCategory: cat.irsCategory,
        isDeductible: true,
        isSystem: true,
      })),
      // Income categories
      ...DEFAULT_INCOME_CATEGORIES.map((cat) => ({
        userId,
        name: cat.name,
        type: 'INCOME' as FinancialTransactionType,
        irsCategory: cat.irsCategory,
        isSystem: true,
      })),
    ];

    await this.prisma.transactionCategory.createMany({
      data: categories,
      skipDuplicates: true,
    });
  }

  /**
   * Find category by ID
   */
  async findById(id: string): Promise<TransactionCategory | null> {
    return this.prisma.transactionCategory.findUnique({
      where: { id },
    });
  }

  /**
   * Find category by ID with children
   */
  async findByIdWithChildren(
    id: string
  ): Promise<(TransactionCategory & { children: TransactionCategory[] }) | null> {
    return this.prisma.transactionCategory.findUnique({
      where: { id },
      include: { children: true },
    });
  }

  /**
   * Find categories by user with filters
   */
  async findByFilters(filters: CategoryFilters): Promise<TransactionCategory[]> {
    const where: Prisma.TransactionCategoryWhereInput = {
      userId: filters.userId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isSystem !== undefined) {
      where.isSystem = filters.isSystem;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Only get root categories if hierarchy is requested (children loaded separately)
    if (filters.includeHierarchy) {
      where.parentId = null;
    }

    const categories = await this.prisma.transactionCategory.findMany({
      where,
      include: filters.includeHierarchy
        ? { children: { where: { isActive: true }, orderBy: { name: 'asc' } } }
        : undefined,
      orderBy: { name: 'asc' },
    });

    return categories;
  }

  /**
   * Find all categories for a user
   */
  async findByUserId(
    userId: string,
    type?: FinancialTransactionType
  ): Promise<TransactionCategory[]> {
    return this.prisma.transactionCategory.findMany({
      where: {
        userId,
        isActive: true,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find categories with transaction stats
   */
  async findWithStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CategoryWithStats[]> {
    // Get categories with children
    const categories = await this.prisma.transactionCategory.findMany({
      where: { userId, isActive: true, parentId: null },
      include: {
        children: { where: { isActive: true } },
      },
    });

    // Get transaction stats by category name
    const transactionStats = await this.prisma.financialTransaction.groupBy({
      by: ['category'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // Create a map for quick lookup
    const statsMap = new Map(
      transactionStats.map((stat) => [
        stat.category,
        {
          count: stat._count.id,
          amount: Number(stat._sum.amount ?? 0),
        },
      ])
    );

    return categories.map((category) => {
      const stats = statsMap.get(category.name) ?? { count: 0, amount: 0 };

      // Calculate child stats if any
      const children = category.children.map((child) => {
        const childStats = statsMap.get(child.name) ?? { count: 0, amount: 0 };
        return {
          ...child,
          transactionCount: childStats.count,
          totalAmount: childStats.amount,
        };
      });

      return {
        ...category,
        transactionCount: stats.count,
        totalAmount: stats.amount,
        children: children.length > 0 ? children : undefined,
      } as CategoryWithStats;
    });
  }

  /**
   * Find category by name and type for a user
   */
  async findByName(
    userId: string,
    name: string,
    type: FinancialTransactionType
  ): Promise<TransactionCategory | null> {
    return this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        type,
      },
    });
  }

  /**
   * Update a category
   */
  async update(id: string, data: UpdateCategoryParams): Promise<TransactionCategory> {
    return this.prisma.transactionCategory.update({
      where: { id },
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        irsCategory: data.irsCategory,
        isDeductible: data.isDeductible,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Soft delete a category
   */
  async softDelete(id: string): Promise<TransactionCategory> {
    return this.prisma.transactionCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Delete a category (only if not in use)
   */
  async delete(id: string): Promise<void> {
    await this.prisma.transactionCategory.delete({
      where: { id },
    });
  }

  /**
   * Count transactions using a category
   */
  async countTransactionsByName(userId: string, categoryName: string): Promise<number> {
    return this.prisma.financialTransaction.count({
      where: { userId, category: categoryName },
    });
  }

  /**
   * Check if user has categories (for initialization)
   */
  async userHasCategories(userId: string): Promise<boolean> {
    const count = await this.prisma.transactionCategory.count({
      where: { userId },
    });
    return count > 0;
  }

  /**
   * Get category suggestions based on vendor name
   */
  async getCategorySuggestion(userId: string, vendor: string): Promise<TransactionCategory | null> {
    // Find most common category used for this vendor
    const result = await this.prisma.financialTransaction.groupBy({
      by: ['category'],
      where: {
        userId,
        vendor: { equals: vendor, mode: 'insensitive' },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    const topResult = result[0];
    if (!topResult || !topResult.category) {
      return null;
    }

    // Find the category by name
    return this.findByNameAnyType(userId, topResult.category);
  }

  /**
   * Find category by name for a user (any type)
   */
  async findByNameAnyType(userId: string, name: string): Promise<TransactionCategory | null> {
    return this.prisma.transactionCategory.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }
}

