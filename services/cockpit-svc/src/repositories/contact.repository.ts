// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/contact
 * Client Contact data access layer
 */

import type { PrismaClient, ContactRole } from '../types/prisma-shim.js';

export class ContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new contact
   */
  async create(data: {
    clientId: string;
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    role: ContactRole;
    isPrimary: boolean;
    notes?: string | null;
  }) {
    return this.prisma.clientContact.create({
      data: {
        clientId: data.clientId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        role: data.role,
        isPrimary: data.isPrimary,
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Find a contact by ID
   */
  async findById(id: string) {
    return this.prisma.clientContact.findUnique({
      where: { id },
    });
  }

  /**
   * Find contacts by client
   */
  async findByClient(clientId: string, options?: { includeInactive?: boolean }) {
    return this.prisma.clientContact.findMany({
      where: {
        clientId,
        ...(options?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update a contact
   */
  async update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      jobTitle: string | null;
      department: string | null;
      role: ContactRole;
      isPrimary: boolean;
      notes: string | null;
      isActive: boolean;
    }>
  ) {
    return this.prisma.clientContact.update({
      where: { id },
      data,
    });
  }

  /**
   * Clear primary flag for all contacts of a client
   */
  async clearPrimary(clientId: string) {
    return this.prisma.clientContact.updateMany({
      where: { clientId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  /**
   * Delete a contact
   */
  async delete(id: string) {
    return this.prisma.clientContact.delete({
      where: { id },
    });
  }
}
