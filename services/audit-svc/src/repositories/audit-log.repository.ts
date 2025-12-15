/**
 * @module @skillancer/audit-svc/repositories/audit-log.repository
 * MongoDB repository for audit log entries
 */

import type {
  RetentionPolicy,
  ComplianceTag,
  AuditLogEntry,
  AuditSearchFilters,
} from '../types/index.js';
import type { Collection, Db, Filter, FindOptions } from 'mongodb';

const COLLECTION_NAME = 'audit_logs';

let db: Db | null = null;
let collection: Collection<AuditLogEntry> | null = null;

export function initializeAuditLogRepository(mongodb: Db): void {
  db = mongodb;
  collection = db.collection<AuditLogEntry>(COLLECTION_NAME);
  void createIndexes();
}

async function createIndexes(): Promise<void> {
  if (!collection) return;

  await collection.createIndex({ timestamp: -1 });
  await collection.createIndex({ eventType: 1, timestamp: -1 });
  await collection.createIndex({ 'actor.id': 1, timestamp: -1 });
  await collection.createIndex({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });
  await collection.createIndex({ eventCategory: 1, timestamp: -1 });
  await collection.createIndex({ complianceTags: 1 });
  await collection.createIndex({ retentionPolicy: 1, timestamp: 1 });
  await collection.createIndex(
    { '$**': 'text' },
    { name: 'full_text_search', weights: { eventType: 10, action: 5 } }
  );
}

function getCollection(): Collection<AuditLogEntry> {
  if (!collection) throw new Error('Repository not initialized');
  return collection;
}

export async function insertAuditLog(log: AuditLogEntry): Promise<void> {
  const col = getCollection();
  await col.insertOne(log);
}

export async function findAuditLogs(
  filters: AuditSearchFilters,
  skip = 0,
  limit = 100
): Promise<AuditLogEntry[]> {
  const col = getCollection();
  const query = buildQuery(filters);

  const sortObj: Record<string, 1 | -1> = {};
  if (filters.sortField) {
    sortObj[filters.sortField] = filters.sortOrder === 'asc' ? 1 : -1;
  } else {
    sortObj['timestamp'] = -1;
  }

  const findOptions: FindOptions<AuditLogEntry> = {
    skip,
    limit,
    sort: sortObj,
  };
  return col.find(query, findOptions).toArray();
}

export async function countAuditLogs(filters: AuditSearchFilters): Promise<number> {
  const col = getCollection();
  const query = buildQuery(filters);
  return col.countDocuments(query);
}

export async function findAuditLogById(id: string): Promise<AuditLogEntry | null> {
  const col = getCollection();
  return col.findOne({ id });
}

export async function getLastAuditLog(): Promise<AuditLogEntry | null> {
  const col = getCollection();
  return col.findOne({}, { sort: { timestamp: -1 } });
}

export async function updateAuditLog(id: string, update: Partial<AuditLogEntry>): Promise<void> {
  const col = getCollection();
  await col.updateOne({ id }, { $set: update });
}

export async function findExpiredLogs(
  policy: RetentionPolicy,
  beforeDate: Date
): Promise<AuditLogEntry[]> {
  const col = getCollection();
  return col
    .find({
      retentionPolicy: policy,
      timestamp: { $lt: beforeDate },
    })
    .toArray();
}

export async function deleteExpiredLogs(
  policy: RetentionPolicy,
  beforeDate: Date
): Promise<number> {
  const col = getCollection();
  const result = await col.deleteMany({
    retentionPolicy: policy,
    timestamp: { $lt: beforeDate },
  });
  return result.deletedCount;
}

export async function aggregateByCategory(
  filters: AuditSearchFilters
): Promise<Array<{ _id: string; count: number }>> {
  const col = getCollection();
  const match = buildQuery(filters);

  return col
    .aggregate<{
      _id: string;
      count: number;
    }>([{ $match: match }, { $group: { _id: '$eventCategory', count: { $sum: 1 } } }])
    .toArray();
}

export async function aggregateHourlyTrends(
  filters: AuditSearchFilters
): Promise<Array<{ _id: number; count: number }>> {
  const col = getCollection();
  const match = buildQuery(filters);

  return col
    .aggregate<{ _id: number; count: number }>([
      { $match: match },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();
}

export async function aggregateEventCountsByType(
  filters: AuditSearchFilters
): Promise<Array<{ _id: string; count: number }>> {
  const col = getCollection();
  const match = buildQuery(filters);

  return col
    .aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: match },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}

export async function aggregateDailyCountsByActor(
  actorId: string,
  eventType: string,
  sinceDate: Date
): Promise<Array<{ _id: string; count: number }>> {
  const col = getCollection();

  return col
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          'actor.id': actorId,
          eventType,
          timestamp: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}

export async function countByRetentionPolicy(policy: RetentionPolicy): Promise<number> {
  const col = getCollection();
  return col.countDocuments({ retentionPolicy: policy });
}

export async function getOldestLogDate(): Promise<Date | null> {
  const col = getCollection();
  const result = await col.findOne({}, { sort: { timestamp: 1 }, projection: { timestamp: 1 } });
  return result?.timestamp ?? null;
}

export async function getNewestLogDate(): Promise<Date | null> {
  const col = getCollection();
  const result = await col.findOne({}, { sort: { timestamp: -1 }, projection: { timestamp: 1 } });
  return result?.timestamp ?? null;
}

export async function compactLogs(beforeDate: Date): Promise<number> {
  const col = getCollection();
  const result = await col.updateMany(
    { timestamp: { $lt: beforeDate } },
    {
      $unset: {
        'changes.before': '',
        'changes.after': '',
        'request.userAgent': '',
      },
    }
  );
  return result.modifiedCount;
}

export async function countUniqueActors(filters: AuditSearchFilters): Promise<number> {
  const col = getCollection();
  const match = buildQuery(filters);

  const result = await col
    .aggregate<{
      count: number;
    }>([{ $match: match }, { $group: { _id: '$actor.id' } }, { $count: 'count' }])
    .toArray();

  return result[0]?.count ?? 0;
}

export async function countUniqueResources(filters: AuditSearchFilters): Promise<number> {
  const col = getCollection();
  const match = buildQuery(filters);

  const result = await col
    .aggregate<{
      count: number;
    }>([
      { $match: match },
      { $group: { _id: { type: '$resource.type', id: '$resource.id' } } },
      { $count: 'count' },
    ])
    .toArray();

  return result[0]?.count ?? 0;
}

export async function aggregateTopActors(
  filters: AuditSearchFilters,
  limit: number
): Promise<Array<{ id: string; count: number }>> {
  const col = getCollection();
  const match = buildQuery(filters);

  const result = await col
    .aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: match },
      { $group: { _id: '$actor.id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return result.map((r) => ({ id: r._id, count: r.count }));
}

export async function aggregateResourceCounts(
  filters: AuditSearchFilters
): Promise<Array<{ _id: string; count: number }>> {
  const col = getCollection();
  const match = buildQuery(filters);

  return col
    .aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: match },
      { $group: { _id: '$resource.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}

export async function anonymizeActorData(actorId: string): Promise<number> {
  const col = getCollection();

  const result = await col.updateMany(
    { 'actor.id': actorId },
    {
      $set: {
        'actor.id': 'ANONYMIZED',
        'actor.email': undefined,
        'actor.name': undefined,
        'actor.ipAddress': undefined,
        'request.ipAddress': undefined,
        'request.userAgent': undefined,
      },
    }
  );

  return result.modifiedCount;
}

export async function getOldestLogByPolicy(policy: RetentionPolicy): Promise<Date | null> {
  const col = getCollection();
  const result = await col.findOne(
    { retentionPolicy: policy },
    { sort: { timestamp: 1 }, projection: { timestamp: 1 } }
  );
  return result?.timestamp ?? null;
}

export async function getNewestLogByPolicy(policy: RetentionPolicy): Promise<Date | null> {
  const col = getCollection();
  const result = await col.findOne(
    { retentionPolicy: policy },
    { sort: { timestamp: -1 }, projection: { timestamp: 1 } }
  );
  return result?.timestamp ?? null;
}

function buildQuery(filters: AuditSearchFilters): Filter<AuditLogEntry> {
  const query: Filter<AuditLogEntry> = {};

  if (filters.eventType) query.eventType = filters.eventType;
  if (filters.eventCategories?.length) query.eventCategory = { $in: filters.eventCategories };
  if (filters.actorId) query['actor.id'] = filters.actorId;
  if (filters.actorType) query['actor.type'] = filters.actorType;
  if (filters.resourceType) query['resource.type'] = filters.resourceType;
  if (filters.resourceId) query['resource.id'] = filters.resourceId;
  if (filters.outcomeStatus) query['outcome.status'] = filters.outcomeStatus;
  if (filters.complianceTags?.length)
    query.complianceTags = { $in: filters.complianceTags as unknown as ComplianceTag[] };

  if (filters.startDate ?? filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = filters.startDate;
    if (filters.endDate) query.timestamp.$lte = filters.endDate;
  }

  if (filters.searchText) {
    query.$text = { $search: filters.searchText };
  }

  return query;
}
