/**
 * PagerDuty integration for Skillancer
 *
 * Provides alert triggering, acknowledgment, and resolution via PagerDuty Events API v2
 */

import { event } from '@pagerduty/pdjs';

/** PagerDuty alert severity levels */
export type Severity = 'critical' | 'error' | 'warning' | 'info';

export interface PagerDutyConfig {
  /** PagerDuty Events API v2 routing key (integration key) */
  routingKey: string;
  /** Enable/disable PagerDuty integration */
  enabled?: boolean;
  /** Default source for alerts */
  defaultSource?: string;
  /** Environment name for alert context */
  environment?: string;
}

export interface AlertPayload {
  /** Brief summary of the alert (max 1024 characters) */
  summary: string;
  /** Alert severity */
  severity: Severity;
  /** Source of the alert (e.g., service name, hostname) */
  source: string;
  /** Component affected (e.g., database, api, cache) */
  component?: string;
  /** Logical grouping (e.g., infrastructure, application) */
  group?: string;
  /** Type of alert (e.g., metric-alert, error-rate) */
  class?: string;
  /** Additional details for the alert */
  customDetails?: Record<string, unknown>;
  /** Deduplication key for alert grouping */
  dedupKey?: string;
  /** Links to related resources */
  links?: Array<{ href: string; text: string }>;
  /** Images to include in the alert */
  images?: Array<{ src: string; href?: string; alt?: string }>;
}

export interface AlertResponse {
  /** The deduplication key for the alert */
  dedupKey: string;
  /** PagerDuty response status */
  status: string;
  /** PagerDuty response message */
  message: string;
}

let config: PagerDutyConfig | null = null;

/**
 * Initialize PagerDuty client
 */
export function initPagerDuty(cfg: PagerDutyConfig): void {
  config = cfg;
  console.log(`PagerDuty initialized (enabled: ${cfg.enabled !== false})`);
}

/**
 * Check if PagerDuty is configured and enabled
 */
export function isPagerDutyEnabled(): boolean {
  return config !== null && config.enabled !== false && !!config.routingKey;
}

/**
 * Trigger a new alert
 */
export async function triggerAlert(payload: AlertPayload): Promise<AlertResponse | null> {
  if (!isPagerDutyEnabled()) {
    console.log('PagerDuty disabled, would trigger:', payload.summary);
    return null;
  }

  try {
    // Build payload object, only including defined optional properties
    const pdPayload: {
      summary: string;
      severity: Severity;
      source: string;
      timestamp: string;
      component?: string;
      group?: string;
      class?: string;
      custom_details?: object;
    } = {
      summary: truncate(payload.summary, 1024),
      severity: payload.severity,
      source: payload.source || config!.defaultSource || 'skillancer',
      timestamp: new Date().toISOString(),
    };

    if (payload.component) {
      pdPayload.component = payload.component;
    }
    if (payload.group) {
      pdPayload.group = payload.group;
    }
    if (payload.class) {
      pdPayload.class = payload.class;
    }

    // Merge custom details with environment
    const customDetails: Record<string, unknown> = {};
    if (config!.environment) {
      customDetails['environment'] = config!.environment;
    }
    if (payload.customDetails) {
      Object.assign(customDetails, payload.customDetails);
    }
    if (Object.keys(customDetails).length > 0) {
      pdPayload.custom_details = customDetails;
    }

    // Build the event data
    const eventData: {
      routing_key: string;
      event_action: 'trigger';
      dedup_key?: string;
      payload: typeof pdPayload;
      links?: Array<{ href: string; text: string }>;
      images?: Array<{ src: string; href?: string; alt?: string }>;
    } = {
      routing_key: config!.routingKey,
      event_action: 'trigger',
      payload: pdPayload,
    };

    if (payload.dedupKey) {
      eventData.dedup_key = payload.dedupKey;
    }
    if (payload.links && payload.links.length > 0) {
      eventData.links = payload.links;
    }
    if (payload.images && payload.images.length > 0) {
      eventData.images = payload.images;
    }

    const response = await event({ data: eventData });

    const data = response.data as { dedup_key: string; status: string; message: string };

    console.log(`PagerDuty alert triggered: ${data.dedup_key}`);

    return {
      dedupKey: data.dedup_key,
      status: data.status,
      message: data.message,
    };
  } catch (error) {
    console.error('Failed to trigger PagerDuty alert:', error);
    return null;
  }
}

/**
 * Acknowledge an existing alert
 */
export async function acknowledgeAlert(dedupKey: string): Promise<boolean> {
  if (!isPagerDutyEnabled()) {
    console.log('PagerDuty disabled, would acknowledge:', dedupKey);
    return false;
  }

  try {
    // PagerDuty SDK requires payload even for acknowledge - use minimal payload
    await event({
      data: {
        routing_key: config!.routingKey,
        event_action: 'acknowledge',
        dedup_key: dedupKey,
        payload: {
          summary: `Acknowledging alert: ${dedupKey}`,
          source: config!.defaultSource || 'skillancer',
          severity: 'info',
        },
      },
    });

    console.log(`PagerDuty alert acknowledged: ${dedupKey}`);
    return true;
  } catch (error) {
    console.error('Failed to acknowledge PagerDuty alert:', error);
    return false;
  }
}

/**
 * Resolve an existing alert
 */
export async function resolveAlert(dedupKey: string): Promise<boolean> {
  if (!isPagerDutyEnabled()) {
    console.log('PagerDuty disabled, would resolve:', dedupKey);
    return false;
  }

  try {
    // PagerDuty SDK requires payload even for resolve - use minimal payload
    await event({
      data: {
        routing_key: config!.routingKey,
        event_action: 'resolve',
        dedup_key: dedupKey,
        payload: {
          summary: `Resolving alert: ${dedupKey}`,
          source: config!.defaultSource || 'skillancer',
          severity: 'info',
        },
      },
    });

    console.log(`PagerDuty alert resolved: ${dedupKey}`);
    return true;
  } catch (error) {
    console.error('Failed to resolve PagerDuty alert:', error);
    return false;
  }
}

/**
 * Create a standard deduplication key
 */
export function createDedupKey(parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]/g, '-'))
    .join('-');
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Convenience alert functions
// =============================================================================

/**
 * Trigger a critical alert
 */
export async function triggerCriticalAlert(
  summary: string,
  options: Omit<AlertPayload, 'summary' | 'severity'> = { source: 'skillancer' }
): Promise<AlertResponse | null> {
  return triggerAlert({
    ...options,
    summary,
    severity: 'critical',
    source: options.source || 'skillancer',
  });
}

/**
 * Trigger an error alert
 */
export async function triggerErrorAlert(
  summary: string,
  options: Omit<AlertPayload, 'summary' | 'severity'> = { source: 'skillancer' }
): Promise<AlertResponse | null> {
  return triggerAlert({
    ...options,
    summary,
    severity: 'error',
    source: options.source || 'skillancer',
  });
}

/**
 * Trigger a warning alert
 */
export async function triggerWarningAlert(
  summary: string,
  options: Omit<AlertPayload, 'summary' | 'severity'> = { source: 'skillancer' }
): Promise<AlertResponse | null> {
  return triggerAlert({
    ...options,
    summary,
    severity: 'warning',
    source: options.source || 'skillancer',
  });
}

/**
 * Trigger an info alert
 */
export async function triggerInfoAlert(
  summary: string,
  options: Omit<AlertPayload, 'summary' | 'severity'> = { source: 'skillancer' }
): Promise<AlertResponse | null> {
  return triggerAlert({
    ...options,
    summary,
    severity: 'info',
    source: options.source || 'skillancer',
  });
}

// =============================================================================
// Service-specific alerts
// =============================================================================

/**
 * Trigger a database alert
 */
export async function triggerDatabaseAlert(
  summary: string,
  severity: AlertPayload['severity'],
  details?: Record<string, unknown>
): Promise<AlertResponse | null> {
  const payload: AlertPayload = {
    summary,
    severity,
    source: config?.defaultSource || 'skillancer',
    component: 'database',
    group: 'infrastructure',
    class: 'database-alert',
    dedupKey: createDedupKey(['database', severity, summary.slice(0, 50)]),
  };
  if (details) {
    payload.customDetails = details;
  }
  return triggerAlert(payload);
}

/**
 * Trigger an API alert
 */
export async function triggerAPIAlert(
  summary: string,
  severity: AlertPayload['severity'],
  details?: Record<string, unknown>
): Promise<AlertResponse | null> {
  const payload: AlertPayload = {
    summary,
    severity,
    source: config?.defaultSource || 'skillancer',
    component: 'api',
    group: 'application',
    class: 'api-alert',
    dedupKey: createDedupKey(['api', severity, summary.slice(0, 50)]),
  };
  if (details) {
    payload.customDetails = details;
  }
  return triggerAlert(payload);
}

/**
 * Trigger a security alert
 */
export async function triggerSecurityAlert(
  summary: string,
  severity: AlertPayload['severity'],
  details?: Record<string, unknown>
): Promise<AlertResponse | null> {
  const payload: AlertPayload = {
    summary,
    severity,
    source: config?.defaultSource || 'skillancer',
    component: 'security',
    group: 'security',
    class: 'security-alert',
    dedupKey: createDedupKey(['security', severity, summary.slice(0, 50)]),
  };
  if (details) {
    payload.customDetails = details;
  }
  return triggerAlert(payload);
}
