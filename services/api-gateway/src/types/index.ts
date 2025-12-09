/**
 * @module @skillancer/api-gateway/types
 * Type definitions for the API Gateway
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

// Re-export config types
export type { GatewayConfig } from '../config/index.js';
export type { ServiceRoute, AuthMode } from '../config/routes.js';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string;
  tenantId?: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user attached to request
 * Note: The actual FastifyRequest augmentation is in plugins/auth.ts
 */
export interface AuthUser {
  userId: string;
  tenantId?: string;
  email?: string;
  role?: string;
}

/**
 * Request context for downstream services
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  startTime: number;
}

/**
 * Proxy options for downstream requests
 */
export interface ProxyOptions {
  timeout?: number;
  serviceName: string;
  retries?: number;
}

/**
 * Service response wrapper
 */
export interface ServiceResponse<T = unknown> {
  data: T;
  meta?: {
    requestId: string;
    duration: number;
    service: string;
  };
}

/**
 * Aggregation result for BFF endpoints
 */
export interface AggregationResult<T extends Record<string, unknown>> {
  data: T;
  errors?: Array<{
    source: string;
    message: string;
    code?: string;
  }>;
  partial: boolean;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services?: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime?: number;
    error?: string;
  }>;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker stats
 */
export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  requestId?: string;
}

/**
 * Prehandler function type
 */
export type PreHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

/**
 * Dashboard data structure (BFF response)
 */
export interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    subscription?: {
      plan: string;
      status: string;
      expiresAt?: string;
    };
  } | null;
  stats: {
    activeJobs: number;
    pendingApplications: number;
    totalEarnings: number;
    completedProjects: number;
  } | null;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    message: string;
    read: boolean;
    createdAt: string;
  }>;
}

/**
 * Market overview data structure (BFF response)
 */
export interface MarketOverviewData {
  featuredJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    salary?: {
      min: number;
      max: number;
      currency: string;
    };
    skills: string[];
    postedAt: string;
  }>;
  trendingServices: Array<{
    id: string;
    name: string;
    category: string;
    averagePrice: number;
    demand: 'low' | 'medium' | 'high';
  }>;
  categories: Array<{
    id: string;
    name: string;
    jobCount: number;
    icon?: string;
  }>;
  recommendations: Array<{
    id: string;
    type: 'job' | 'service' | 'skill';
    title: string;
    reason: string;
    score: number;
  }>;
}

// Note: FastifyRequest and @fastify/jwt augmentations are defined in plugins/auth.ts
