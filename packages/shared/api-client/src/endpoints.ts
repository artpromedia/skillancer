/**
 * @skillancer/shared-api-client - Endpoints
 * Type-safe endpoint definitions for all backend services
 */

// =============================================================================
// Environment Configuration
// =============================================================================

/**
 * Supported deployment environments
 */
export type Environment = 'development' | 'staging' | 'production' | 'local';

/**
 * Service base URL configuration per environment
 */
export interface EnvironmentConfig {
  /** API Gateway URL */
  apiGateway: string;
  /** Auth service URL */
  auth: string;
  /** Market service URL */
  market: string;
  /** SkillPod service URL */
  skillpod: string;
  /** Cockpit service URL */
  cockpit: string;
  /** Billing service URL */
  billing: string;
  /** Notification service URL */
  notification: string;
  /** Intelligence API URL */
  intelligence: string;
  /** WebSocket URL */
  websocket: string;
}

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  local: {
    apiGateway: 'http://localhost:3001',
    auth: 'http://localhost:3002',
    market: 'http://localhost:3003',
    skillpod: 'http://localhost:3004',
    cockpit: 'http://localhost:3005',
    billing: 'http://localhost:3006',
    notification: 'http://localhost:3007',
    intelligence: 'http://localhost:3008',
    websocket: 'ws://localhost:3001/ws',
  },
  development: {
    apiGateway: 'https://api-dev.skillancer.com',
    auth: 'https://auth-dev.skillancer.com',
    market: 'https://market-dev.skillancer.com',
    skillpod: 'https://skillpod-dev.skillancer.com',
    cockpit: 'https://cockpit-dev.skillancer.com',
    billing: 'https://billing-dev.skillancer.com',
    notification: 'https://notification-dev.skillancer.com',
    intelligence: 'https://intelligence-dev.skillancer.com',
    websocket: 'wss://api-dev.skillancer.com/ws',
  },
  staging: {
    apiGateway: 'https://api-staging.skillancer.com',
    auth: 'https://auth-staging.skillancer.com',
    market: 'https://market-staging.skillancer.com',
    skillpod: 'https://skillpod-staging.skillancer.com',
    cockpit: 'https://cockpit-staging.skillancer.com',
    billing: 'https://billing-staging.skillancer.com',
    notification: 'https://notification-staging.skillancer.com',
    intelligence: 'https://intelligence-staging.skillancer.com',
    websocket: 'wss://api-staging.skillancer.com/ws',
  },
  production: {
    apiGateway: 'https://api.skillancer.com',
    auth: 'https://auth.skillancer.com',
    market: 'https://market.skillancer.com',
    skillpod: 'https://skillpod.skillancer.com',
    cockpit: 'https://cockpit.skillancer.com',
    billing: 'https://billing.skillancer.com',
    notification: 'https://notification.skillancer.com',
    intelligence: 'https://intelligence.skillancer.com',
    websocket: 'wss://api.skillancer.com/ws',
  },
};

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(env?: Environment): EnvironmentConfig {
  const environment = env ?? detectEnvironment();
  return ENVIRONMENT_CONFIGS[environment];
}

/**
 * Detect current environment from environment variables
 */
export function detectEnvironment(): Environment {
  const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const appEnv =
    typeof process !== 'undefined'
      ? process.env?.NEXT_PUBLIC_APP_ENV || process.env?.APP_ENV
      : undefined;

  if (appEnv === 'production' || nodeEnv === 'production') return 'production';
  if (appEnv === 'staging') return 'staging';
  if (appEnv === 'development' || nodeEnv === 'development') return 'development';
  return 'local';
}

// =============================================================================
// Service Identifiers
// =============================================================================

/**
 * Available backend services
 */
export type ServiceName =
  | 'auth'
  | 'market'
  | 'skillpod'
  | 'cockpit'
  | 'billing'
  | 'notification'
  | 'intelligence';

/**
 * Get base URL for a specific service
 */
export function getServiceUrl(service: ServiceName, env?: Environment): string {
  const config = getEnvironmentConfig(env);
  return config[service];
}

// =============================================================================
// Endpoint Definitions
// =============================================================================

/**
 * Auth Service Endpoints
 */
export const AUTH_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REGISTER: '/auth/register',
  REFRESH_TOKEN: '/auth/refresh',
  VERIFY_EMAIL: '/auth/verify-email',
  RESEND_VERIFICATION: '/auth/resend-verification',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  CHANGE_PASSWORD: '/auth/change-password',

  // MFA
  ENABLE_MFA: '/auth/mfa/enable',
  DISABLE_MFA: '/auth/mfa/disable',
  VERIFY_MFA: '/auth/mfa/verify',
  MFA_RECOVERY_CODES: '/auth/mfa/recovery-codes',

  // Sessions
  SESSIONS: '/auth/sessions',
  SESSION_BY_ID: (id: string) => `/auth/sessions/${id}`,
  REVOKE_SESSION: (id: string) => `/auth/sessions/${id}/revoke`,
  REVOKE_ALL_SESSIONS: '/auth/sessions/revoke-all',

  // OAuth
  OAUTH_AUTHORIZE: (provider: string) => `/auth/oauth/${provider}`,
  OAUTH_CALLBACK: (provider: string) => `/auth/oauth/${provider}/callback`,
  OAUTH_LINK: (provider: string) => `/auth/oauth/${provider}/link`,
  OAUTH_UNLINK: (provider: string) => `/auth/oauth/${provider}/unlink`,

  // User Profile (basic)
  PROFILE: '/auth/profile',
  UPDATE_PROFILE: '/auth/profile',
} as const;

/**
 * Market Service Endpoints
 */
export const MARKET_ENDPOINTS = {
  // Jobs
  JOBS: '/jobs',
  JOB_BY_ID: (id: string) => `/jobs/${id}`,
  JOB_SEARCH: '/jobs/search',
  MY_JOBS: '/jobs/mine',
  FEATURED_JOBS: '/jobs/featured',
  RECOMMENDED_JOBS: '/jobs/recommended',

  // Proposals
  PROPOSALS: '/proposals',
  PROPOSAL_BY_ID: (id: string) => `/proposals/${id}`,
  JOB_PROPOSALS: (jobId: string) => `/jobs/${jobId}/proposals`,
  MY_PROPOSALS: '/proposals/mine',
  WITHDRAW_PROPOSAL: (id: string) => `/proposals/${id}/withdraw`,
  ACCEPT_PROPOSAL: (id: string) => `/proposals/${id}/accept`,
  REJECT_PROPOSAL: (id: string) => `/proposals/${id}/reject`,

  // Contracts
  CONTRACTS: '/contracts',
  CONTRACT_BY_ID: (id: string) => `/contracts/${id}`,
  MY_CONTRACTS: '/contracts/mine',
  CONTRACT_MILESTONES: (contractId: string) => `/contracts/${contractId}/milestones`,
  COMPLETE_MILESTONE: (contractId: string, milestoneId: string) =>
    `/contracts/${contractId}/milestones/${milestoneId}/complete`,
  APPROVE_MILESTONE: (contractId: string, milestoneId: string) =>
    `/contracts/${contractId}/milestones/${milestoneId}/approve`,
  REQUEST_REVISION: (contractId: string, milestoneId: string) =>
    `/contracts/${contractId}/milestones/${milestoneId}/revision`,

  // Services (Seller Offerings)
  SERVICES: '/services',
  SERVICE_BY_ID: (id: string) => `/services/${id}`,
  MY_SERVICES: '/services/mine',
  SERVICE_PACKAGES: (serviceId: string) => `/services/${serviceId}/packages`,

  // Reviews
  REVIEWS: '/reviews',
  REVIEW_BY_ID: (id: string) => `/reviews/${id}`,
  USER_REVIEWS: (userId: string) => `/users/${userId}/reviews`,
  CONTRACT_REVIEWS: (contractId: string) => `/contracts/${contractId}/reviews`,

  // Categories & Skills
  CATEGORIES: '/categories',
  CATEGORY_BY_ID: (id: string) => `/categories/${id}`,
  SKILLS: '/skills',
  SKILL_BY_ID: (id: string) => `/skills/${id}`,
  POPULAR_SKILLS: '/skills/popular',

  // Freelancer Search
  FREELANCERS: '/freelancers',
  FREELANCER_BY_ID: (id: string) => `/freelancers/${id}`,
  FREELANCER_SEARCH: '/freelancers/search',
  TOP_FREELANCERS: '/freelancers/top',
} as const;

/**
 * SkillPod Service Endpoints
 */
export const SKILLPOD_ENDPOINTS = {
  // Pods (Virtual Desktops)
  PODS: '/pods',
  POD_BY_ID: (id: string) => `/pods/${id}`,
  MY_PODS: '/pods/mine',
  CREATE_POD: '/pods',
  START_POD: (id: string) => `/pods/${id}/start`,
  STOP_POD: (id: string) => `/pods/${id}/stop`,
  RESTART_POD: (id: string) => `/pods/${id}/restart`,
  DELETE_POD: (id: string) => `/pods/${id}`,
  POD_STATUS: (id: string) => `/pods/${id}/status`,
  POD_METRICS: (id: string) => `/pods/${id}/metrics`,
  POD_LOGS: (id: string) => `/pods/${id}/logs`,

  // Pod Sessions
  POD_SESSIONS: (podId: string) => `/pods/${podId}/sessions`,
  ACTIVE_SESSION: (podId: string) => `/pods/${podId}/sessions/active`,
  END_SESSION: (podId: string) => `/pods/${podId}/sessions/end`,

  // Pod Templates
  TEMPLATES: '/templates',
  TEMPLATE_BY_ID: (id: string) => `/templates/${id}`,
  PUBLIC_TEMPLATES: '/templates/public',

  // Credentials
  CREDENTIALS: '/credentials',
  CREDENTIAL_BY_ID: (id: string) => `/credentials/${id}`,
  VERIFY_CREDENTIAL: (id: string) => `/credentials/${id}/verify`,
  ISSUE_CREDENTIAL: '/credentials/issue',

  // Activity Tracking
  ACTIVITIES: '/activities',
  ACTIVITY_SUMMARY: '/activities/summary',
  TIME_TRACKING: '/activities/time',
} as const;

/**
 * Cockpit Service Endpoints
 */
export const COCKPIT_ENDPOINTS = {
  // Dashboard
  DASHBOARD: '/dashboard',
  DASHBOARD_STATS: '/dashboard/stats',
  DASHBOARD_REVENUE: '/dashboard/revenue',
  DASHBOARD_ACTIVITY: '/dashboard/activity',

  // Clients
  CLIENTS: '/clients',
  CLIENT_BY_ID: (id: string) => `/clients/${id}`,
  CLIENT_CONTRACTS: (clientId: string) => `/clients/${clientId}/contracts`,
  CLIENT_INVOICES: (clientId: string) => `/clients/${clientId}/invoices`,
  CLIENT_COMMUNICATIONS: (clientId: string) => `/clients/${clientId}/communications`,

  // Calendar
  CALENDAR_EVENTS: '/calendar/events',
  CALENDAR_EVENT_BY_ID: (id: string) => `/calendar/events/${id}`,
  CALENDAR_AVAILABILITY: '/calendar/availability',
  CALENDAR_SYNC: '/calendar/sync',

  // Team (for agencies)
  TEAM_MEMBERS: '/team/members',
  TEAM_MEMBER_BY_ID: (id: string) => `/team/members/${id}`,
  TEAM_INVITES: '/team/invites',
  TEAM_ROLES: '/team/roles',

  // Reports
  REPORTS: '/reports',
  REPORT_BY_ID: (id: string) => `/reports/${id}`,
  GENERATE_REPORT: '/reports/generate',
  EARNINGS_REPORT: '/reports/earnings',
  TAX_REPORT: '/reports/tax',

  // Goals & OKRs
  GOALS: '/goals',
  GOAL_BY_ID: (id: string) => `/goals/${id}`,
  GOAL_PROGRESS: (id: string) => `/goals/${id}/progress`,

  // Alerts
  ALERTS: '/alerts',
  ALERT_BY_ID: (id: string) => `/alerts/${id}`,
  DISMISS_ALERT: (id: string) => `/alerts/${id}/dismiss`,
  ALERT_SETTINGS: '/alerts/settings',
} as const;

/**
 * Billing Service Endpoints
 */
export const BILLING_ENDPOINTS = {
  // Payment Methods
  PAYMENT_METHODS: '/payment-methods',
  PAYMENT_METHOD_BY_ID: (id: string) => `/payment-methods/${id}`,
  SET_DEFAULT_PAYMENT: (id: string) => `/payment-methods/${id}/default`,
  ADD_CARD: '/payment-methods/cards',
  ADD_BANK_ACCOUNT: '/payment-methods/bank-accounts',

  // Wallet
  WALLET: '/wallet',
  WALLET_BALANCE: '/wallet/balance',
  WALLET_TRANSACTIONS: '/wallet/transactions',
  WITHDRAW: '/wallet/withdraw',
  DEPOSIT: '/wallet/deposit',

  // Invoices
  INVOICES: '/invoices',
  INVOICE_BY_ID: (id: string) => `/invoices/${id}`,
  CREATE_INVOICE: '/invoices',
  SEND_INVOICE: (id: string) => `/invoices/${id}/send`,
  PAY_INVOICE: (id: string) => `/invoices/${id}/pay`,
  INVOICE_PDF: (id: string) => `/invoices/${id}/pdf`,

  // Subscriptions
  SUBSCRIPTIONS: '/subscriptions',
  SUBSCRIPTION_BY_ID: (id: string) => `/subscriptions/${id}`,
  SUBSCRIBE: '/subscriptions',
  CANCEL_SUBSCRIPTION: (id: string) => `/subscriptions/${id}/cancel`,
  UPDATE_SUBSCRIPTION: (id: string) => `/subscriptions/${id}`,
  SUBSCRIPTION_PLANS: '/subscriptions/plans',

  // Escrow
  ESCROW: '/escrow',
  ESCROW_BY_ID: (id: string) => `/escrow/${id}`,
  FUND_ESCROW: (id: string) => `/escrow/${id}/fund`,
  RELEASE_ESCROW: (id: string) => `/escrow/${id}/release`,
  DISPUTE_ESCROW: (id: string) => `/escrow/${id}/dispute`,

  // Tax
  TAX_INFO: '/tax/info',
  TAX_DOCUMENTS: '/tax/documents',
  SUBMIT_W9: '/tax/w9',
  SUBMIT_W8: '/tax/w8',
} as const;

/**
 * Notification Service Endpoints
 */
export const NOTIFICATION_ENDPOINTS = {
  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_BY_ID: (id: string) => `/notifications/${id}`,
  UNREAD_COUNT: '/notifications/unread-count',
  MARK_AS_READ: (id: string) => `/notifications/${id}/read`,
  MARK_ALL_READ: '/notifications/read-all',

  // Preferences
  PREFERENCES: '/notifications/preferences',
  UPDATE_PREFERENCES: '/notifications/preferences',

  // Push Notifications
  REGISTER_DEVICE: '/notifications/devices',
  UNREGISTER_DEVICE: (deviceId: string) => `/notifications/devices/${deviceId}`,

  // Email
  EMAIL_SETTINGS: '/notifications/email',
  UNSUBSCRIBE: '/notifications/email/unsubscribe',
} as const;

/**
 * Intelligence Service Endpoints (AI/ML)
 */
export const INTELLIGENCE_ENDPOINTS = {
  // Job Matching
  MATCH_JOBS: '/intelligence/jobs/match',
  JOB_RECOMMENDATIONS: '/intelligence/jobs/recommendations',

  // Freelancer Matching
  MATCH_FREELANCERS: '/intelligence/freelancers/match',
  FREELANCER_RECOMMENDATIONS: '/intelligence/freelancers/recommendations',

  // Pricing
  SUGGESTED_PRICE: '/intelligence/pricing/suggest',
  MARKET_RATES: '/intelligence/pricing/market-rates',

  // Content
  GENERATE_PROPOSAL: '/intelligence/content/proposal',
  GENERATE_JOB_DESCRIPTION: '/intelligence/content/job-description',
  IMPROVE_PROFILE: '/intelligence/content/profile',

  // Analytics
  PREDICT_SUCCESS: '/intelligence/analytics/predict-success',
  SKILL_GAP_ANALYSIS: '/intelligence/analytics/skill-gap',
} as const;

// =============================================================================
// Endpoint Builders
// =============================================================================

/**
 * Build full URL for an endpoint
 */
export function buildUrl(
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  let url = `${baseUrl}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return url;
}

/**
 * Create type-safe endpoint builder for a service
 */
export function createEndpointBuilder(baseUrl: string) {
  return {
    build: (endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
      buildUrl(baseUrl, endpoint, params),
    auth: (endpoint: keyof typeof AUTH_ENDPOINTS | string) => {
      const path = typeof endpoint === 'string' && endpoint in AUTH_ENDPOINTS
        ? AUTH_ENDPOINTS[endpoint as keyof typeof AUTH_ENDPOINTS]
        : endpoint;
      return `${baseUrl}${typeof path === 'function' ? '' : path}`;
    },
    market: (endpoint: keyof typeof MARKET_ENDPOINTS | string) => {
      const path = typeof endpoint === 'string' && endpoint in MARKET_ENDPOINTS
        ? MARKET_ENDPOINTS[endpoint as keyof typeof MARKET_ENDPOINTS]
        : endpoint;
      return `${baseUrl}${typeof path === 'function' ? '' : path}`;
    },
  };
}

// =============================================================================
// All Endpoints Export
// =============================================================================

/**
 * All endpoint definitions grouped by service
 */
export const ENDPOINTS = {
  auth: AUTH_ENDPOINTS,
  market: MARKET_ENDPOINTS,
  skillpod: SKILLPOD_ENDPOINTS,
  cockpit: COCKPIT_ENDPOINTS,
  billing: BILLING_ENDPOINTS,
  notification: NOTIFICATION_ENDPOINTS,
  intelligence: INTELLIGENCE_ENDPOINTS,
} as const;

export type Endpoints = typeof ENDPOINTS;
