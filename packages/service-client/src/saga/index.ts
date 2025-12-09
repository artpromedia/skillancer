/**
 * @module @skillancer/service-client/saga
 * Saga barrel exports
 */

export { SagaOrchestrator, sagaOrchestrator, InMemorySagaStore } from './orchestrator.js';

export {
  SagaError,
  SagaTimeoutError,
  SagaCompensationError,
  type SagaDefinition,
  type SagaStep,
  type SagaContext,
  type SagaResult,
  type SagaStepResult,
  type SagaStatus,
  type SagaStepStatus,
  type SagaExecutionOptions,
  type SagaStore,
  type SagaState,
} from './types.js';

export {
  createContractSaga,
  type CreateContractSagaInput,
  type CreateContractSagaOutput,
} from './create-contract-saga.js';
