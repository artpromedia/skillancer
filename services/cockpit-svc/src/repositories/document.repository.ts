/**
 * @module @skillancer/cockpit-svc/repositories/document
 * Client Document data access layer
 */

import type { PrismaClient, CrmDocumentType } from '@skillancer/database';

export class DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new document
   */
  async create(data: {
    clientId: string;
    freelancerUserId: string;
    name: string;
    description?: string | null;
    documentType: CrmDocumentType;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    tags?: string[];
    projectId?: string | null;
    contractId?: string | null;
  }) {
    return this.prisma.clientDocument.create({
      data: {
        clientId: data.clientId,
        freelancerUserId: data.freelancerUserId,
        name: data.name,
        description: data.description ?? null,
        documentType: data.documentType,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        tags: data.tags ?? [],
        projectId: data.projectId ?? null,
        contractId: data.contractId ?? null,
      },
    });
  }

  /**
   * Find a document by ID
   */
  async findById(id: string) {
    return this.prisma.clientDocument.findUnique({
      where: { id },
    });
  }

  /**
   * Find documents by client
   */
  async findByClient(
    clientId: string,
    options?: {
      documentType?: CrmDocumentType[];
      tags?: string[];
      page?: number;
      limit?: number;
    }
  ) {
    const { documentType, tags, page = 1, limit = 20 } = options || {};

    const where = {
      clientId,
      ...(documentType && documentType.length > 0 && { documentType: { in: documentType } }),
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
    };

    const [documents, total] = await Promise.all([
      this.prisma.clientDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientDocument.count({ where }),
    ]);

    return { documents, total };
  }

  /**
   * Update a document
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      documentType: CrmDocumentType;
      tags: string[];
      projectId: string | null;
      contractId: string | null;
    }>
  ) {
    return this.prisma.clientDocument.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a document
   */
  async delete(id: string) {
    return this.prisma.clientDocument.delete({
      where: { id },
    });
  }
}
