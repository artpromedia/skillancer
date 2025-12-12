/**
 * @module @skillancer/audit-svc/consumers/audit-event.consumer
 * BullMQ consumer for processing audit events
 */

import { Worker, type Job } from 'bullmq';

import { detectAnomalies, updateBaseline } from '../services/audit-analytics.service.js';
import { createAuditLog } from '../services/audit-log.service.js';

import type { AuditLogParams } from '../types/index.js';
import type { Redis } from 'ioredis';

let worker: Worker | null = null;

export interface AuditEventConsumerOptions {
  redis: Redis;
  queueName: string;
  concurrency?: number;
}

export function startAuditEventConsumer(options: AuditEventConsumerOptions): Worker {
  const { redis, queueName, concurrency = 10 } = options;

  worker = new Worker<AuditLogParams>(
    queueName,
    async (job: Job<AuditLogParams>) => {
      const params = job.data;

      const log = await createAuditLog(params);

      if (params.actor.id && params.eventType) {
        const anomalyResult = await detectAnomalies(params.actor.id, params.eventType, 1);

        if (anomalyResult.isAnomaly) {
          console.warn(`[ANOMALY] ${anomalyResult.severity}: ${anomalyResult.message}`, {
            actorId: params.actor.id,
            eventType: params.eventType,
          });
        }
      }

      return { logId: log.id, timestamp: log.timestamp };
    },
    {
      connection: redis,
      concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    }
  );

  worker.on('completed', (job) => {
    console.debug(`[AUDIT] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[AUDIT] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[AUDIT] Worker error:', err);
  });

  console.info(`[AUDIT] Consumer started with concurrency ${concurrency}`);

  return worker;
}

export async function stopAuditEventConsumer(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.info('[AUDIT] Consumer stopped');
  }
}

export function getConsumerHealth(): {
  running: boolean;
  paused: boolean;
} {
  return {
    running: worker !== null && !worker.isPaused(),
    paused: worker?.isPaused() ?? false,
  };
}

export function runBaselineUpdateJob(redis: Redis, queueName: string): void {
  const worker = new Worker(
    `${queueName}-baseline`,
    async (job: Job<{ actorId: string; eventType: string }>) => {
      const { actorId, eventType } = job.data;
      await updateBaseline(actorId, eventType);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('error', (err) => {
    console.error('[AUDIT-BASELINE] Worker error:', err);
  });
}
