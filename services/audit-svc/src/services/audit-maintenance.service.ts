/**
 * @module @skillancer/audit-svc/services/audit-maintenance.service
 * Retention, archival, and maintenance operations
 */

import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

import { type S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import * as auditLogRepository from '../repositories/audit-log.repository.js';
import { RetentionPolicy } from '../types/index.js';

let s3Client: S3Client | null = null;
let bucketName: string = '';

const RETENTION_DAYS: Record<RetentionPolicy, number> = {
  [RetentionPolicy.SHORT]: 90,
  [RetentionPolicy.STANDARD]: 365,
  [RetentionPolicy.EXTENDED]: 2555,
  [RetentionPolicy.PERMANENT]: -1,
};

export function initializeMaintenanceService(s3: S3Client, bucket: string): void {
  s3Client = s3;
  bucketName = bucket;
}

export async function runRetentionCleanup(): Promise<{
  processed: number;
  archived: number;
  deleted: number;
}> {
  let processed = 0;
  let archived = 0;
  let deleted = 0;

  for (const policy of [
    RetentionPolicy.SHORT,
    RetentionPolicy.STANDARD,
    RetentionPolicy.EXTENDED,
  ]) {
    const retentionDays = RETENTION_DAYS[policy];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const expiredLogs = await auditLogRepository.findExpiredLogs(policy, cutoffDate);
    processed += expiredLogs.length;

    if (expiredLogs.length === 0) continue;

    const archiveResult = await archiveLogs(
      expiredLogs as unknown as Record<string, unknown>[],
      policy
    );
    archived += archiveResult.count;

    const deleteResult = await auditLogRepository.deleteExpiredLogs(policy, cutoffDate);
    deleted += deleteResult;
  }

  return { processed, archived, deleted };
}

async function archiveLogs(
  logs: Array<Record<string, unknown>>,
  policy: RetentionPolicy
): Promise<{ count: number; key: string }> {
  if (!s3Client || logs.length === 0) {
    return { count: 0, key: '' };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime();

  const key = `archives/${year}/${month}/${day}/${policy}-${timestamp}.json.gz`;

  const content = JSON.stringify(logs);
  const compressed = await compressContent(content);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: compressed,
      ContentType: 'application/json',
      ContentEncoding: 'gzip',
      StorageClass: 'GLACIER_IR',
      Metadata: {
        retentionPolicy: policy,
        recordCount: String(logs.length),
        archivedAt: now.toISOString(),
      },
    })
  );

  return { count: logs.length, key };
}

export async function verifyIntegrityChain(
  startDate: Date,
  endDate: Date
): Promise<{
  valid: boolean;
  totalChecked: number;
  brokenChains: Array<{ id: string; timestamp: Date; error: string }>;
}> {
  const logs = await auditLogRepository.findAuditLogs(
    { startDate, endDate, sortField: 'timestamp', sortOrder: 'asc' },
    0,
    100000
  );

  const brokenChains: Array<{ id: string; timestamp: Date; error: string }> = [];

  for (let i = 1; i < logs.length; i++) {
    const currentLog = logs[i];
    const previousLog = logs[i - 1];

    if (!currentLog || !previousLog) continue;

    if (currentLog.previousHash && currentLog.previousHash !== previousLog.integrityHash) {
      brokenChains.push({
        id: currentLog.id,
        timestamp: currentLog.timestamp,
        error: `Hash chain broken: expected ${previousLog.integrityHash}, got ${currentLog.previousHash}`,
      });
    }
  }

  return {
    valid: brokenChains.length === 0,
    totalChecked: logs.length,
    brokenChains,
  };
}

export async function getStorageStats(): Promise<{
  totalLogs: number;
  logsByPolicy: Record<RetentionPolicy, number>;
  oldestLog: Date | null;
  newestLog: Date | null;
  estimatedSizeMB: number;
}> {
  const [total, byPolicy, oldest, newest] = await Promise.all([
    auditLogRepository.countAuditLogs({}),
    Promise.all(
      Object.values(RetentionPolicy).map(async (policy) => ({
        policy,
        count: await auditLogRepository.countByRetentionPolicy(policy),
      }))
    ),
    auditLogRepository.getOldestLogDate(),
    auditLogRepository.getNewestLogDate(),
  ]);

  const logsByPolicy: Record<RetentionPolicy, number> = {
    [RetentionPolicy.SHORT]: 0,
    [RetentionPolicy.STANDARD]: 0,
    [RetentionPolicy.EXTENDED]: 0,
    [RetentionPolicy.PERMANENT]: 0,
  };

  for (const { policy, count } of byPolicy) {
    logsByPolicy[policy] = count;
  }

  const estimatedSizeMB = (total * 2) / 1024;

  return {
    totalLogs: total,
    logsByPolicy,
    oldestLog: oldest,
    newestLog: newest,
    estimatedSizeMB,
  };
}

export async function compactOldLogs(olderThanDays: number): Promise<{ compacted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const compacted = await auditLogRepository.compactLogs(cutoffDate);

  return { compacted };
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
