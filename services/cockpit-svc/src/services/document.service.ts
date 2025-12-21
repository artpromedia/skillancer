/**
 * @module @skillancer/cockpit-svc/services/document
 * Document Service - Manages client documents and files
 */

import { CrmError, CrmErrorCode } from '../errors/crm.errors.js';
import { DocumentRepository, ClientRepository } from '../repositories/index.js';

import type {
  CreateDocumentParams,
  UpdateDocumentParams,
  DocumentSummary,
} from '../types/crm.types.js';
import type { PrismaClient, CrmDocumentType } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Allowed file extensions by document type
const ALLOWED_EXTENSIONS: Record<CrmDocumentType, string[]> = {
  CONTRACT: ['pdf', 'doc', 'docx'],
  PROPOSAL: ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
  INVOICE: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  BRIEF: ['pdf', 'doc', 'docx', 'txt', 'md'],
  DELIVERABLE: ['pdf', 'zip', 'png', 'jpg', 'jpeg', 'psd', 'ai', 'fig'],
  REFERENCE: ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'],
  OTHER: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'md',
    'zip',
    'png',
    'jpg',
    'jpeg',
  ],
};

// Max file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface DocumentSearchOptions {
  freelancerUserId: string;
  clientId?: string;
  documentType?: CrmDocumentType[];
  tags?: string[];
  page?: number;
  limit?: number;
}

export class DocumentService {
  private readonly documentRepository: DocumentRepository;
  private readonly clientRepository: ClientRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.documentRepository = new DocumentRepository(prisma);
    this.clientRepository = new ClientRepository(prisma);
  }

  /**
   * Create a document record
   */
  async createDocument(params: CreateDocumentParams) {
    // Validate client belongs to freelancer
    const client = await this.clientRepository.findById(params.clientId);
    if (!client || client.freelancerUserId !== params.freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    // Validate file extension
    const extension = this.getFileExtension(params.fileName);
    if (!this.isAllowedExtension(params.documentType, extension)) {
      throw new CrmError(CrmErrorCode.INVALID_DOCUMENT_TYPE);
    }

    // Validate file size
    if (params.fileSize && params.fileSize > MAX_FILE_SIZE) {
      throw new CrmError(CrmErrorCode.FILE_TOO_LARGE);
    }

    const document = await this.documentRepository.create({
      freelancerUserId: params.freelancerUserId,
      clientId: params.clientId,
      name: params.name,
      documentType: params.documentType,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      description: params.description ?? null,
      tags: params.tags ?? [],
      projectId: params.projectId ?? null,
      contractId: params.contractId ?? null,
    });

    this.logger.info(
      {
        documentId: document.id,
        clientId: params.clientId,
        documentType: params.documentType,
      },
      'Document created'
    );

    return document;
  }

  /**
   * Get a document by ID
   */
  async getDocument(documentId: string, freelancerUserId: string) {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new CrmError(CrmErrorCode.DOCUMENT_NOT_FOUND);
    }

    if (document.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    return document;
  }

  /**
   * Update a document
   */
  async updateDocument(
    documentId: string,
    freelancerUserId: string,
    updates: UpdateDocumentParams
  ) {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new CrmError(CrmErrorCode.DOCUMENT_NOT_FOUND);
    }

    if (document.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    const updatedDocument = await this.documentRepository.update(documentId, {
      name: updates.name,
      description: updates.description ?? null,
      documentType: updates.documentType,
      tags: updates.tags,
    });

    this.logger.info({ documentId }, 'Document updated');

    return updatedDocument;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, freelancerUserId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new CrmError(CrmErrorCode.DOCUMENT_NOT_FOUND);
    }

    if (document.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    await this.documentRepository.delete(documentId);

    this.logger.info({ documentId }, 'Document deleted');
  }

  /**
   * Search documents
   */
  async searchDocuments(params: DocumentSearchOptions): Promise<{
    documents: DocumentSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    if (params.clientId) {
      const result = await this.documentRepository.findByClient(params.clientId, {
        documentType: params.documentType,
        tags: params.tags,
        page,
        limit,
      });

      return {
        documents: result.documents.map((d) => this.formatDocumentSummary(d)),
        total: result.total,
        page,
        limit,
      };
    }

    return {
      documents: [],
      total: 0,
      page,
      limit,
    };
  }

  /**
   * Get documents for a client
   */
  async getClientDocuments(
    clientId: string,
    freelancerUserId: string,
    options?: { documentType?: CrmDocumentType[]; limit?: number }
  ): Promise<DocumentSummary[]> {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const result = await this.documentRepository.findByClient(clientId, {
      documentType: options?.documentType,
      limit: options?.limit,
    });

    return result.documents.map((d) => this.formatDocumentSummary(d));
  }

  /**
   * Get recent documents for freelancer
   */
  async getRecentDocuments(
    freelancerUserId: string,
    limit: number = 10
  ): Promise<DocumentSummary[]> {
    const clients = await this.prisma.client.findMany({
      where: { freelancerUserId },
      select: { id: true },
    });

    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      return [];
    }

    const documents = await this.prisma.clientDocument.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return documents.map((d) => this.formatDocumentSummary(d));
  }

  /**
   * Search documents by tag
   */
  async searchByTag(freelancerUserId: string, tag: string): Promise<DocumentSummary[]> {
    const clients = await this.prisma.client.findMany({
      where: { freelancerUserId },
      select: { id: true },
    });

    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      return [];
    }

    const documents = await this.prisma.clientDocument.findMany({
      where: {
        clientId: { in: clientIds },
        tags: { has: tag },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((d) => this.formatDocumentSummary(d));
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(freelancerUserId: string): Promise<{
    total: number;
    byType: Partial<Record<CrmDocumentType, number>>;
    totalSize: number;
    recentCount: number;
  }> {
    const clients = await this.prisma.client.findMany({
      where: { freelancerUserId },
      select: { id: true },
    });

    const clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0) {
      return {
        total: 0,
        byType: {},
        totalSize: 0,
        recentCount: 0,
      };
    }

    const documents = await this.prisma.clientDocument.findMany({
      where: { clientId: { in: clientIds } },
    });

    const byType = documents.reduce((acc: Partial<Record<CrmDocumentType, number>>, d) => {
      acc[d.documentType] = (acc[d.documentType] ?? 0) + 1;
      return acc;
    }, {});

    const totalSize = documents.reduce((sum, d) => sum + (d.fileSize ?? 0), 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCount = documents.filter((d) => d.createdAt >= thirtyDaysAgo).length;

    return {
      total: documents.length,
      byType,
      totalSize,
      recentCount,
    };
  }

  /**
   * Generate pre-signed upload URL
   */
  async getUploadUrl(
    freelancerUserId: string,
    clientId: string,
    fileName: string,
    documentType: CrmDocumentType
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const extension = this.getFileExtension(fileName);
    if (!this.isAllowedExtension(documentType, extension)) {
      throw new CrmError(CrmErrorCode.INVALID_DOCUMENT_TYPE);
    }

    const fileKey = `crm/${freelancerUserId}/${clientId}/${Date.now()}-${fileName}`;

    return {
      uploadUrl: `https://storage.example.com/upload?key=${fileKey}`,
      fileUrl: `https://storage.example.com/${fileKey}`,
    };
  }

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? '') : '';
  }

  private isAllowedExtension(documentType: CrmDocumentType, extension: string): boolean {
    const allowed = ALLOWED_EXTENSIONS[documentType] ?? ALLOWED_EXTENSIONS.OTHER;
    return allowed.includes(extension);
  }

  private formatDocumentSummary(document: {
    id: string;
    name: string;
    documentType: CrmDocumentType;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    description: string | null;
    tags: string[];
    clientId: string;
    projectId: string | null;
    contractId: string | null;
    createdAt: Date;
  }): DocumentSummary {
    return {
      id: document.id,
      name: document.name,
      documentType: document.documentType,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      description: document.description,
      tags: document.tags,
      projectId: document.projectId,
      contractId: document.contractId,
      createdAt: document.createdAt,
    };
  }
}
