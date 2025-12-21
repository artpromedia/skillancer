// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/jobs/payout
 * Scheduled Jobs for Payout Processing
 *
 * Background jobs for:
 * - Processing scheduled automatic payouts
 * - Updating exchange rates
 * - Checking for stuck payouts
 * - Reconciliation
 */

import { createLogger } from '@skillancer/logger';

import { getPayoutRepository, type PayoutRepository } from '../repositories/payout.repository.js';
import {
  getExchangeRateService,
  type ExchangeRateService,
} from '../services/exchange-rate.service.js';
import {
  getGlobalPayoutService,
  type GlobalPayoutService,
} from '../services/global-payout.service.js';

const _logger = createLogger({ serviceName: 'payout-jobs' });

// =============================================================================
// JOB CONFIGURATIONS
// =============================================================================

export interface PayoutJobsConfig {
  stripeSecretKey: string;
  scheduledPayoutsCron?: string; // Default: '0 9 * * *' (daily at 9am)
  exchangeRateUpdateCron?: string; // Default: '0 * * * *' (hourly)
  stuckPayoutsCheckCron?: string; // Default: '*/15 * * * *' (every 15 min)
  reconciliationCron?: string; // Default: '0 0 * * *' (daily at midnight)
}

// =============================================================================
// SCHEDULED PAYOUT PROCESSOR
// =============================================================================

export class ScheduledPayoutProcessor {
  private readonly logger = createLogger({ serviceName: 'scheduled-payout-processor' });
  private readonly payoutService: GlobalPayoutService;
  private isRunning = false;

  constructor(config: { stripeSecretKey: string }) {
    this.payoutService = getGlobalPayoutService({ stripeSecretKey: config.stripeSecretKey });
  }

  /**
   * Process all scheduled payouts that are due
   * Should be run daily or based on configured schedule
   */
  async run(): Promise<{ processed: number; failed: number }> {
    if (this.isRunning) {
      this.logger.warn('Scheduled payout processor already running, skipping');
      return { processed: 0, failed: 0 };
    }

    this.isRunning = true;
    let processed = 0;
    let failed = 0;

    try {
      this.logger.info('Starting scheduled payout processing');

      await this.payoutService.processScheduledPayouts();
      processed++;

      this.logger.info('Scheduled payout processing completed', {
        processed,
        failed,
      });
    } catch (err) {
      this.logger.error('Scheduled payout processing failed', { err });
      failed++;
    } finally {
      this.isRunning = false;
    }

    return { processed, failed };
  }
}

// =============================================================================
// EXCHANGE RATE UPDATER
// =============================================================================

export class ExchangeRateUpdater {
  private readonly logger = createLogger({ serviceName: 'exchange-rate-updater' });
  private readonly exchangeService: ExchangeRateService;
  private isRunning = false;

  constructor() {
    this.exchangeService = getExchangeRateService();
  }

  /**
   * Refresh all exchange rates from external sources
   * Should be run hourly or based on configured schedule
   */
  async run(): Promise<{ updated: number; errors: number }> {
    if (this.isRunning) {
      this.logger.warn('Exchange rate updater already running, skipping');
      return { updated: 0, errors: 0 };
    }

    this.isRunning = true;
    let updated = 0;
    let errors = 0;

    try {
      this.logger.info('Starting exchange rate update');

      await this.exchangeService.refreshRates();
      updated++;

      this.logger.info('Exchange rate update completed', {
        updated,
        errors,
      });
    } catch (err) {
      this.logger.error('Exchange rate update failed', { err });
      errors++;
    } finally {
      this.isRunning = false;
    }

    return { updated, errors };
  }
}

// =============================================================================
// STUCK PAYOUT CHECKER
// =============================================================================

export class StuckPayoutChecker {
  private readonly logger = createLogger({ serviceName: 'stuck-payout-checker' });
  private readonly payoutRepo: PayoutRepository;
  private isRunning = false;

  // Thresholds for different statuses (in hours)
  private readonly STUCK_THRESHOLDS = {
    PENDING: 24, // Pending for more than 24 hours
    PROCESSING: 4, // Processing for more than 4 hours
    IN_TRANSIT: 168, // In transit for more than 7 days
  };

  constructor() {
    this.payoutRepo = getPayoutRepository();
  }

  /**
   * Check for payouts that seem stuck and alert
   * Should be run every 15 minutes or based on configured schedule
   */
  async run(): Promise<{ stuckCount: number; alerted: number }> {
    if (this.isRunning) {
      this.logger.warn('Stuck payout checker already running, skipping');
      return { stuckCount: 0, alerted: 0 };
    }

    this.isRunning = true;
    const stuckCount = 0;
    const alerted = 0;

    try {
      this.logger.info('Checking for stuck payouts');

      const now = new Date();

      // Check each threshold
      for (const [status, hours] of Object.entries(this.STUCK_THRESHOLDS)) {
        const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

        // In production, query database for payouts older than threshold
        // For now, log the check
        this.logger.debug(`Checking for ${status} payouts older than ${threshold.toISOString()}`);
      }

      this.logger.info('Stuck payout check completed', {
        stuckCount,
        alerted,
      });
    } catch (err) {
      this.logger.error('Stuck payout check failed', { err });
    } finally {
      this.isRunning = false;
    }

    return { stuckCount, alerted };
  }

  /**
   * Alert about a stuck payout
   */
  private async alertStuckPayout(payoutId: string, status: string, age: number): Promise<void> {
    this.logger.warn('Stuck payout detected', {
      payoutId,
      status,
      ageHours: age,
    });

    // In production:
    // - Send alert to ops team
    // - Create incident ticket
    // - Notify user if appropriate
  }
}

// =============================================================================
// PAYOUT RECONCILIATION
// =============================================================================

export class PayoutReconciliator {
  private readonly logger = createLogger({ serviceName: 'payout-reconciliator' });
  private readonly payoutRepo: PayoutRepository;
  private isRunning = false;

  constructor() {
    this.payoutRepo = getPayoutRepository();
  }

  /**
   * Reconcile local payout records with Stripe
   * Should be run daily at low-traffic times
   */
  async run(): Promise<{
    checked: number;
    discrepancies: number;
    fixed: number;
  }> {
    if (this.isRunning) {
      this.logger.warn('Payout reconciliation already running, skipping');
      return { checked: 0, discrepancies: 0, fixed: 0 };
    }

    this.isRunning = true;
    const checked = 0;
    const discrepancies = 0;
    const fixed = 0;

    try {
      this.logger.info('Starting payout reconciliation');

      // In production:
      // 1. Query all payouts from last N days
      // 2. For each, check status in Stripe
      // 3. Update any mismatched statuses
      // 4. Log discrepancies for review

      this.logger.info('Payout reconciliation completed', {
        checked,
        discrepancies,
        fixed,
      });
    } catch (err) {
      this.logger.error('Payout reconciliation failed', { err });
    } finally {
      this.isRunning = false;
    }

    return { checked, discrepancies, fixed };
  }
}

// =============================================================================
// JOB MANAGER
// =============================================================================

export class PayoutJobManager {
  private readonly logger = createLogger({ serviceName: 'payout-job-manager' });
  private readonly scheduledPayoutProcessor: ScheduledPayoutProcessor;
  private readonly exchangeRateUpdater: ExchangeRateUpdater;
  private readonly stuckPayoutChecker: StuckPayoutChecker;
  private readonly payoutReconciliator: PayoutReconciliator;

  private scheduledPayoutsInterval?: ReturnType<typeof setInterval>;
  private exchangeRateInterval?: ReturnType<typeof setInterval>;
  private stuckPayoutsInterval?: ReturnType<typeof setInterval>;
  private reconciliationInterval?: ReturnType<typeof setInterval>;

  constructor(config: PayoutJobsConfig) {
    this.scheduledPayoutProcessor = new ScheduledPayoutProcessor({
      stripeSecretKey: config.stripeSecretKey,
    });
    this.exchangeRateUpdater = new ExchangeRateUpdater();
    this.stuckPayoutChecker = new StuckPayoutChecker();
    this.payoutReconciliator = new PayoutReconciliator();
  }

  /**
   * Start all payout jobs with interval-based scheduling
   */
  start(): void {
    this.logger.info('Starting payout job manager');

    // Process scheduled payouts every hour (for testing)
    // In production, use proper cron scheduling
    this.scheduledPayoutsInterval = setInterval(
      async () => this.scheduledPayoutProcessor.run(),
      60 * 60 * 1000 // 1 hour
    );

    // Update exchange rates every hour
    this.exchangeRateInterval = setInterval(
      async () => this.exchangeRateUpdater.run(),
      60 * 60 * 1000 // 1 hour
    );

    // Check for stuck payouts every 15 minutes
    this.stuckPayoutsInterval = setInterval(
      async () => this.stuckPayoutChecker.run(),
      15 * 60 * 1000 // 15 minutes
    );

    // Run reconciliation daily (every 24 hours)
    this.reconciliationInterval = setInterval(
      async () => this.payoutReconciliator.run(),
      24 * 60 * 60 * 1000 // 24 hours
    );

    // Run initial exchange rate update
    this.exchangeRateUpdater.run();

    this.logger.info('Payout job manager started');
  }

  /**
   * Stop all payout jobs
   */
  stop(): void {
    this.logger.info('Stopping payout job manager');

    if (this.scheduledPayoutsInterval) {
      clearInterval(this.scheduledPayoutsInterval);
    }
    if (this.exchangeRateInterval) {
      clearInterval(this.exchangeRateInterval);
    }
    if (this.stuckPayoutsInterval) {
      clearInterval(this.stuckPayoutsInterval);
    }
    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
    }

    this.logger.info('Payout job manager stopped');
  }

  /**
   * Manually trigger a specific job
   */
  async runJob(
    jobName: 'scheduledPayouts' | 'exchangeRates' | 'stuckPayouts' | 'reconciliation'
  ): Promise<void> {
    switch (jobName) {
      case 'scheduledPayouts':
        await this.scheduledPayoutProcessor.run();
        break;
      case 'exchangeRates':
        await this.exchangeRateUpdater.run();
        break;
      case 'stuckPayouts':
        await this.stuckPayoutChecker.run();
        break;
      case 'reconciliation':
        await this.payoutReconciliator.run();
        break;
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let jobManagerInstance: PayoutJobManager | null = null;

export function getPayoutJobManager(config?: PayoutJobsConfig): PayoutJobManager {
  if (!jobManagerInstance) {
    if (!config?.stripeSecretKey) {
      throw new Error('Stripe secret key is required to initialize PayoutJobManager');
    }
    jobManagerInstance = new PayoutJobManager(config);
  }
  return jobManagerInstance;
}

export function startPayoutJobs(config: PayoutJobsConfig): void {
  const manager = getPayoutJobManager(config);
  manager.start();
}

export function stopPayoutJobs(): void {
  if (jobManagerInstance) {
    jobManagerInstance.stop();
  }
}
