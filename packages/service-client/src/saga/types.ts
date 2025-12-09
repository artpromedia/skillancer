/**
 * @module @skillancer/service-client/saga
 * Saga pattern type definitions for distributed transactions
 */

import type { DomainEvent } from '../events/types.js';

/**
 * Saga step status
 */
export type SagaStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated';

/**
 * Saga execution status
 */
export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated';

/**
 * Saga step execution context
 */
export interface SagaContext<T = unknown> {
  /** Unique saga instance ID */
  sagaId: string;
  /** Saga definition name */
  sagaName: string;
  /** Initial input data */
  input: T;
  /** Accumulated state from previous steps */
  state: Record<string, unknown>;
  /** User ID who initiated the saga */
  userId?: string | undefined;
  /** Correlation ID for tracing */
  correlationId?: string | undefined;
  /** Current retry attempt */
  attempt: number;
  /** Timestamps */
  startedAt: Date;
  /** Metadata */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Saga step definition
 */
export interface SagaStep<TInput = unknown, TOutput = unknown> {
  /** Unique step name */
  name: string;
  /** Step description */
  description?: string | undefined;
  /** Execute the step's forward action */
  execute: (context: SagaContext<TInput>) => Promise<TOutput>;
  /** Compensate/rollback if a later step fails */
  compensate?: ((context: SagaContext<TInput>, result: TOutput) => Promise<void>) | undefined;
  /** Retry configuration for this step */
  retry?:
    | {
        maxAttempts: number;
        delay: number;
        backoffMultiplier?: number | undefined;
      }
    | undefined;
  /** Timeout for this step in milliseconds */
  timeout?: number | undefined;
  /** Whether this step is optional (saga continues if it fails) */
  optional?: boolean | undefined;
}

/**
 * Saga step execution result
 */
export interface SagaStepResult<T = unknown> {
  /** Step name */
  stepName: string;
  /** Step status */
  status: SagaStepStatus;
  /** Step output data */
  output?: T | undefined;
  /** Error if step failed */
  error?:
    | {
        message: string;
        code?: string | undefined;
        details?: unknown | undefined;
      }
    | undefined;
  /** Execution timestamps */
  startedAt: Date;
  completedAt?: Date | undefined;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** Number of retry attempts */
  attempts: number;
}

/**
 * Saga definition
 */
export interface SagaDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique saga name */
  name: string;
  /** Saga description */
  description?: string | undefined;
  /** Saga version for compatibility */
  version: number;
  /** Ordered list of steps to execute */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: SagaStep<TInput, any>[];
  /** Event to emit on successful completion */
  successEvent?:
    | {
        type: string;
        channel: string;
      }
    | undefined;
  /** Event to emit on failure */
  failureEvent?:
    | {
        type: string;
        channel: string;
      }
    | undefined;
  /** Transform final output */
  transformOutput?:
    | ((context: SagaContext<TInput>, stepResults: SagaStepResult[]) => TOutput)
    | undefined;
  /** Global timeout for entire saga in milliseconds */
  timeout?: number | undefined;
  /** Whether to persist saga state for recovery */
  persist?: boolean | undefined;
}

/**
 * Saga execution result
 */
export interface SagaResult<TOutput = unknown> {
  /** Saga instance ID */
  sagaId: string;
  /** Saga definition name */
  sagaName: string;
  /** Final saga status */
  status: SagaStatus;
  /** Output data if successful */
  output?: TOutput | undefined;
  /** Error if failed */
  error?:
    | {
        message: string;
        code?: string | undefined;
        failedStep?: string | undefined;
        details?: unknown | undefined;
      }
    | undefined;
  /** Results of each step */
  stepResults: SagaStepResult[];
  /** Execution timestamps */
  startedAt: Date;
  completedAt: Date;
  /** Total duration in milliseconds */
  duration: number;
  /** Events emitted during saga */
  events?: DomainEvent[] | undefined;
}

/**
 * Saga state for persistence/recovery
 */
export interface SagaState<T = unknown> {
  /** Saga instance ID */
  sagaId: string;
  /** Saga definition name */
  sagaName: string;
  /** Saga definition version */
  version: number;
  /** Current saga status */
  status: SagaStatus;
  /** Current step index */
  currentStepIndex: number;
  /** Saga context */
  context: SagaContext<T>;
  /** Step results */
  stepResults: SagaStepResult[];
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
  /** Retry count for entire saga */
  retryCount: number;
}

/**
 * Saga store interface for persistence
 */
export interface SagaStore {
  /** Save saga state */
  save(state: SagaState): Promise<void>;
  /** Load saga state by ID */
  load(sagaId: string): Promise<SagaState | null>;
  /** Update saga state */
  update(sagaId: string, state: Partial<SagaState>): Promise<void>;
  /** Delete completed/failed saga state */
  delete(sagaId: string): Promise<void>;
  /** Find sagas by status */
  findByStatus(status: SagaStatus): Promise<SagaState[]>;
  /** Find stuck/timed out sagas */
  findStuck(olderThan: Date): Promise<SagaState[]>;
}

/**
 * Options for saga execution
 */
export interface SagaExecutionOptions {
  /** Custom saga ID (auto-generated if not provided) */
  sagaId?: string;
  /** User ID to associate with saga */
  userId?: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Override default timeout */
  timeout?: number;
  /** Whether to wait for completion */
  async?: boolean;
}

/**
 * Saga error types
 */
export class SagaError extends Error {
  public readonly code: string;
  public readonly sagaId: string;
  public readonly sagaName: string;
  public readonly failedStep?: string | undefined;

  constructor(
    message: string,
    code: string,
    sagaId: string,
    sagaName: string,
    failedStep?: string | undefined,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'SagaError';
    this.code = code;
    this.sagaId = sagaId;
    this.sagaName = sagaName;
    if (failedStep !== undefined) {
      this.failedStep = failedStep;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class SagaTimeoutError extends SagaError {
  constructor(sagaId: string, sagaName: string, step?: string | undefined) {
    super(`Saga timeout${step ? ` at step: ${step}` : ''}`, 'SAGA_TIMEOUT', sagaId, sagaName, step);
    this.name = 'SagaTimeoutError';
  }
}

export class SagaCompensationError extends SagaError {
  constructor(sagaId: string, sagaName: string, step: string, cause?: Error | undefined) {
    super(
      `Compensation failed at step: ${step}`,
      'COMPENSATION_FAILED',
      sagaId,
      sagaName,
      step,
      cause
    );
    this.name = 'SagaCompensationError';
  }
}
