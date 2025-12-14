/**
 * @module @skillancer/audit-svc/services/audit-export.service
 * Audit log export service with S3 integration
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-redundant-type-constituents */
// Prisma client types are not available until `prisma generate` is run

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { type S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import * as auditLogRepository from '../repositories/audit-log.repository.js';
import {
  type AuditExport,
  type AuditCategory,
  ExportStatus,
  ExportFormat,
} from '../types/index.js';

import type { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;
let s3Client: S3Client | null = null;
let bucketName: string = '';

export function initializeExportService(
  prismaClient: PrismaClient,
  s3: S3Client,
  bucket: string
): void {
  prisma = prismaClient;
  s3Client = s3;
  bucketName = bucket;
}

export async function createExport(params: {
  requestedBy: string;
  filters: Record<string, unknown>;
  format: ExportFormat;
  includeFields?: string[];
}): Promise<AuditExport> {
  if (!prisma) {
    throw new Error('Export service not initialized');
  }

  const record = await prisma.auditExport.create({
    data: {
      status: ExportStatus.PENDING,
      requestedBy: params.requestedBy,
      filters: params.filters,
      format: params.format,
      includeFields: params.includeFields ?? [],
    },
  });

  return {
    id: record.id,
    status: record.status as ExportStatus,
    requestedBy: record.requestedBy,
    filters: record.filters as Record<string, unknown>,
    format: record.format as ExportFormat,
    includeFields: record.includeFields,
    fileUrl: record.fileUrl ?? undefined,
    fileSize: record.fileSize ?? undefined,
    recordCount: record.recordCount ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    startedAt: record.startedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    createdAt: record.createdAt,
  };
}

export async function processExport(exportId: string): Promise<AuditExport> {
  if (!prisma || !s3Client) {
    throw new Error('Export service not initialized');
  }

  await prisma.auditExport.update({
    where: { id: exportId },
    data: {
      status: ExportStatus.PROCESSING,
      startedAt: new Date(),
    },
  });

  try {
    const exportRecord = await prisma.auditExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    const filters = exportRecord.filters as Record<string, unknown>;
    const format = exportRecord.format as ExportFormat;

    const logs = await auditLogRepository.findAuditLogs(
      {
        startDate: filters.startDate ? new Date(filters.startDate as string) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate as string) : undefined,
        eventType: filters.eventType as string | undefined,
        eventCategories: filters.eventCategories as AuditCategory[] | undefined,
        actorId: filters.actorId as string | undefined,
        resourceType: filters.resourceType as string | undefined,
        resourceId: filters.resourceId as string | undefined,
      },
      0,
      100000
    );

    let content: string;
    let contentType: string;

    if (format === ExportFormat.CSV) {
      content = convertToCSV(
        logs as unknown as Record<string, unknown>[],
        exportRecord.includeFields
      );
      contentType = 'text/csv';
    } else {
      content = JSON.stringify(logs, null, 2);
      contentType = 'application/json';
    }

    const compressed = await compressContent(content);
    const key = `exports/${exportId}/${exportId}.${format.toLowerCase()}.gz`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: compressed,
        ContentType: contentType,
        ContentEncoding: 'gzip',
        Metadata: {
          exportId,
          format,
          recordCount: String(logs.length),
        },
      })
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updated = await prisma.auditExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.COMPLETED,
        fileUrl: `s3://${bucketName}/${key}`,
        fileSize: compressed.length,
        recordCount: logs.length,
        completedAt: new Date(),
        expiresAt,
      },
    });

    return {
      id: updated.id,
      status: updated.status as ExportStatus,
      requestedBy: updated.requestedBy,
      filters: updated.filters as Record<string, unknown>,
      format: updated.format as ExportFormat,
      includeFields: updated.includeFields,
      fileUrl: updated.fileUrl ?? undefined,
      fileSize: updated.fileSize ?? undefined,
      recordCount: updated.recordCount ?? undefined,
      errorMessage: updated.errorMessage ?? undefined,
      startedAt: updated.startedAt ?? undefined,
      completedAt: updated.completedAt ?? undefined,
      expiresAt: updated.expiresAt ?? undefined,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.auditExport.update({
      where: { id: exportId },
      data: {
        status: ExportStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function getExport(exportId: string): Promise<AuditExport | null> {
  if (!prisma) {
    throw new Error('Export service not initialized');
  }

  const record = await prisma.auditExport.findUnique({
    where: { id: exportId },
  });

  if (!record) return null;

  return {
    id: record.id,
    status: record.status as ExportStatus,
    requestedBy: record.requestedBy,
    filters: record.filters as Record<string, unknown>,
    format: record.format as ExportFormat,
    includeFields: record.includeFields,
    fileUrl: record.fileUrl ?? undefined,
    fileSize: record.fileSize ?? undefined,
    recordCount: record.recordCount ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    startedAt: record.startedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    createdAt: record.createdAt,
  };
}

export async function listExports(
  requestedBy: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ exports: AuditExport[]; total: number }> {
  if (!prisma) {
    throw new Error('Export service not initialized');
  }

  const { page = 1, pageSize = 20 } = options;
  const skip = (page - 1) * pageSize;

  const [records, total] = await Promise.all([
    prisma.auditExport.findMany({
      where: { requestedBy },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditExport.count({ where: { requestedBy } }),
  ]);

  return {
    exports: records.map(
      (r: {
        id: string;
        status: string;
        requestedBy: string;
        filters: unknown;
        format: string;
        includeFields: string[];
        fileUrl: string | null;
        fileSize: number | null;
        recordCount: number | null;
        errorMessage: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
        expiresAt: Date | null;
        createdAt: Date;
      }) => ({
        id: r.id,
        status: r.status as ExportStatus,
        requestedBy: r.requestedBy,
        filters: r.filters as Record<string, unknown>,
        format: r.format as ExportFormat,
        includeFields: r.includeFields,
        fileUrl: r.fileUrl ?? undefined,
        fileSize: r.fileSize ?? undefined,
        recordCount: r.recordCount ?? undefined,
        errorMessage: r.errorMessage ?? undefined,
        startedAt: r.startedAt ?? undefined,
        completedAt: r.completedAt ?? undefined,
        expiresAt: r.expiresAt ?? undefined,
        createdAt: r.createdAt,
      })
    ),
    total,
  };
}

function convertToCSV(logs: Array<Record<string, unknown>>, includeFields?: string[]): string {
  if (logs.length === 0) return '';

  const allFields = [
    'id',
    'timestamp',
    'eventType',
    'eventCategory',
    'actor.id',
    'actor.type',
    'resource.type',
    'resource.id',
    'action',
    'outcome.status',
    'serviceId',
  ];

  const fields = includeFields && includeFields.length > 0 ? includeFields : allFields;

  const getValue = (obj: Record<string, unknown>, path: string): string => {
    const parts = path.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    // Primitive values (string, number, boolean) are safe to stringify
    return typeof value === 'string' ? value : JSON.stringify(value);
  };

  const header = fields.join(',');
  const rows = logs.map((log) =>
    fields.map((f) => `"${getValue(log, f).replaceAll('"', '""')}"`).join(',')
  );

  return [header, ...rows].join('\n');
}

async function compressContent(content: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const readable = Readable.from([content]);
  const gzip = createGzip();

  await pipeline(readable, gzip);

  for await (const chunk of gzip) {
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks);
}
