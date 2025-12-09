/**
 * @module @skillancer/api-gateway/config/routes
 * Service route configuration for the API Gateway
 */

import { getConfig } from './index.js';

// ============================================================================
// TYPES
// ============================================================================

export type AuthMode = 'required' | 'optional' | 'none';

export interface RateLimitConfig {
  max: number;
  timeWindow: string;
}

export interface ServiceRoute {
  /** URL prefix to match incoming requests */
  prefix: string;
  /** Upstream service URL */
  upstream: string;
  /** Whether to strip the prefix when forwarding (default: true) */
  stripPrefix?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Authentication requirement */
  auth: AuthMode;
  /** Route-specific rate limiting */
  rateLimit?: RateLimitConfig;
  /** Service name for circuit breaker */
  serviceName: string;
  /** Description for documentation */
  description?: string;
}

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

/**
 * Get service routes configuration
 * Uses config values for upstream URLs
 */
export function getServiceRoutes(): ServiceRoute[] {
  const config = getConfig();

  return [
    {
      prefix: '/api/auth',
      upstream: config.services.auth,
      stripPrefix: false,
      timeout: 10000,
      retries: 1,
      auth: 'none',
      serviceName: 'auth',
      rateLimit: { max: 20, timeWindow: '1 minute' },
      description: 'Authentication service - login, register, token refresh',
    },
    {
      prefix: '/api/market',
      upstream: config.services.market,
      stripPrefix: true,
      timeout: 30000,
      retries: 2,
      auth: 'optional',
      serviceName: 'market',
      description: 'Marketplace service - jobs, services, freelancers',
    },
    {
      prefix: '/api/skillpod',
      upstream: config.services.skillpod,
      stripPrefix: true,
      timeout: 30000,
      retries: 2,
      auth: 'required',
      serviceName: 'skillpod',
      description: 'SkillPod service - learning, assessments, credentials',
    },
    {
      prefix: '/api/cockpit',
      upstream: config.services.cockpit,
      stripPrefix: true,
      timeout: 30000,
      retries: 2,
      auth: 'required',
      serviceName: 'cockpit',
      description: 'Business cockpit - analytics, team management',
    },
    {
      prefix: '/api/billing',
      upstream: config.services.billing,
      stripPrefix: true,
      timeout: 60000, // Longer timeout for payment operations
      retries: 0, // No retries for payment operations
      auth: 'required',
      serviceName: 'billing',
      rateLimit: { max: 30, timeWindow: '1 minute' },
      description: 'Billing service - payments, invoices, subscriptions',
    },
    {
      prefix: '/api/notifications',
      upstream: config.services.notification,
      stripPrefix: true,
      timeout: 15000,
      retries: 1,
      auth: 'required',
      serviceName: 'notification',
      description: 'Notification service - alerts, messages',
    },
  ];
}

/**
 * Get a service route by service name
 */
export function getServiceRoute(serviceName: string): ServiceRoute | undefined {
  return getServiceRoutes().find((route) => route.serviceName === serviceName);
}

/**
 * Get upstream URL for a service
 */
export function getServiceUrl(serviceName: string): string | undefined {
  const route = getServiceRoute(serviceName);
  return route?.upstream;
}
