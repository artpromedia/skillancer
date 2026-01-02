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
    // Moat Services
    {
      prefix: '/api/executive',
      upstream: config.services.executive,
      stripPrefix: true,
      timeout: 30000,
      retries: 2,
      auth: 'required',
      serviceName: 'executive',
      description: 'Executive Suite - high-value client engagements, dedicated workspaces, integration hub',
    },
    {
      prefix: '/api/financial',
      upstream: config.services.financial,
      stripPrefix: true,
      timeout: 60000, // Longer timeout for financial operations
      retries: 0, // No retries for financial operations
      auth: 'required',
      serviceName: 'financial',
      rateLimit: { max: 30, timeWindow: '1 minute' },
      description: 'Financial Services - Skillancer Cards, invoice financing, tax vault, business banking',
    },
    {
      prefix: '/api/talent-graph',
      upstream: config.services.talentGraph,
      stripPrefix: true,
      timeout: 30000,
      retries: 2,
      auth: 'required',
      serviceName: 'talent-graph',
      description: 'Talent Graph - work relationships, warm introductions, team reunions',
    },
    {
      prefix: '/api/intelligence',
      upstream: config.services.intelligence,
      stripPrefix: true,
      timeout: 45000, // Longer for ML predictions
      retries: 1,
      auth: 'required',
      serviceName: 'intelligence',
      description: 'Outcome Intelligence - engagement outcomes, success predictions, risk alerts, benchmarks',
    },
    {
      prefix: '/api/copilot',
      upstream: config.services.copilot,
      stripPrefix: true,
      timeout: 60000, // Longer for AI operations
      retries: 1,
      auth: 'required',
      serviceName: 'copilot',
      rateLimit: { max: 50, timeWindow: '1 minute' },
      description: 'AI Copilot - proposal drafts, rate suggestions, profile optimization, market insights',
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
