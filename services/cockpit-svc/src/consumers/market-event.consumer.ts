/**
 * @module @skillancer/cockpit-svc/consumers/market-event.consumer
 * BullMQ consumer for processing Market contract events
 */

import { Worker, type Job } from 'bullmq';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type {
  MarketToCockpitEvent,
  ContractCreatedEvent,
  ContractStatusChangedEvent,
  ContractMilestoneUpdatedEvent,
  ContractTimeLoggedEvent,
  ContractPaymentReceivedEvent,
  ContractDisputeEvent,
  ContractEndedEvent,
} from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

let worker: Worker | null = null;

export interface MarketEventConsumerOptions {
  redis: Redis;
  prisma: PrismaClient;
  logger: Logger;
  queueName: string;
  concurrency?: number;
}

export interface MarketEventConsumerDependencies {
  contractProjectSyncService: {
    handleContractCreated: (event: ContractCreatedEvent) => Promise<void>;
    handleContractStatusChanged: (event: ContractStatusChangedEvent) => Promise<void>;
    handleMilestoneUpdated: (event: ContractMilestoneUpdatedEvent) => Promise<void>;
    handleTimeLogged: (event: ContractTimeLoggedEvent) => Promise<void>;
    handlePaymentReceived: (event: ContractPaymentReceivedEvent) => Promise<void>;
    handleDispute: (event: ContractDisputeEvent) => Promise<void>;
    handleContractEnded: (event: ContractEndedEvent) => Promise<void>;
  };
}

/**
 * Start the Market event consumer
 */
export function startMarketEventConsumer(
  options: MarketEventConsumerOptions,
  deps: MarketEventConsumerDependencies
): Worker {
  const { redis, logger, queueName, concurrency = 5 } = options;
  const { contractProjectSyncService } = deps;

  worker = new Worker<MarketToCockpitEvent>(
    queueName,
    async (job: Job<MarketToCockpitEvent>) => {
      const event = job.data;

      logger.info({
        msg: 'Processing Market event',
        eventType: event.type,
        eventId: event.eventId,
        marketContractId: event.contractId,
      });

      try {
        switch (event.type) {
          case 'market.contract.created':
            await contractProjectSyncService.handleContractCreated(event as ContractCreatedEvent);
            break;

          case 'market.contract.status_changed':
            await contractProjectSyncService.handleContractStatusChanged(
              event as ContractStatusChangedEvent
            );
            break;

          case 'market.contract.milestone.updated':
            await contractProjectSyncService.handleMilestoneUpdated(
              event as ContractMilestoneUpdatedEvent
            );
            break;

          case 'market.contract.time_logged':
            await contractProjectSyncService.handleTimeLogged(event as ContractTimeLoggedEvent);
            break;

          case 'market.contract.payment':
            await contractProjectSyncService.handlePaymentReceived(
              event as ContractPaymentReceivedEvent
            );
            break;

          case 'market.contract.dispute':
            await contractProjectSyncService.handleDispute(event as ContractDisputeEvent);
            break;

          case 'market.contract.ended':
            await contractProjectSyncService.handleContractEnded(event as ContractEndedEvent);
            break;

          default:
            logger.warn({
              msg: 'Unknown Market event type',
              eventType: event.type,
            });
        }

        logger.debug({
          msg: 'Market event processed successfully',
          eventType: event.type,
          eventId: event.eventId,
        });

        return { processed: true, eventType: event.type };
      } catch (error) {
        logger.error({
          msg: 'Failed to process Market event',
          eventType: event.type,
          eventId: event.eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    {
      connection: redis,
      concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    }
  );

  worker.on('completed', (job) => {
    logger.debug({
      msg: 'Market event job completed',
      jobId: job.id,
      eventType: job.data.type,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error({
      msg: 'Market event job failed',
      jobId: job?.id,
      eventType: job?.data?.type,
      error: err.message,
    });
  });

  worker.on('error', (err) => {
    logger.error({
      msg: 'Market event worker error',
      error: err.message,
    });
  });

  logger.info({
    msg: 'Market event consumer started',
    queueName,
    concurrency,
  });

  return worker;
}

/**
 * Stop the Market event consumer
 */
export async function stopMarketEventConsumer(logger: Logger): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info({ msg: 'Market event consumer stopped' });
  }
}

/**
 * Get consumer health status
 */
export function getMarketConsumerHealth(): {
  running: boolean;
  paused: boolean;
} {
  return {
    running: worker !== null && !worker.isPaused(),
    paused: worker?.isPaused() ?? false,
  };
}
