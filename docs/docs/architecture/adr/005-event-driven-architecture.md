# ADR-005: Event-Driven Architecture

## Status

**Accepted**

- Date: 2024-01-25
- Deciders: Engineering Team

## Context

As Skillancer grows, our microservices need to communicate for various cross-cutting concerns:

- User registration triggers welcome emails
- Project creation requires search indexing
- Payment completion updates project status
- Booking changes notify relevant parties

Direct service-to-service calls create tight coupling and can cause cascading failures.

### Requirements

- Loose coupling between services
- Reliable message delivery
- Support for async processing
- Ability to replay events
- Scalable event handling

## Decision

**We will adopt an event-driven architecture using Redis Streams for event messaging, with the option to migrate to AWS SQS/SNS for production scale.**

### Event Types

| Category      | Examples                            | Pattern          |
| ------------- | ----------------------------------- | ---------------- |
| Domain Events | `user.created`, `project.published` | Pub/Sub          |
| Commands      | `send.email`, `index.project`       | Queue            |
| Queries       | N/A - use direct API calls          | Request/Response |

### Event Structure

```typescript
interface DomainEvent<T = unknown> {
  id: string; // Unique event ID
  type: string; // Event type (e.g., 'user.created')
  version: string; // Schema version
  timestamp: string; // ISO 8601
  source: string; // Originating service
  correlationId: string; // Request tracing
  data: T; // Event payload
  metadata?: Record<string, unknown>;
}

// Example
const userCreatedEvent: DomainEvent<UserCreatedData> = {
  id: 'evt_abc123',
  type: 'user.created',
  version: '1.0',
  timestamp: '2024-01-25T10:30:00Z',
  source: 'user-service',
  correlationId: 'req_xyz789',
  data: {
    userId: 'usr_123',
    email: 'user@example.com',
    role: 'FREELANCER',
  },
};
```

## Alternatives Considered

### Option A: Direct Service Calls (HTTP)

**Pros:**

- Simple implementation
- Immediate feedback
- Easy debugging

**Cons:**

- Tight coupling
- Cascading failures
- Synchronous blocking
- Difficult to add new consumers

### Option B: Message Queue (RabbitMQ)

**Pros:**

- Proven technology
- Rich routing features
- Good for complex workflows

**Cons:**

- Additional infrastructure
- Operational complexity
- Overkill for our current scale

### Option C: Redis Streams (Selected for Development)

**Pros:**

- We already use Redis
- Consumer groups for scaling
- Message persistence
- Simple setup
- Good performance

**Cons:**

- Less features than dedicated MQ
- Single point of failure without clustering
- May need migration at scale

### Option D: AWS SNS/SQS (Production Path)

**Pros:**

- Managed service
- High reliability
- Auto-scaling
- Dead letter queues
- Fan-out with SNS

**Cons:**

- AWS vendor lock-in
- Cost considerations
- More complex local development

## Consequences

### Positive

1. **Loose coupling**: Services don't need to know about consumers
2. **Resilience**: Failures don't cascade
3. **Scalability**: Add consumers without changing producers
4. **Audit trail**: Events provide history
5. **Flexibility**: Easy to add new integrations

### Negative

1. **Eventual consistency**: Data may be temporarily stale
   - _Mitigation_: Design for eventual consistency, clear documentation
2. **Debugging complexity**: Async flows harder to trace
   - _Mitigation_: Correlation IDs, distributed tracing
3. **Event ordering**: May receive events out of order
   - _Mitigation_: Idempotent handlers, version checks

## Implementation

### Event Publisher

```typescript
// packages/events/src/publisher.ts
import Redis from 'ioredis';

export class EventPublisher {
  constructor(private redis: Redis) {}

  async publish<T>(event: DomainEvent<T>): Promise<string> {
    const stream = `events:${event.type.split('.')[0]}`;

    const messageId = await this.redis.xadd(stream, '*', 'event', JSON.stringify(event));

    return messageId;
  }
}

// Usage
await publisher.publish({
  id: generateEventId(),
  type: 'user.created',
  version: '1.0',
  timestamp: new Date().toISOString(),
  source: 'user-service',
  correlationId: request.id,
  data: { userId: user.id, email: user.email },
});
```

### Event Consumer

```typescript
// packages/events/src/consumer.ts
export class EventConsumer {
  constructor(
    private redis: Redis,
    private group: string,
    private consumer: string
  ) {}

  async subscribe(stream: string, handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', stream, this.group, '0', 'MKSTREAM');
    } catch (err) {
      // Group already exists
    }

    while (true) {
      const results = await this.redis.xreadgroup(
        'GROUP',
        this.group,
        this.consumer,
        'BLOCK',
        5000,
        'COUNT',
        10,
        'STREAMS',
        stream,
        '>'
      );

      if (results) {
        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const event = JSON.parse(fields[1]);
            try {
              await handler(event);
              await this.redis.xack(stream, this.group, id);
            } catch (error) {
              console.error('Event processing failed:', error);
              // Will be retried
            }
          }
        }
      }
    }
  }
}
```

### Event Handlers

```typescript
// services/notification/src/handlers/user-events.ts
export const handleUserCreated = async (event: DomainEvent<UserCreatedData>): Promise<void> => {
  await emailService.sendWelcomeEmail({
    to: event.data.email,
    userId: event.data.userId,
  });

  logger.info('Welcome email sent', {
    eventId: event.id,
    userId: event.data.userId,
  });
};
```

### Event Catalog

| Event               | Producer        | Consumers             |
| ------------------- | --------------- | --------------------- |
| `user.created`      | User Service    | Notification, Search  |
| `user.updated`      | User Service    | Search                |
| `project.created`   | Project Service | Search, Analytics     |
| `project.published` | Project Service | Search, Notification  |
| `booking.created`   | Booking Service | Notification, Payment |
| `payment.completed` | Payment Service | Booking, Notification |

## References

- [Redis Streams](https://redis.io/docs/data-types/streams/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Domain Events Pattern](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
