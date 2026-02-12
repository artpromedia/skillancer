// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/custom-field
 * CRM Custom Field data access layer
 */

import type { PrismaClient, CrmEntityType, CustomFieldType } from '../types/prisma-shim.js';

export class CustomFieldRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new custom field
   */
  async create(data: {
    freelancerUserId: string;
    entityType: CrmEntityType;
    fieldName: string;
    fieldLabel: string;
    fieldType: CustomFieldType;
    options?: string[];
    isRequired?: boolean;
    defaultValue?: string | null;
    displayOrder?: number;
    isVisible?: boolean;
  }) {
    return this.prisma.crmCustomField.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        entityType: data.entityType,
        fieldName: data.fieldName,
        fieldLabel: data.fieldLabel,
        fieldType: data.fieldType,
        options: data.options ?? [],
        isRequired: data.isRequired ?? false,
        defaultValue: data.defaultValue ?? null,
        displayOrder: data.displayOrder ?? 0,
        isVisible: data.isVisible ?? true,
      },
    });
  }

  /**
   * Find a custom field by ID
   */
  async findById(id: string) {
    return this.prisma.crmCustomField.findUnique({
      where: { id },
    });
  }

  /**
   * Find custom fields by freelancer and entity type
   */
  async findByFreelancerAndEntityType(freelancerUserId: string, entityType: CrmEntityType) {
    return this.prisma.crmCustomField.findMany({
      where: {
        freelancerUserId,
        entityType,
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Find a custom field by name
   */
  async findByName(freelancerUserId: string, entityType: CrmEntityType, fieldName: string) {
    return this.prisma.crmCustomField.findUnique({
      where: {
        freelancerUserId_entityType_fieldName: {
          freelancerUserId,
          entityType,
          fieldName,
        },
      },
    });
  }

  /**
   * Update a custom field
   */
  async update(
    id: string,
    data: Partial<{
      fieldLabel: string;
      fieldType: CustomFieldType;
      options: string[];
      isRequired: boolean;
      defaultValue: string | null;
      displayOrder: number;
      isVisible: boolean;
    }>
  ) {
    return this.prisma.crmCustomField.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a custom field
   */
  async delete(id: string) {
    return this.prisma.crmCustomField.delete({
      where: { id },
    });
  }
}
