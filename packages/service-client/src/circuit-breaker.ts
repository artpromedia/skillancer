/**
 * @module @skillancer/service-client/circuit-breaker
 * Circuit breaker pattern implementation for fault tolerance
 */

// ============================================================================
// Types
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  threshold: number;
  /** Time in ms before attempting to close the circuit */
  resetTimeout: number;
  /** Percentage of errors that triggers the circuit to open (0-100) */
  errorThresholdPercentage?: number;
  /** Minimum number of requests before calculating error percentage */
  volumeThreshold?: number;
  /** Request timeout in ms */
  timeout?: number;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
}

// ============================================================================
// Errors
// ============================================================================

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';

  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CircuitTimeoutError extends Error {
  readonly code = 'CIRCUIT_TIMEOUT';

  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'CircuitTimeoutError';
    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private halfOpenRequests = 0;
  private readonly maxHalfOpenRequests = 1;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    // Set defaults with explicit override
    this.config = {
      threshold: config.threshold ?? 5,
      resetTimeout: config.resetTimeout ?? 30000,
      errorThresholdPercentage: config.errorThresholdPercentage ?? 50,
      volumeThreshold: config.volumeThreshold ?? 10,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new CircuitOpenError(
        `Circuit breaker is open. Will retry after ${this.config.resetTimeout}ms`
      );
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenRequests >= this.maxHalfOpenRequests) {
      throw new CircuitOpenError('Circuit breaker is half-open and at max requests');
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests++;
    }

    this.totalRequests++;

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.timeout) {
      return fn();
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CircuitTimeoutError(`Operation timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // Success in half-open state - close the circuit
      this.transitionTo('CLOSED');
      this.resetCounters();
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // Failure in half-open state - reopen the circuit
      this.transitionTo('OPEN');
      this.scheduleReset();
      return;
    }

    if (this.shouldTrip()) {
      this.transitionTo('OPEN');
      this.scheduleReset();
    }
  }

  /**
   * Check if circuit should trip based on failure threshold
   */
  private shouldTrip(): boolean {
    // Check absolute threshold
    if (this.failures >= this.config.threshold) {
      return true;
    }

    // Check percentage threshold
    const { errorThresholdPercentage, volumeThreshold } = this.config;
    if (errorThresholdPercentage && volumeThreshold && this.totalRequests >= volumeThreshold) {
      const errorPercentage = (this.failures / this.totalRequests) * 100;
      return errorPercentage >= errorThresholdPercentage;
    }

    return false;
  }

  /**
   * Schedule circuit reset attempt
   */
  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.transitionTo('HALF_OPEN');
      this.halfOpenRequests = 0;
    }, this.config.resetTimeout);
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    if (this.config.onStateChange && previousState !== newState) {
      this.config.onStateChange(previousState, newState);
    }
  }

  /**
   * Reset failure counters
   */
  private resetCounters(): void {
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.halfOpenRequests = 0;

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Get current circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === 'CLOSED';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'HALF_OPEN';
  }

  /**
   * Force circuit to open
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
    this.scheduleReset();
  }

  /**
   * Force circuit to close
   */
  forceClose(): void {
    this.transitionTo('CLOSED');
    this.resetCounters();
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.forceClose();
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
  }
}

// ============================================================================
// Circuit Breaker Registry
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  serviceName: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(
      serviceName,
      new CircuitBreaker({
        threshold: 5,
        resetTimeout: 30000,
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
        ...config,
      })
    );
  }
  const breaker = circuitBreakers.get(serviceName);
  if (!breaker) {
    throw new Error(`Failed to create circuit breaker for ${serviceName}`);
  }
  return breaker;
}

/**
 * Get all circuit breaker stats
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of circuitBreakers) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
}
