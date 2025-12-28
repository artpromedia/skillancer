/**
 * @module @skillancer/analytics/processing
 * Kafka event processor for analytics events
 */

import type { AnalyticsEvent } from '../events/index.js';
import type { Consumer, Producer, EachMessagePayload, Kafka as KafkaType } from 'kafkajs';

export interface EventProcessorConfig {
  kafka: {
    brokers: string[];
    groupId: string;
    inputTopic: string;
    dlqTopic: string;
  };
  clickhouse: {
    host: string;
    database: string;
    username: string;
    password: string;
  };
  batchSize: number;
  batchTimeoutMs: number;
}

interface ProcessedEvent extends AnalyticsEvent {
  receivedAt: Date;
  eventDate: string;
  eventHour: number;
  eventDayOfWeek: number;
  userIdentifier: string;
  isIdentified: boolean;
  deviceCategory: string;
  platform: string;
  geo?: { country: string; region: string; city: string };
}

interface Logger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  child: (meta: Record<string, unknown>) => Logger;
}

export class EventProcessor {
  private kafka: KafkaType | null = null;
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private logger: Logger;
  private eventBuffer: ProcessedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private config: EventProcessorConfig,
    logger: Logger
  ) {
    this.logger = logger.child({ component: 'EventProcessor' });
  }

  async initialize(): Promise<void> {
    const { Kafka } = await import('kafkajs');

    this.kafka = new Kafka({
      clientId: 'analytics-processor',
      brokers: this.config.kafka.brokers,
    });

    this.consumer = this.kafka.consumer({
      groupId: this.config.kafka.groupId,
    });

    this.producer = this.kafka.producer();
  }

  async start(): Promise<void> {
    if (!this.consumer || !this.producer) {
      await this.initialize();
    }

    this.logger.info('Starting event processor');

    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: this.config.kafka.inputTopic,
      fromBeginning: false,
    });

    this.isRunning = true;
    this.startFlushTimer();

    await this.consumer.run({
      eachMessage: async (payload) => {
        await this.processMessage(payload);
      },
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping event processor');
    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { message } = payload;

    try {
      const event = JSON.parse(message.value?.toString() || '{}') as AnalyticsEvent;
      const processedEvent = this.processEvent(event);

      if (processedEvent) {
        this.eventBuffer.push(processedEvent);

        if (this.eventBuffer.length >= this.config.batchSize) {
          await this.flush();
        }
      }
    } catch (error) {
      this.logger.error('Failed to process event', {
        error: (error as Error).message,
        partition: payload.partition,
        offset: message.offset,
      });

      await this.sendToDLQ(message.value, error as Error);
    }
  }

  private processEvent(event: AnalyticsEvent): ProcessedEvent | null {
    if (!event.eventId || !event.eventType || !event.anonymousId) {
      this.logger.warn('Invalid event - missing required fields', { eventId: event.eventId });
      return null;
    }

    const timestamp = new Date(event.timestamp);

    return {
      ...event,
      receivedAt: new Date(),
      eventDate: timestamp.toISOString().split('T')[0],
      eventHour: timestamp.getHours(),
      eventDayOfWeek: timestamp.getDay(),
      userIdentifier: event.userId || event.anonymousId,
      isIdentified: !!event.userId,
      deviceCategory: this.classifyDevice(event.context?.device?.type),
      platform: this.determinePlatform(event),
    };
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Group and insert events (ClickHouse insertion would go here)
      this.logger.info('Flushed events', { count: events.length });
    } catch (error) {
      this.logger.error('Failed to flush events', { error: (error as Error).message });
      this.eventBuffer = [...events, ...this.eventBuffer];
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.isRunning) {
        this.flush();
      }
    }, this.config.batchTimeoutMs);
  }

  private async sendToDLQ(message: Buffer | null, error: Error): Promise<void> {
    if (!message || !this.producer) return;

    await this.producer.send({
      topic: this.config.kafka.dlqTopic,
      messages: [
        {
          value: JSON.stringify({
            originalMessage: message.toString(),
            error: error.message,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
  }

  private classifyDevice(deviceType?: string): string {
    switch (deviceType) {
      case 'mobile':
        return 'Mobile';
      case 'tablet':
        return 'Tablet';
      default:
        return 'Desktop';
    }
  }

  private determinePlatform(event: AnalyticsEvent): string {
    const path = event.context?.page?.path || '';
    if (path.startsWith('/learn') || path.startsWith('/course')) return 'SkillPod';
    if (path.startsWith('/jobs') || path.startsWith('/freelancer')) return 'Market';
    if (path.startsWith('/dashboard') || path.startsWith('/projects')) return 'Cockpit';
    return 'Unknown';
  }
}

export function createEventProcessor(config: EventProcessorConfig, logger: Logger): EventProcessor {
  return new EventProcessor(config, logger);
}
