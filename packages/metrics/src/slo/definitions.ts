/**
 * @fileoverview Default SLO Definitions for Skillancer Platform
 *
 * Pre-configured SLOs for core services including:
 * - Availability SLOs (99.9% uptime)
 * - Latency SLOs (P95 < 500ms)
 * - Business SLOs (payment success, video streaming)
 */

import type { SLODefinition } from './types.js';

/**
 * SkillPod Service SLOs
 */
export const skillpodSLOs: SLODefinition[] = [
  {
    id: 'skillpod-availability',
    name: 'SkillPod Availability',
    description: 'Percentage of successful requests to SkillPod API',
    service: 'skillpod',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(http_requests_total{service="skillpod",status_code!~"5.."}[5m]))',
      totalQuery: 'sum(rate(http_requests_total{service="skillpod"}[5m]))',
    },
    target: 99.9,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'high' },
      },
    },
    owner: 'platform-team',
    tags: ['core', 'api', 'availability'],
  },
  {
    id: 'skillpod-latency',
    name: 'SkillPod Latency',
    description: '95% of SkillPod API requests complete within 500ms',
    service: 'skillpod',
    sli: {
      type: 'latency',
      query: '',
      goodQuery:
        'sum(rate(http_request_duration_seconds_bucket{service="skillpod",le="0.5"}[5m]))',
      totalQuery:
        'sum(rate(http_request_duration_seconds_count{service="skillpod"}[5m]))',
    },
    target: 95,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'high' },
        slow: { window: '6h', burnRate: 6, severity: 'medium' },
      },
    },
    owner: 'platform-team',
    tags: ['performance', 'api', 'latency'],
  },
  {
    id: 'video-streaming',
    name: 'Video Streaming Availability',
    description: 'Percentage of successful video stream starts',
    service: 'skillpod',
    sli: {
      type: 'availability',
      query: '',
      goodQuery: 'sum(rate(video_stream_starts_total{status="success"}[5m]))',
      totalQuery: 'sum(rate(video_stream_starts_total[5m]))',
    },
    target: 99.5,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'high' },
        slow: { window: '6h', burnRate: 6, severity: 'medium' },
      },
    },
    owner: 'skillpod-team',
    tags: ['business', 'streaming', 'video'],
  },
];

/**
 * Market Service SLOs
 */
export const marketSLOs: SLODefinition[] = [
  {
    id: 'market-availability',
    name: 'Market Availability',
    description: 'Percentage of successful requests to Market API',
    service: 'market',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(http_requests_total{service="market",status_code!~"5.."}[5m]))',
      totalQuery: 'sum(rate(http_requests_total{service="market"}[5m]))',
    },
    target: 99.9,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'high' },
      },
    },
    owner: 'platform-team',
    tags: ['core', 'api', 'availability'],
  },
  {
    id: 'market-latency',
    name: 'Market Latency',
    description: '95% of Market API requests complete within 500ms',
    service: 'market',
    sli: {
      type: 'latency',
      query: '',
      goodQuery:
        'sum(rate(http_request_duration_seconds_bucket{service="market",le="0.5"}[5m]))',
      totalQuery:
        'sum(rate(http_request_duration_seconds_count{service="market"}[5m]))',
    },
    target: 95,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'high' },
        slow: { window: '6h', burnRate: 6, severity: 'medium' },
      },
    },
    owner: 'platform-team',
    tags: ['performance', 'api', 'latency'],
  },
  {
    id: 'market-search',
    name: 'Market Search Latency',
    description: '95% of search requests complete within 1s',
    service: 'market',
    sli: {
      type: 'latency',
      query: '',
      goodQuery:
        'sum(rate(http_request_duration_seconds_bucket{service="market",path="/api/search",le="1.0"}[5m]))',
      totalQuery:
        'sum(rate(http_request_duration_seconds_count{service="market",path="/api/search"}[5m]))',
    },
    target: 95,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'medium' },
        slow: { window: '6h', burnRate: 6, severity: 'low' },
      },
    },
    owner: 'market-team',
    tags: ['performance', 'search'],
  },
];

/**
 * Cockpit Service SLOs
 */
export const cockpitSLOs: SLODefinition[] = [
  {
    id: 'cockpit-availability',
    name: 'Cockpit Availability',
    description: 'Percentage of successful requests to Cockpit API',
    service: 'cockpit',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(http_requests_total{service="cockpit",status_code!~"5.."}[5m]))',
      totalQuery: 'sum(rate(http_requests_total{service="cockpit"}[5m]))',
    },
    target: 99.9,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'high' },
      },
    },
    owner: 'platform-team',
    tags: ['core', 'api', 'availability'],
  },
  {
    id: 'cockpit-latency',
    name: 'Cockpit Latency',
    description: '95% of Cockpit API requests complete within 500ms',
    service: 'cockpit',
    sli: {
      type: 'latency',
      query: '',
      goodQuery:
        'sum(rate(http_request_duration_seconds_bucket{service="cockpit",le="0.5"}[5m]))',
      totalQuery:
        'sum(rate(http_request_duration_seconds_count{service="cockpit"}[5m]))',
    },
    target: 95,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'high' },
        slow: { window: '6h', burnRate: 6, severity: 'medium' },
      },
    },
    owner: 'platform-team',
    tags: ['performance', 'api', 'latency'],
  },
];

/**
 * Payment/Business SLOs
 */
export const paymentSLOs: SLODefinition[] = [
  {
    id: 'payment-success',
    name: 'Payment Success Rate',
    description: 'Percentage of successful payment transactions',
    service: 'billing',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(business_events_total{event_type="payment_process",status="success"}[5m]))',
      totalQuery:
        'sum(rate(business_events_total{event_type="payment_process"}[5m]))',
    },
    target: 99.5,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'critical' },
      },
    },
    owner: 'payments-team',
    tags: ['business', 'payments', 'critical'],
  },
  {
    id: 'payout-success',
    name: 'Payout Success Rate',
    description: 'Percentage of successful payout transactions',
    service: 'billing',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(business_events_total{event_type="payout_process",status="success"}[5m]))',
      totalQuery:
        'sum(rate(business_events_total{event_type="payout_process"}[5m]))',
    },
    target: 99.5,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'critical' },
      },
    },
    owner: 'payments-team',
    tags: ['business', 'payments', 'critical'],
  },
];

/**
 * Authentication SLOs
 */
export const authSLOs: SLODefinition[] = [
  {
    id: 'auth-availability',
    name: 'Auth Service Availability',
    description: 'Percentage of successful authentication requests',
    service: 'auth',
    sli: {
      type: 'availability',
      query: '',
      goodQuery:
        'sum(rate(http_requests_total{service="auth",status_code!~"5.."}[5m]))',
      totalQuery: 'sum(rate(http_requests_total{service="auth"}[5m]))',
    },
    target: 99.95,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'critical' },
        slow: { window: '6h', burnRate: 6, severity: 'critical' },
      },
    },
    owner: 'platform-team',
    tags: ['core', 'auth', 'critical'],
  },
  {
    id: 'auth-latency',
    name: 'Auth Latency',
    description: '99% of auth requests complete within 200ms',
    service: 'auth',
    sli: {
      type: 'latency',
      query: '',
      goodQuery:
        'sum(rate(http_request_duration_seconds_bucket{service="auth",le="0.2"}[5m]))',
      totalQuery:
        'sum(rate(http_request_duration_seconds_count{service="auth"}[5m]))',
    },
    target: 99,
    window: { type: 'rolling', duration: '30d' },
    errorBudget: {
      burnRateAlerts: {
        fast: { window: '1h', burnRate: 14.4, severity: 'high' },
        slow: { window: '6h', burnRate: 6, severity: 'medium' },
      },
    },
    owner: 'platform-team',
    tags: ['performance', 'auth'],
  },
];

/**
 * All default SLO definitions
 */
export const defaultSLODefinitions: SLODefinition[] = [
  ...skillpodSLOs,
  ...marketSLOs,
  ...cockpitSLOs,
  ...paymentSLOs,
  ...authSLOs,
];

/**
 * Get SLO definitions by service
 */
export function getSLOsByService(service: string): SLODefinition[] {
  return defaultSLODefinitions.filter((slo) => slo.service === service);
}

/**
 * Get SLO definitions by tag
 */
export function getSLOsByTag(tag: string): SLODefinition[] {
  return defaultSLODefinitions.filter((slo) => slo.tags.includes(tag));
}

/**
 * Get critical SLOs
 */
export function getCriticalSLOs(): SLODefinition[] {
  return defaultSLODefinitions.filter((slo) => slo.tags.includes('critical'));
}
