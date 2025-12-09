/**
 * @module @skillancer/api-gateway/utils/circuit-breaker
 * Circuit breaker implementation for resilient service calls
 */

// ============================================================================
// TYPES
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Request timeout in milliseconds */
  timeout: number;
  /** Error percentage threshold to open circuit */
  errorThresholdPercentage: number;
  /** Time in ms before attempting to close circuit */
  resetTimeout: number;
  /** Minimum requests before calculating error percentage */
  volumeThreshold: number;
  /** Called when circuit opens */
  onOpen?: (name: string) => void;
  /** Called when circuit goes half-open */
  onHalfOpen?: (name: string) => void;
  /** Called when circuit closes */
  onClose?: (name: string) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  errorPercentage: number;
}

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new CircuitOpenError(this.name);
    }

    try {
      // Create timeout wrapper
      const result = await this.withTimeout(fn(), this.options.timeout);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable(): boolean {
    return this.state !== 'open';
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const totalRequests = this.failures + this.successes;
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      errorPercentage: totalRequests > 0 ? (this.failures / totalRequests) * 100 : 0,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'half-open') {
      this.closeCircuit();
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.openCircuit();
      return;
    }

    const totalRequests = this.failures + this.successes;
    if (totalRequests >= this.options.volumeThreshold) {
      const errorPercentage = (this.failures / totalRequests) * 100;
      if (errorPercentage >= this.options.errorThresholdPercentage) {
        this.openCircuit();
      }
    }
  }

  private openCircuit(): void {
    this.state = 'open';
    this.options.onOpen?.(this.name);

    // Schedule transition to half-open
    this.resetTimer = setTimeout(() => {
      this.halfOpenCircuit();
    }, this.options.resetTimeout);
  }

  private halfOpenCircuit(): void {
    this.state = 'half-open';
    this.options.onHalfOpen?.(this.name);
  }

  private closeCircuit(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.options.onClose?.(this.name);
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Request timed out after ${ms}ms`));
      }, ms);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  if (!breakers.has(name)) {
    const defaultOptions: CircuitBreakerOptions = {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      volumeThreshold: 10,
      onOpen: (n) => console.warn(`[CircuitBreaker] Circuit "${n}" OPENED`),
      onHalfOpen: (n) => console.info(`[CircuitBreaker] Circuit "${n}" HALF-OPEN`),
      onClose: (n) => console.info(`[CircuitBreaker] Circuit "${n}" CLOSED`),
    };

    const breaker = new CircuitBreaker(name, { ...defaultOptions, ...options });
    breakers.set(name, breaker);
  }

  return breakers.get(name)!;
}

/**
 * Get statistics for all circuit breakers
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  breakers.forEach((breaker, name) => {
    stats[name] = breaker.getStats();
  });
  return stats;
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  breakers.forEach((breaker) => breaker.reset());
}

/**
 * Clear all circuit breakers (useful for testing)
 */
export function clearCircuitBreakers(): void {
  breakers.forEach((breaker) => breaker.reset());
  breakers.clear();
}

// ============================================================================
// ERRORS
// ============================================================================

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit breaker "${circuitName}" is open`);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
