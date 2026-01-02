import { runTokenRefreshJob, markExpiredTokens } from './token-refresh.job';
import { runScheduledSyncJob, syncByIntegrationType } from './scheduled-sync.job';
import { runHealthCheckJob, getHealthSummary } from './health-check.job';
import { logger } from '@skillancer/logger';

const log = logger.child({ module: 'jobs' });

// Job intervals in milliseconds
const INTERVALS = {
  TOKEN_REFRESH: 15 * 60 * 1000, // 15 minutes
  SCHEDULED_SYNC: 60 * 60 * 1000, // 1 hour
  HEALTH_CHECK: 6 * 60 * 60 * 1000, // 6 hours
  EXPIRED_CHECK: 5 * 60 * 1000, // 5 minutes
};

let tokenRefreshInterval: NodeJS.Timeout | null = null;
let scheduledSyncInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let expiredCheckInterval: NodeJS.Timeout | null = null;

/**
 * Start all background jobs
 */
export function startJobs(): void {
  log.info('Starting background jobs');

  // Token refresh job - every 15 minutes
  tokenRefreshInterval = setInterval(async () => {
    try {
      await runTokenRefreshJob();
    } catch (error) {
      log.error({ error }, 'Token refresh job error');
    }
  }, INTERVALS.TOKEN_REFRESH);

  // Expired token check - every 5 minutes
  expiredCheckInterval = setInterval(async () => {
    try {
      await markExpiredTokens();
    } catch (error) {
      log.error({ error }, 'Expired token check error');
    }
  }, INTERVALS.EXPIRED_CHECK);

  // Scheduled sync job - every hour
  scheduledSyncInterval = setInterval(async () => {
    try {
      await runScheduledSyncJob();
    } catch (error) {
      log.error({ error }, 'Scheduled sync job error');
    }
  }, INTERVALS.SCHEDULED_SYNC);

  // Health check job - every 6 hours
  healthCheckInterval = setInterval(async () => {
    try {
      await runHealthCheckJob();
    } catch (error) {
      log.error({ error }, 'Health check job error');
    }
  }, INTERVALS.HEALTH_CHECK);

  log.info('Background jobs started');
}

/**
 * Stop all background jobs
 */
export function stopJobs(): void {
  log.info('Stopping background jobs');

  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }

  if (expiredCheckInterval) {
    clearInterval(expiredCheckInterval);
    expiredCheckInterval = null;
  }

  if (scheduledSyncInterval) {
    clearInterval(scheduledSyncInterval);
    scheduledSyncInterval = null;
  }

  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  log.info('Background jobs stopped');
}

/**
 * Run a specific job immediately
 */
export async function runJob(jobName: string): Promise<void> {
  log.info({ job: jobName }, 'Running job manually');

  switch (jobName) {
    case 'token-refresh':
      await runTokenRefreshJob();
      break;
    case 'mark-expired':
      await markExpiredTokens();
      break;
    case 'scheduled-sync':
      await runScheduledSyncJob();
      break;
    case 'health-check':
      await runHealthCheckJob();
      break;
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}

export {
  runTokenRefreshJob,
  markExpiredTokens,
  runScheduledSyncJob,
  syncByIntegrationType,
  runHealthCheckJob,
  getHealthSummary,
};

export default {
  startJobs,
  stopJobs,
  runJob,
};
