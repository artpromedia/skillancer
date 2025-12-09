/**
 * @module @skillancer/service-client/saga
 * Saga Orchestrator for distributed transactions
 */

import { randomUUID } from 'node:crypto';

import { eventBus } from '../events/event-bus.js';
import { logger } from '../logger.js';
import { getContext } from '../request-context.js';
import { SagaError, SagaTimeoutError, SagaCompensationError } from './types.js';

import type {
  SagaDefinition,
  SagaContext,
  SagaResult,
  SagaStepResult,
  SagaStatus,
  SagaStepStatus,
  SagaExecutionOptions,
  SagaStore,
  SagaState,
  SagaStep,
} from './types.js';

/**
 * In-memory saga store implementation
 */
export class InMemorySagaStore implements SagaStore {
  private store: Map<string, SagaState> = new Map();

  save(state: SagaState): Promise<void> {
    this.store.set(state.sagaId, { ...state });
    return Promise.resolve();
  }

  load(sagaId: string): Promise<SagaState | null> {
    const state = this.store.get(sagaId);
    return Promise.resolve(state ? { ...state } : null);
  }

  update(sagaId: string, updates: Partial<SagaState>): Promise<void> {
    const existing = this.store.get(sagaId);
    if (existing) {
      this.store.set(sagaId, {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      });
    }
    return Promise.resolve();
  }

  delete(sagaId: string): Promise<void> {
    this.store.delete(sagaId);
    return Promise.resolve();
  }

  findByStatus(status: SagaStatus): Promise<SagaState[]> {
    return Promise.resolve(Array.from(this.store.values()).filter((s) => s.status === status));
  }

  findStuck(olderThan: Date): Promise<SagaState[]> {
    return Promise.resolve(
      Array.from(this.store.values()).filter(
        (s) => s.status === 'running' && s.updatedAt < olderThan
      )
    );
  }
}

/**
 * Saga Orchestrator - coordinates distributed transactions
 */
export class SagaOrchestrator {
  private definitions: Map<string, SagaDefinition<unknown, unknown>> = new Map();
  private store: SagaStore;

  constructor(store?: SagaStore) {
    this.store = store ?? new InMemorySagaStore();
  }

  /**
   * Register a saga definition
   */
  register<TInput = unknown, TOutput = unknown>(definition: SagaDefinition<TInput, TOutput>): void {
    if (this.definitions.has(definition.name)) {
      logger.warn({ sagaName: definition.name }, 'Overwriting existing saga definition');
    }

    this.definitions.set(definition.name, definition as SagaDefinition<unknown, unknown>);
    logger.info(
      { sagaName: definition.name, version: definition.version, steps: definition.steps.length },
      'Saga definition registered'
    );
  }

  /**
   * Execute a saga
   */
  async execute<TInput, TOutput>(
    sagaName: string,
    input: TInput,
    options: SagaExecutionOptions = {}
  ): Promise<SagaResult<TOutput>> {
    const definition = this.definitions.get(sagaName) as
      | SagaDefinition<TInput, TOutput>
      | undefined;
    if (!definition) {
      throw new SagaError(
        `Saga definition not found: ${sagaName}`,
        'SAGA_NOT_FOUND',
        options.sagaId || 'unknown',
        sagaName
      );
    }

    const requestContext = getContext();
    const sagaId = options.sagaId || randomUUID();
    const startedAt = new Date();

    const context: SagaContext<TInput> = {
      sagaId,
      sagaName,
      input,
      state: {},
      attempt: 1,
      startedAt,
    };

    // Set optional properties only if they have values
    const userId = options.userId ?? requestContext?.userId;
    if (userId !== undefined) context.userId = userId;

    const correlationId = options.correlationId ?? requestContext?.traceId;
    if (correlationId !== undefined) context.correlationId = correlationId;

    if (options.metadata !== undefined) context.metadata = options.metadata;

    logger.info(
      {
        sagaId,
        sagaName,
        correlationId: context.correlationId,
        userId: context.userId,
      },
      'Starting saga execution'
    );

    const stepResults: SagaStepResult[] = [];
    let status: SagaStatus = 'running';
    let error: SagaResult['error'];
    let output: TOutput | undefined;

    // Save initial state if persistence is enabled
    if (definition.persist) {
      await this.store.save({
        sagaId,
        sagaName,
        version: definition.version,
        status: 'running',
        currentStepIndex: 0,
        context: context as SagaContext<unknown>,
        stepResults: [],
        createdAt: startedAt,
        updatedAt: startedAt,
        retryCount: 0,
      });
    }

    try {
      // Set up timeout if configured
      const timeout = options.timeout ?? definition.timeout;
      const timeoutPromise = timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new SagaTimeoutError(sagaId, sagaName)), timeout)
          )
        : null;

      // Execute steps
      const executeSteps = async (): Promise<void> => {
        for (let i = 0; i < definition.steps.length; i++) {
          const step = definition.steps[i];
          if (!step) continue;

          const stepResult = await this.executeStep(step as SagaStep<TInput, unknown>, context);
          stepResults.push(stepResult);

          // Update persisted state
          if (definition.persist) {
            await this.store.update(sagaId, {
              currentStepIndex: i,
              stepResults: [...stepResults],
              context: { ...context } as SagaContext<unknown>,
            });
          }

          // Check if step failed
          if (stepResult.status === 'failed' && !step.optional) {
            throw new SagaError(
              stepResult.error?.message ?? 'Step failed',
              stepResult.error?.code ?? 'STEP_FAILED',
              sagaId,
              sagaName,
              step.name
            );
          }

          // Merge step output into context state
          if (stepResult.output !== undefined) {
            context.state[step.name] = stepResult.output;
          }
        }
      };

      // Execute with optional timeout
      if (timeoutPromise) {
        await Promise.race([executeSteps(), timeoutPromise]);
      } else {
        await executeSteps();
      }

      // All steps completed successfully
      status = 'completed';

      // Transform output if configured
      if (definition.transformOutput) {
        output = definition.transformOutput(context, stepResults);
      } else {
        output = context.state as TOutput;
      }

      // Emit success event
      if (definition.successEvent) {
        await eventBus.publish(
          definition.successEvent.channel,
          definition.successEvent.type,
          { sagaId, sagaName, output },
          { aggregateId: sagaId, aggregateType: 'Saga' }
        );
      }

      logger.info(
        {
          sagaId,
          sagaName,
          duration: Date.now() - startedAt.getTime(),
          stepsCompleted: stepResults.length,
        },
        'Saga completed successfully'
      );
    } catch (err) {
      const sagaError =
        err instanceof SagaError
          ? err
          : new SagaError(
              err instanceof Error ? err.message : String(err),
              'SAGA_FAILED',
              sagaId,
              sagaName
            );

      error = {
        message: sagaError.message,
      };
      if (sagaError.code) error.code = sagaError.code;
      if (sagaError.failedStep) error.failedStep = sagaError.failedStep;

      logger.error(
        {
          sagaId,
          sagaName,
          error: error.message,
          failedStep: error.failedStep,
        },
        'Saga failed, starting compensation'
      );

      // Compensate completed steps in reverse order
      status = 'compensating';

      if (definition.persist) {
        await this.store.update(sagaId, { status: 'compensating' });
      }

      try {
        await this.compensate(
          definition as SagaDefinition<unknown, unknown>,
          context as SagaContext<unknown>,
          stepResults
        );
        status = 'compensated';
      } catch (compError) {
        status = 'failed';

        const compensationError =
          compError instanceof SagaCompensationError
            ? compError
            : new SagaCompensationError(
                sagaId,
                sagaName,
                'unknown',
                compError instanceof Error ? compError : undefined
              );

        logger.error(
          {
            sagaId,
            sagaName,
            error: compensationError.message,
          },
          'Saga compensation failed'
        );
      }

      // Emit failure event
      if (definition.failureEvent) {
        await eventBus.publish(
          definition.failureEvent.channel,
          definition.failureEvent.type,
          { sagaId, sagaName, error },
          { aggregateId: sagaId, aggregateType: 'Saga' }
        );
      }
    }

    const completedAt = new Date();
    const result: SagaResult<TOutput> = {
      sagaId,
      sagaName,
      status,
      stepResults,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
    };

    if (output !== undefined) result.output = output;
    if (error !== undefined) result.error = error;

    // Update final state
    if (definition.persist) {
      await this.store.update(sagaId, {
        status,
        stepResults,
        updatedAt: completedAt,
      });

      // Optionally clean up completed sagas
      if (status === 'completed' || status === 'compensated') {
        // Keep for audit, or delete: await this.store.delete(sagaId);
      }
    }

    return result;
  }

  /**
   * Execute a single saga step with retry logic
   */
  private async executeStep<TInput>(
    step: SagaStep<TInput, unknown>,
    context: SagaContext<TInput>
  ): Promise<SagaStepResult> {
    const startedAt = new Date();
    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const retryDelay = step.retry?.delay ?? 1000;
    const backoffMultiplier = step.retry?.backoffMultiplier ?? 2;

    let status: SagaStepStatus = 'running';
    let output: unknown;
    let error: SagaStepResult['error'];
    let attempts = 0;

    logger.debug(
      {
        sagaId: context.sagaId,
        step: step.name,
        maxAttempts,
      },
      'Executing saga step'
    );

    while (attempts < maxAttempts) {
      attempts++;

      try {
        // Set up step timeout if configured
        if (step.timeout) {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Step timeout after ${step.timeout}ms`)),
              step.timeout
            )
          );

          output = await Promise.race([step.execute(context), timeoutPromise]);
        } else {
          output = await step.execute(context);
        }

        status = 'completed';
        break;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        logger.warn(
          {
            sagaId: context.sagaId,
            step: step.name,
            attempt: attempts,
            maxAttempts,
            error: errorMessage,
          },
          'Saga step attempt failed'
        );

        if (attempts < maxAttempts) {
          const delay = retryDelay * Math.pow(backoffMultiplier, attempts - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          status = 'failed';
          error = {
            message: errorMessage,
          };
          const errCode = err instanceof Error && 'code' in err ? String(err.code) : undefined;
          if (errCode !== undefined) error.code = errCode;
        }
      }
    }

    const completedAt = new Date();

    const result: SagaStepResult = {
      stepName: step.name,
      status,
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      attempts,
    };

    if (output !== undefined) result.output = output;
    if (error !== undefined) result.error = error;

    return result;
  }

  /**
   * Compensate completed steps in reverse order
   */
  private async compensate(
    definition: SagaDefinition<unknown, unknown>,
    context: SagaContext<unknown>,
    stepResults: SagaStepResult[]
  ): Promise<void> {
    const completedSteps = stepResults.filter((r) => r.status === 'completed');

    logger.info(
      {
        sagaId: context.sagaId,
        sagaName: definition.name,
        stepsToCompensate: completedSteps.length,
      },
      'Starting compensation'
    );

    // Compensate in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const stepResult = completedSteps[i];
      if (!stepResult) continue;

      const step = definition.steps.find((s) => s.name === stepResult.stepName);

      if (!step?.compensate) {
        logger.debug(
          {
            sagaId: context.sagaId,
            step: stepResult.stepName,
          },
          'Step has no compensation, skipping'
        );
        continue;
      }

      try {
        logger.debug(
          {
            sagaId: context.sagaId,
            step: step.name,
          },
          'Compensating step'
        );

        await step.compensate(context, stepResult.output);

        // Update step result status
        stepResult.status = 'compensated';

        logger.debug(
          {
            sagaId: context.sagaId,
            step: step.name,
          },
          'Step compensated successfully'
        );
      } catch (err) {
        stepResult.status = 'failed';

        throw new SagaCompensationError(
          context.sagaId,
          context.sagaName,
          step.name,
          err instanceof Error ? err : undefined
        );
      }
    }

    logger.info(
      {
        sagaId: context.sagaId,
        sagaName: definition.name,
      },
      'Compensation completed'
    );
  }

  /**
   * Recover stuck sagas
   */
  async recoverStuckSagas(olderThan: Date): Promise<void> {
    const stuckSagas = await this.store.findStuck(olderThan);

    logger.info({ count: stuckSagas.length }, 'Found stuck sagas for recovery');

    for (const state of stuckSagas) {
      try {
        const definition = this.definitions.get(state.sagaName);
        if (!definition) {
          logger.warn(
            { sagaId: state.sagaId, sagaName: state.sagaName },
            'Cannot recover saga - definition not found'
          );
          continue;
        }

        // Mark as compensating and run compensation
        await this.store.update(state.sagaId, { status: 'compensating' });

        await this.compensate(definition, state.context, state.stepResults);

        await this.store.update(state.sagaId, { status: 'compensated' });

        logger.info(
          { sagaId: state.sagaId, sagaName: state.sagaName },
          'Stuck saga recovered and compensated'
        );
      } catch (err) {
        logger.error(
          {
            sagaId: state.sagaId,
            sagaName: state.sagaName,
            error: err instanceof Error ? err.message : String(err),
          },
          'Failed to recover stuck saga'
        );

        await this.store.update(state.sagaId, { status: 'failed' });
      }
    }
  }

  /**
   * Get saga status
   */
  async getStatus(sagaId: string): Promise<SagaState | null> {
    return this.store.load(sagaId);
  }

  /**
   * Get registered saga definitions
   */
  getDefinitions(): Map<string, SagaDefinition<unknown, unknown>> {
    return new Map(this.definitions);
  }
}

/**
 * Singleton saga orchestrator instance
 */
export const sagaOrchestrator = new SagaOrchestrator();
