// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/publishers/market-event.publisher
 * BullMQ publisher for sending Cockpit events to Market
 */

import { Queue, type Job } from 'bullmq';

import type { Logger } from '@skillancer/logger';
import type {
  CockpitToMarketEvent,
  ProjectTimeLoggedEvent,
  ProjectMilestoneCompletedEvent,
} from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

let queue: Queue | null = null;

export interface MarketEventPublisherOptions {
  redis: Redis;
  logger: Logger;
  queueName: string;
}

/**
 * Initialize the Market event publisher queue
 */
export function initMarketEventPublisher(options: MarketEventPublisherOptions): Queue {
  const { redis, logger, queueName } = options;

  queue = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  logger.info({
    msg: 'Market event publisher initialized',
    queueName,
  });

  return queue;
}

/**
 * Publish a Cockpit event to Market
 */
export async function publishToMarket(
  event: CockpitToMarketEvent,
  logger: Logger
): Promise<Job<CockpitToMarketEvent> | null> {
  if (!queue) {
    logger.error({
      msg: 'Market event publisher not initialized',
      eventType: event.type,
    });
    return null;
  }

  try {
    const job = await queue.add(event.type, event, {
      jobId: event.eventId,
    });

    logger.info({
      msg: 'Published event to Market',
      eventType: event.type,
      eventId: event.eventId,
      marketContractId: event.contractId,
      jobId: job.id,
    });

    return job;
  } catch (error) {
    logger.error({
      msg: 'Failed to publish event to Market',
      eventType: event.type,
      eventId: event.eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Publish time logged event
 */
export async function publishTimeLogged(
  data: Omit<ProjectTimeLoggedEvent, 'type' | 'eventId' | 'timestamp'>,
  logger: Logger
): Promise<Job<CockpitToMarketEvent> | null> {
  const event: ProjectTimeLoggedEvent = {
    type: 'cockpit.project.time_logged',
    eventId: `time-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...data,
  };

  return publishToMarket(event, logger);
}

/**
 * Publish milestone completed event
 */
export async function publishMilestoneCompleted(
  data: Omit<ProjectMilestoneCompletedEvent, 'type' | 'eventId' | 'timestamp'>,
  logger: Logger
): Promise<Job<CockpitToMarketEvent> | null> {
  const event: ProjectMilestoneCompletedEvent = {
    type: 'cockpit.project.milestone_completed',
    eventId: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...data,
  };

  return publishToMarket(event, logger);
}

/**
 * Close the publisher queue
 */
export async function closeMarketEventPublisher(logger: Logger): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
    logger.info({ msg: 'Market event publisher closed' });
  }
}

/**
 * Get publisher health status
 */
export function getMarketPublisherHealth(): {
  initialized: boolean;
} {
  return {
    initialized: queue !== null,
  };
}
