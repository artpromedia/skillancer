/**
 * @fileoverview Business metrics for Skillancer platform
 *
 * Provides convenience methods for recording business-specific metrics:
 * - User activities (signups, logins)
 * - Marketplace events (jobs, bids, contracts)
 * - Payment events
 * - Session metrics
 */

import { MetricsService } from './index.js';

import type { MetricConfig } from './types.js';

/**
 * Business metrics configuration
 */
export interface BusinessMetricsConfig extends Partial<MetricConfig> {
  /**
   * MetricsService instance to use (optional - will create one if not provided)
   */
  metrics?: MetricsService | undefined;
}

/**
 * BusinessMetrics - Convenience wrapper for platform-specific metrics
 */
export class BusinessMetrics {
  private metrics: MetricsService;

  constructor(config: BusinessMetricsConfig = {}) {
    this.metrics =
      config.metrics ??
      new MetricsService({
        namespace: config.namespace ?? 'Skillancer/Business',
        serviceName: config.serviceName ?? 'business-metrics',
        environment: config.environment ?? process.env.NODE_ENV ?? 'development',
        ...config,
      });
  }

  /**
   * Get the underlying MetricsService
   */
  getMetricsService(): MetricsService {
    return this.metrics;
  }

  // ==========================================================================
  // User Metrics
  // ==========================================================================

  /**
   * Record a user signup
   */
  userSignup(options: {
    provider?: string;
    userType?: 'freelancer' | 'client';
    referralSource?: string;
  } = {}): void {
    this.metrics.increment('UserSignup', 1, {
      Provider: options.provider ?? 'email',
      UserType: options.userType ?? 'unknown',
      ...(options.referralSource && { ReferralSource: options.referralSource }),
    });
  }

  /**
   * Record a user login
   */
  userLogin(options: {
    provider?: string;
    success?: boolean;
  } = {}): void {
    this.metrics.increment('UserLogin', 1, {
      Provider: options.provider ?? 'email',
      Success: String(options.success ?? true),
    });
  }

  /**
   * Record a failed login attempt
   */
  loginFailed(options: {
    provider?: string;
    reason?: string;
  } = {}): void {
    this.metrics.increment('LoginFailed', 1, {
      Provider: options.provider ?? 'email',
      Reason: options.reason ?? 'invalid_credentials',
    });
  }

  /**
   * Record profile update
   */
  profileUpdated(options: {
    userType?: 'freelancer' | 'client';
    field?: string;
  } = {}): void {
    this.metrics.increment('ProfileUpdated', 1, {
      UserType: options.userType ?? 'unknown',
      ...(options.field && { Field: options.field }),
    });
  }

  // ==========================================================================
  // Marketplace Metrics
  // ==========================================================================

  /**
   * Record a job posting
   */
  jobPosted(options: {
    category?: string;
    budget?: number;
    budgetType?: 'fixed' | 'hourly';
  } = {}): void {
    this.metrics.increment('JobPosted', 1, {
      Category: options.category ?? 'other',
      BudgetType: options.budgetType ?? 'fixed',
    });

    if (options.budget) {
      this.metrics.record({
        name: 'JobBudget',
        value: options.budget,
        dimensions: {
          Category: options.category ?? 'other',
          BudgetType: options.budgetType ?? 'fixed',
        },
      });
    }
  }

  /**
   * Record a bid submission
   */
  bidSubmitted(options: {
    category?: string;
    amount?: number;
  } = {}): void {
    this.metrics.increment('BidSubmitted', 1, {
      Category: options.category ?? 'other',
    });

    if (options.amount) {
      this.metrics.record({
        name: 'BidAmount',
        value: options.amount,
        dimensions: {
          Category: options.category ?? 'other',
        },
      });
    }
  }

  /**
   * Record a bid acceptance
   */
  bidAccepted(options: {
    category?: string;
    amount?: number;
  } = {}): void {
    this.metrics.increment('BidAccepted', 1, {
      Category: options.category ?? 'other',
    });

    if (options.amount) {
      this.metrics.record({
        name: 'AcceptedBidAmount',
        value: options.amount,
        dimensions: {
          Category: options.category ?? 'other',
        },
      });
    }
  }

  /**
   * Record a contract creation
   */
  contractCreated(options: {
    category?: string;
    value?: number;
    contractType?: 'fixed' | 'hourly';
  } = {}): void {
    this.metrics.increment('ContractCreated', 1, {
      Category: options.category ?? 'other',
      ContractType: options.contractType ?? 'fixed',
    });

    if (options.value) {
      this.metrics.record({
        name: 'ContractValue',
        value: options.value,
        dimensions: {
          Category: options.category ?? 'other',
          ContractType: options.contractType ?? 'fixed',
        },
      });
    }
  }

  /**
   * Record a contract completion
   */
  contractCompleted(options: {
    category?: string;
    value?: number;
    duration?: number; // days
  } = {}): void {
    this.metrics.increment('ContractCompleted', 1, {
      Category: options.category ?? 'other',
    });

    if (options.value) {
      this.metrics.record({
        name: 'CompletedContractValue',
        value: options.value,
        dimensions: {
          Category: options.category ?? 'other',
        },
      });
    }

    if (options.duration) {
      this.metrics.record({
        name: 'ContractDuration',
        value: options.duration,
        dimensions: {
          Category: options.category ?? 'other',
        },
      });
    }
  }

  // ==========================================================================
  // Payment Metrics
  // ==========================================================================

  /**
   * Record a payment processed
   */
  paymentProcessed(options: {
    amount: number;
    currency?: string;
    paymentMethod?: string;
    type?: 'deposit' | 'withdrawal' | 'transfer';
  }): void {
    this.metrics.increment('PaymentProcessed', 1, {
      Currency: options.currency ?? 'USD',
      PaymentMethod: options.paymentMethod ?? 'unknown',
      Type: options.type ?? 'transfer',
    });

    this.metrics.record({
      name: 'PaymentAmount',
      value: options.amount,
      dimensions: {
        Currency: options.currency ?? 'USD',
        PaymentMethod: options.paymentMethod ?? 'unknown',
        Type: options.type ?? 'transfer',
      },
    });
  }

  /**
   * Record a payment failure
   */
  paymentFailed(options: {
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    reason?: string;
  } = {}): void {
    this.metrics.increment('PaymentFailed', 1, {
      Currency: options.currency ?? 'USD',
      PaymentMethod: options.paymentMethod ?? 'unknown',
      Reason: options.reason ?? 'unknown',
    });
  }

  /**
   * Record a refund
   */
  refundProcessed(options: {
    amount: number;
    currency?: string;
    reason?: string;
  }): void {
    this.metrics.increment('RefundProcessed', 1, {
      Currency: options.currency ?? 'USD',
      Reason: options.reason ?? 'unknown',
    });

    this.metrics.record({
      name: 'RefundAmount',
      value: options.amount,
      dimensions: {
        Currency: options.currency ?? 'USD',
        Reason: options.reason ?? 'unknown',
      },
    });
  }

  // ==========================================================================
  // Session Metrics
  // ==========================================================================

  /**
   * Record a session start
   */
  sessionStarted(options: {
    platform?: 'web' | 'mobile' | 'api';
  } = {}): void {
    this.metrics.increment('SessionStarted', 1, {
      Platform: options.platform ?? 'web',
    });
  }

  /**
   * Record a session end
   */
  sessionEnded(options: {
    duration?: number; // seconds
    platform?: 'web' | 'mobile' | 'api';
  } = {}): void {
    this.metrics.increment('SessionEnded', 1, {
      Platform: options.platform ?? 'web',
    });

    if (options.duration) {
      this.metrics.timing('SessionDuration', options.duration * 1000, {
        Platform: options.platform ?? 'web',
      });
    }
  }

  // ==========================================================================
  // Search Metrics
  // ==========================================================================

  /**
   * Record a search performed
   */
  searchPerformed(options: {
    query?: string;
    resultsCount?: number;
    searchType?: 'jobs' | 'freelancers' | 'all';
    filters?: Record<string, unknown>;
  } = {}): void {
    this.metrics.increment('SearchPerformed', 1, {
      SearchType: options.searchType ?? 'all',
      HasResults: String((options.resultsCount ?? 0) > 0),
    });

    if (options.resultsCount !== undefined) {
      this.metrics.gauge('SearchResultsCount', options.resultsCount, {
        SearchType: options.searchType ?? 'all',
      });
    }
  }

  // ==========================================================================
  // Messaging Metrics
  // ==========================================================================

  /**
   * Record messages sent
   */
  messagesSent(options: {
    count?: number;
    hasAttachment?: boolean;
  } = {}): void {
    this.metrics.increment('MessagesSent', options.count ?? 1, {
      HasAttachment: String(options.hasAttachment ?? false),
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Flush pending metrics
   */
  async flush(): Promise<void> {
    await this.metrics.flush();
  }

  /**
   * Shutdown the metrics service
   */
  async shutdown(): Promise<void> {
    await this.metrics.shutdown();
  }
}

/**
 * Create a new BusinessMetrics instance
 */
export function createBusinessMetrics(config: BusinessMetricsConfig = {}): BusinessMetrics {
  return new BusinessMetrics(config);
}

export { MetricsService };
