/**
 * @module @skillancer/service-client/events
 * Event Bus implementation using Redis pub/sub
 */

import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';

import { logger } from '../logger.js';
import { getContext } from '../request-context.js';

import type { DomainEvent, EventHandler, SubscriptionOptions, EventChannel } from './types.js';

/**
 * Redis connection factory
 */
const createRedisClient = (): Redis => {
  const options: {
    host: string;
    port: number;
    password?: string;
    db: number;
    retryStrategy: (times: number) => number;
    maxRetriesPerRequest: number;
  } = {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    db: parseInt(process.env['REDIS_EVENTS_DB'] || '2', 10),
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };

  const password = process.env['REDIS_PASSWORD'];
  if (password !== undefined) {
    options.password = password;
  }

  return new Redis(options);
};

/**
 * Subscription record
 */
interface Subscription {
  channel: string;
  handler: EventHandler;
  options: SubscriptionOptions;
}

/**
 * Event Bus for publish/subscribe messaging
 */
export class EventBus {
  private publisher: Redis;
  private subscriber: Redis | null = null;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private isConnected = false;
  private patternSubscriptions: Map<string, Subscription[]> = new Map();

  constructor(redisClient?: Redis) {
    this.publisher = redisClient ?? createRedisClient();
  }

  /**
   * Initialize subscriber connection and set up message handling
   */
  private ensureSubscriber(): Redis {
    if (this.subscriber) {
      return this.subscriber;
    }

    this.subscriber = this.publisher.duplicate();

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handlePatternMessage(pattern, channel, message);
    });

    this.subscriber.on('error', (error) => {
      logger.error({ error: error.message }, 'Event bus subscriber error');
    });

    this.subscriber.on('connect', () => {
      logger.info('Event bus subscriber connected');
      this.isConnected = true;
    });

    this.subscriber.on('close', () => {
      logger.warn('Event bus subscriber disconnected');
      this.isConnected = false;
    });

    return this.subscriber;
  }

  /**
   * Handle incoming message on a channel
   */
  private handleMessage(channel: string, message: string): void {
    const subscriptions = this.subscriptions.get(channel);
    if (!subscriptions?.length) {
      return;
    }

    try {
      const event = JSON.parse(message) as DomainEvent;
      this.processEvent(event, subscriptions);
    } catch (error) {
      logger.error(
        { channel, error: error instanceof Error ? error.message : String(error) },
        'Failed to parse event message'
      );
    }
  }

  /**
   * Handle incoming pattern message
   */
  private handlePatternMessage(pattern: string, channel: string, message: string): void {
    const subscriptions = this.patternSubscriptions.get(pattern);
    if (!subscriptions?.length) {
      return;
    }

    try {
      const event = JSON.parse(message) as DomainEvent;
      this.processEvent(event, subscriptions);
    } catch (error) {
      logger.error(
        { pattern, channel, error: error instanceof Error ? error.message : String(error) },
        'Failed to parse pattern event message'
      );
    }
  }

  /**
   * Process an event through subscribed handlers
   */
  private processEvent(event: DomainEvent, subscriptions: Subscription[]): void {
    for (const subscription of subscriptions) {
      this.executeHandler(event, subscription).catch((error) => {
        logger.error(
          {
            eventId: event.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
          },
          'Event handler failed'
        );
      });
    }
  }

  /**
   * Execute event handler with retry logic
   */
  private async executeHandler(event: DomainEvent, subscription: Subscription): Promise<void> {
    const { handler, options } = subscription;
    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 1000;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      try {
        await handler(event);

        logger.debug(
          {
            eventId: event.id,
            eventType: event.type,
            channel: subscription.channel,
            attempt: attempt + 1,
          },
          'Event handled successfully'
        );

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < maxRetries) {
          logger.warn(
            {
              eventId: event.id,
              eventType: event.type,
              attempt,
              maxRetries,
              error: lastError.message,
            },
            'Event handler failed, retrying'
          );

          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    logger.error(
      {
        eventId: event.id,
        eventType: event.type,
        attempts: attempt,
        error: lastError?.message,
      },
      'Event handler failed after all retries'
    );

    throw lastError;
  }

  /**
   * Publish an event to a channel
   */
  async publish<T>(
    channel: EventChannel | string,
    eventType: string,
    payload: T,
    options: {
      aggregateId: string;
      aggregateType: string;
      causationId?: string;
    }
  ): Promise<DomainEvent<T>> {
    const context = getContext();

    const event: DomainEvent<T> = {
      id: randomUUID(),
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      aggregateId: options.aggregateId,
      aggregateType: options.aggregateType,
      version: 1,
    };

    if (context?.userId !== undefined) event.userId = context.userId;
    if (context?.traceId !== undefined) event.correlationId = context.traceId;
    if (options.causationId !== undefined) event.causationId = options.causationId;

    const message = JSON.stringify(event);
    await this.publisher.publish(channel, message);

    logger.info(
      {
        eventId: event.id,
        eventType: event.type,
        channel,
        aggregateId: options.aggregateId,
        correlationId: event.correlationId,
      },
      'Event published'
    );

    return event;
  }

  /**
   * Subscribe to events on a channel
   */
  async subscribe<T = unknown>(
    channel: EventChannel | string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): Promise<() => Promise<void>> {
    const subscriber = this.ensureSubscriber();

    const subscription: Subscription = {
      channel,
      handler: handler as EventHandler,
      options,
    };

    // Add to subscriptions map
    const existing = this.subscriptions.get(channel) || [];
    existing.push(subscription);
    this.subscriptions.set(channel, existing);

    // Subscribe to channel if this is the first subscription
    if (existing.length === 1) {
      await subscriber.subscribe(channel);
      logger.info({ channel }, 'Subscribed to channel');
    }

    // Return unsubscribe function
    return async () => {
      const subs = this.subscriptions.get(channel);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }

        // Unsubscribe from channel if no more subscriptions
        if (subs.length === 0) {
          this.subscriptions.delete(channel);
          await subscriber.unsubscribe(channel);
          logger.info({ channel }, 'Unsubscribed from channel');
        }
      }
    };
  }

  /**
   * Subscribe to events matching a pattern
   */
  async subscribePattern<T = unknown>(
    pattern: string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): Promise<() => Promise<void>> {
    const subscriber = this.ensureSubscriber();

    const subscription: Subscription = {
      channel: pattern,
      handler: handler as EventHandler,
      options,
    };

    // Add to pattern subscriptions map
    const existing = this.patternSubscriptions.get(pattern) || [];
    existing.push(subscription);
    this.patternSubscriptions.set(pattern, existing);

    // Subscribe to pattern if this is the first subscription
    if (existing.length === 1) {
      await subscriber.psubscribe(pattern);
      logger.info({ pattern }, 'Subscribed to pattern');
    }

    // Return unsubscribe function
    return async () => {
      const subs = this.patternSubscriptions.get(pattern);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }

        // Unsubscribe from pattern if no more subscriptions
        if (subs.length === 0) {
          this.patternSubscriptions.delete(pattern);
          await subscriber.punsubscribe(pattern);
          logger.info({ pattern }, 'Unsubscribed from pattern');
        }
      }
    };
  }

  /**
   * Publish multiple events atomically
   */
  async publishBatch<T>(
    events: Array<{
      channel: EventChannel | string;
      eventType: string;
      payload: T;
      aggregateId: string;
      aggregateType: string;
    }>
  ): Promise<DomainEvent<T>[]> {
    const context = getContext();
    const pipeline = this.publisher.pipeline();
    const domainEvents: DomainEvent<T>[] = [];

    for (const { channel, eventType, payload, aggregateId, aggregateType } of events) {
      const event: DomainEvent<T> = {
        id: randomUUID(),
        type: eventType,
        payload,
        timestamp: new Date().toISOString(),
        aggregateId,
        aggregateType,
        version: 1,
      };

      if (context?.userId !== undefined) event.userId = context.userId;
      if (context?.traceId !== undefined) event.correlationId = context.traceId;

      pipeline.publish(channel, JSON.stringify(event));
      domainEvents.push(event);
    }

    await pipeline.exec();

    logger.info(
      {
        count: events.length,
        correlationId: context?.traceId,
      },
      'Batch events published'
    );

    return domainEvents;
  }

  /**
   * Store event for replay/audit (event sourcing support)
   */
  async storeEvent<T>(event: DomainEvent<T>, streamKey: string): Promise<string> {
    const eventId = await this.publisher.xadd(streamKey, '*', 'event', JSON.stringify(event));

    logger.debug(
      {
        eventId: event.id,
        streamKey,
        streamId: eventId,
      },
      'Event stored in stream'
    );

    return eventId ?? '';
  }

  /**
   * Read events from a stream (for replay)
   */
  async readEvents<T>(
    streamKey: string,
    options: {
      start?: string;
      end?: string;
      count?: number;
    } = {}
  ): Promise<DomainEvent<T>[]> {
    const { start = '-', end = '+', count = 100 } = options;

    const results = await this.publisher.xrange(streamKey, start, end, 'COUNT', count);

    return results.map(([_id, fields]) => {
      const eventJson = fields[1] ?? '{}'; // fields is [key, value, key, value, ...]
      return JSON.parse(eventJson) as DomainEvent<T>;
    });
  }

  /**
   * Get the number of subscribers for a channel
   */
  async getSubscriberCount(channel: string): Promise<number> {
    const result = await this.publisher.pubsub('NUMSUB', channel);
    return (result[1] as number) || 0;
  }

  /**
   * Check if connected to Redis
   */
  isHealthy(): boolean {
    return this.publisher.status === 'ready';
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    await this.publisher.quit();

    this.subscriptions.clear();
    this.patternSubscriptions.clear();
    this.isConnected = false;

    logger.info('Event bus closed');
  }
}

/**
 * Singleton event bus instance
 */
export const eventBus = new EventBus();
