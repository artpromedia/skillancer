# @skillancer/service-client

Inter-service communication package for Skillancer microservices architecture.

## Features

- **Typed HTTP Clients**: Type-safe clients for all Skillancer services
- **Circuit Breaker**: Fault tolerance with automatic recovery
- **Distributed Tracing**: Request context propagation via AsyncLocalStorage
- **Job Queues**: BullMQ-based async messaging for background jobs
- **Event Bus**: Redis pub/sub for domain events
- **Saga Orchestrator**: Distributed transaction management

## Installation

```bash
pnpm add @skillancer/service-client
```

## Quick Start

### HTTP Clients

```typescript
import { authClient, marketClient, billingClient } from '@skillancer/service-client';

// Fetch user from auth service
const user = await authClient.getUser('user-123');

// Create a job in market service
const job = await marketClient.createJob({
  title: 'Build a website',
  description: '...',
  clientId: user.id,
  budget: { type: 'fixed', min: 1000, max: 5000 },
  skills: ['react', 'typescript'],
});

// Create escrow for payment
const escrow = await billingClient.createEscrow({
  contractId: 'contract-123',
  clientId: user.id,
  freelancerId: 'freelancer-456',
  amount: 1000,
  currency: 'USD',
});
```

### Request Context for Distributed Tracing

```typescript
import { runWithContext, getContext } from '@skillancer/service-client';

// Wrap your request handler with context
await runWithContext(
  {
    traceId: req.headers['x-trace-id'] || crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    userId: req.user?.id,
  },
  async () => {
    // All service client calls within this context will
    // automatically include tracing headers
    const user = await authClient.getUser(userId);
    const jobs = await marketClient.listJobs({ clientId: user.id });
  }
);
```

### Job Queues

```typescript
import { queueManager, QueueNames, JobNames } from '@skillancer/service-client';

// Add a job to a queue
await queueManager.addJob(QueueNames.EMAIL_QUEUE, JobNames.SEND_EMAIL, {
  to: 'user@example.com',
  templateId: 'welcome',
  variables: { name: 'John' },
});

// Create a worker to process jobs
queueManager.createWorker(
  QueueNames.EMAIL_QUEUE,
  async (job) => {
    const { to, templateId, variables } = job.data.data;
    await sendEmail(to, templateId, variables);
  },
  { concurrency: 5 }
);

// Schedule a job for later
await queueManager.scheduleJob(
  QueueNames.REPORT_GENERATION,
  'generate-monthly-report',
  { month: '2024-01' },
  new Date('2024-02-01T00:00:00Z')
);

// Schedule a recurring job
await queueManager.scheduleRecurringJob(
  QueueNames.POD_CLEANUP,
  'cleanup-idle-pods',
  {},
  '0 * * * *' // Every hour
);
```

### Event Bus

```typescript
import { eventBus, EventChannels, EventTypes } from '@skillancer/service-client';

// Publish an event
await eventBus.publish(
  EventChannels.CONTRACTS,
  EventTypes.Contract.CREATED,
  {
    id: 'contract-123',
    clientId: 'client-456',
    freelancerId: 'freelancer-789',
    amount: 5000,
  },
  {
    aggregateId: 'contract-123',
    aggregateType: 'Contract',
  }
);

// Subscribe to events
const unsubscribe = await eventBus.subscribe(EventChannels.CONTRACTS, async (event) => {
  console.log('Contract event:', event.type, event.payload);
});

// Subscribe to pattern (all job events)
await eventBus.subscribePattern('events:jobs*', async (event) => {
  console.log('Job event:', event.type);
});

// Unsubscribe when done
await unsubscribe();
```

### Saga Orchestrator

```typescript
import { sagaOrchestrator, createContractSaga } from '@skillancer/service-client';

// Register the saga
sagaOrchestrator.register(createContractSaga);

// Execute the saga
const result = await sagaOrchestrator.execute('create-contract', {
  jobId: 'job-123',
  bidId: 'bid-456',
  clientId: 'client-789',
  freelancerId: 'freelancer-012',
  terms: {
    startDate: '2024-01-15',
    budget: 5000,
    currency: 'USD',
    milestones: [
      { title: 'Design', amount: 1000, dueDate: '2024-01-20' },
      { title: 'Development', amount: 3000, dueDate: '2024-02-15' },
      { title: 'Launch', amount: 1000, dueDate: '2024-02-28' },
    ],
  },
});

if (result.status === 'completed') {
  console.log('Contract created:', result.output.contractId);
} else {
  console.error('Saga failed:', result.error);
}
```

### Custom Saga Definition

```typescript
import type { SagaDefinition, SagaStep } from '@skillancer/service-client';

interface MyInput {
  userId: string;
  amount: number;
}
interface MyOutput {
  success: boolean;
}

const step1: SagaStep<MyInput, { reservationId: string }> = {
  name: 'reserve-funds',
  async execute(context) {
    const reservation = await billingClient.reserveFunds(
      context.input.userId,
      context.input.amount
    );
    return { reservationId: reservation.id };
  },
  async compensate(context, result) {
    await billingClient.releaseReservation(result.reservationId);
  },
  retry: { maxAttempts: 3, delay: 1000 },
};

const mySaga: SagaDefinition<MyInput, MyOutput> = {
  name: 'my-custom-saga',
  version: 1,
  steps: [step1 /* more steps */],
  timeout: 30000,
  persist: true,
};

sagaOrchestrator.register(mySaga);
```

## Service Clients

| Client               | Environment Variable       | Default URL             |
| -------------------- | -------------------------- | ----------------------- |
| `authClient`         | `AUTH_SERVICE_URL`         | `http://localhost:3001` |
| `marketClient`       | `MARKET_SERVICE_URL`       | `http://localhost:3002` |
| `skillpodClient`     | `SKILLPOD_SERVICE_URL`     | `http://localhost:3003` |
| `cockpitClient`      | `COCKPIT_SERVICE_URL`      | `http://localhost:3004` |
| `billingClient`      | `BILLING_SERVICE_URL`      | `http://localhost:3005` |
| `notificationClient` | `NOTIFICATION_SERVICE_URL` | `http://localhost:3006` |

## Queue Names

```typescript
import { QueueNames } from '@skillancer/service-client';

QueueNames.JOB_PROCESSING; // Job and bidding
QueueNames.BID_NOTIFICATIONS;
QueueNames.CONTRACT_LIFECYCLE;
QueueNames.POD_PROVISIONING; // SkillPod
QueueNames.POD_CLEANUP;
QueueNames.SESSION_MANAGEMENT;
QueueNames.PAYMENT_PROCESSING; // Billing
QueueNames.ESCROW_MANAGEMENT;
QueueNames.INVOICE_GENERATION;
QueueNames.PAYOUT_PROCESSING;
QueueNames.EMAIL_QUEUE; // Notifications
QueueNames.PUSH_QUEUE;
QueueNames.SMS_QUEUE;
QueueNames.ANALYTICS_EVENTS; // Analytics
QueueNames.REPORT_GENERATION;
QueueNames.USER_ONBOARDING; // User lifecycle
QueueNames.PROFILE_VERIFICATION;
```

## Event Channels

```typescript
import { EventChannels } from '@skillancer/service-client';

EventChannels.USERS; // events:users
EventChannels.JOBS; // events:jobs
EventChannels.BIDS; // events:bids
EventChannels.CONTRACTS; // events:contracts
EventChannels.SKILLPODS; // events:skillpods
EventChannels.PAYMENTS; // events:payments
EventChannels.NOTIFICATIONS; // events:notifications
EventChannels.REVIEWS; // events:reviews
EventChannels.ALL; // events:*
EventChannels.SYSTEM; // events:system
EventChannels.AUDIT; // events:audit
```

## Configuration

### Redis Connection

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_QUEUE_DB=1    # Database for job queues
REDIS_EVENTS_DB=2   # Database for event bus
```

### Circuit Breaker

The circuit breaker has three states:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit tripped, requests fail fast
- **HALF_OPEN**: Testing if service has recovered

Default configuration:

- Failure threshold: 5 failures
- Reset timeout: 30 seconds

```typescript
import { CircuitBreaker } from '@skillancer/service-client';

const breaker = new CircuitBreaker({
  failureThreshold: 10,
  resetTimeout: 60000, // 1 minute
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Client Package                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ HTTP Clients │  │  Job Queues  │  │  Event Bus   │           │
│  │  + Circuit   │  │   (BullMQ)   │  │ (Redis Pub/  │           │
│  │   Breaker    │  │              │  │    Sub)      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                           │                  │                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Saga Orchestrator                        │   │
│  │         (Distributed Transaction Management)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Auth     │    │   Market    │    │  SkillPod   │
│   Service   │    │   Service   │    │   Service   │
└─────────────┘    └─────────────┘    └─────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Cockpit   │    │   Billing   │    │ Notification│
│   Service   │    │   Service   │    │   Service   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## License

MIT
