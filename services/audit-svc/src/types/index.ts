/**
 * @module @skillancer/audit-svc/types
 * Type definitions for the audit logging system
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  PAYMENT = 'PAYMENT',
  CONTRACT = 'CONTRACT',
  COMPLIANCE = 'COMPLIANCE',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  SKILLPOD = 'SKILLPOD',
  COMMUNICATION = 'COMMUNICATION',
}

export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  SERVICE = 'SERVICE',
  ADMIN = 'ADMIN',
  ANONYMOUS = 'ANONYMOUS',
}

export enum OutcomeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
}

export enum RetentionPolicy {
  SHORT = 'SHORT',
  STANDARD = 'STANDARD',
  EXTENDED = 'EXTENDED',
  PERMANENT = 'PERMANENT',
}

export enum ExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum ExportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
}

export enum ComplianceTag {
  HIPAA = 'HIPAA',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  PII = 'PII',
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface AuditActor {
  id: string;
  type: ActorType;
  email?: string;
  displayName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  serviceId?: string;
  region?: string;
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
  tenantId?: string;
}

export interface AuditFieldChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  isSensitive?: boolean;
}

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: AuditFieldChange[];
}

export interface AuditRequest {
  method: string;
  path: string;
  ipAddress?: string;
  userAgent?: string;
  queryParams?: Record<string, string>;
  correlationId?: string;
}

export interface AuditOutcome {
  status: OutcomeStatus;
  errorCode?: string;
  errorMessage?: string;
  duration?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  eventCategory: AuditCategory;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  changes?: AuditChanges;
  request?: AuditRequest;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  complianceTags: ComplianceTag[];
  retentionPolicy: RetentionPolicy;
  integrityHash: string;
  previousHash?: string;
  serviceId: string;
}

export interface AuditLogParams {
  eventType: string;
  eventCategory?: AuditCategory;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  changes?: AuditChanges;
  request?: AuditRequest;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  complianceTags?: ComplianceTag[];
  retentionPolicy?: RetentionPolicy;
}

export interface AuditSearchFilters {
  eventType?: string;
  eventTypes?: string[];
  eventCategory?: AuditCategory;
  eventCategories?: AuditCategory[];
  actorId?: string;
  actorType?: ActorType;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  outcomeStatus?: OutcomeStatus;
  complianceTags?: string[];
  startDate?: Date;
  endDate?: Date;
  searchText?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditSearchOptions {
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface AuditSearchParams {
  filters: AuditSearchFilters;
  options?: AuditSearchOptions;
}

export interface AuditPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuditSearchResult {
  data: AuditLogEntry[];
  pagination: AuditPagination;
  filters: AuditSearchFilters;
}

export interface AuditTimelineEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  category: AuditCategory;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: OutcomeStatus;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserActivitySummary {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  mostActiveHours: number[];
  firstActivity?: Date;
  lastActivity?: Date;
}

export interface UserActivityTimeline {
  userId: string;
  events: AuditTimelineEvent[];
  summary: UserActivitySummary;
  generatedAt: Date;
}

export interface ResourceChange {
  timestamp: Date;
  action: string;
  actor: AuditActor;
  changes?: AuditChanges;
  outcome: OutcomeStatus;
}

export interface ResourceAuditTrail {
  resourceType: string;
  resourceId: string;
  changes: ResourceChange[];
  generatedAt: Date;
}

export interface AuditTimelineDay {
  date: string;
  count: number;
  categories: Record<string, number>;
}

export interface AuditTimelineSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueActors: number;
}

export interface AuditTimelineResult {
  days: AuditTimelineDay[];
  summary: AuditTimelineSummary;
}

export interface IntegrityVerificationResult {
  id: string;
  isValid: boolean;
  expectedHash: string;
  actualHash: string;
  timestamp: Date;
}

export interface UserTimelineOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface VerifyIntegrityOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface VerifyIntegrityResult {
  verified: number;
  failed: number;
  results: IntegrityVerificationResult[];
}

export interface AuditExport {
  id: string;
  status: ExportStatus;
  requestedBy: string;
  filters: Record<string, unknown>;
  format: ExportFormat;
  includeFields: string[];
  fileUrl?: string;
  fileSize?: number;
  recordCount?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface AuditExportJob {
  exportId: string;
  filters: AuditSearchFilters;
  format: ExportFormat;
}

export interface AuditDashboardStats {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByHour: Record<number, number>;
  topEventTypes: Array<{ eventType: string; count: number }>;
  anomalies: AuditAnomaly[];
  generatedAt: Date;
}

export interface AuditAnalytics {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  metricType: string;
  dimensions: Record<string, unknown>;
  value: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditBaseline {
  id: string;
  actorId: string;
  eventType: string;
  avgCount: number;
  stdDev: number;
  minCount: number;
  maxCount: number;
  sampleSize: number;
  calculatedAt: Date;
}

export interface AnalyticsSummary {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  eventsByHour: Array<{ hour: string; count: number }>;
  topEventTypes: Array<{ eventType: string; count: number }>;
  uniqueUsers: number;
  averageResponseTime?: number;
}

export interface AnalyticsSummaryParams {
  startDate: Date;
  endDate: Date;
  tenantId?: string;
}

export interface HourlyAggregationParams {
  startDate: Date;
  endDate: Date;
  eventCategory?: AuditCategory;
  eventType?: string;
  tenantId?: string;
}

export interface AnalyticsBaseline {
  eventType: string;
  avgEventsPerHour: number;
  stdDeviation: number;
}

export interface AuditAnomaly {
  id: string;
  detectedAt: Date;
  eventType: string;
  severity: AnomalySeverity;
  description: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  tenantId?: string;
}

export interface MaintenanceResult {
  archived: number;
  deleted: number;
  errors: string[];
}

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

export const AUDIT_EVENTS = {
  // Authentication
  USER_LOGIN: 'AUTH_LOGIN_SUCCESS',
  USER_LOGOUT: 'AUTH_LOGOUT',
  USER_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  MFA_ENABLED: 'AUTH_MFA_ENABLED',
  MFA_DISABLED: 'AUTH_MFA_DISABLED',
  TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',

  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  PROFILE_UPDATED: 'USER_PROFILE_UPDATED',
  EMAIL_CHANGED: 'USER_EMAIL_CHANGED',

  // Contracts
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
  CONTRACT_DISPUTED: 'CONTRACT_DISPUTED',
  MILESTONE_SUBMITTED: 'CONTRACT_MILESTONE_SUBMITTED',
  MILESTONE_APPROVED: 'CONTRACT_MILESTONE_APPROVED',

  // Payments
  PAYMENT_PROCESSED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYOUT_COMPLETED: 'PAYMENT_PAYOUT_COMPLETED',
  ESCROW_FUNDED: 'PAYMENT_ESCROW_FUNDED',
  ESCROW_RELEASED: 'PAYMENT_ESCROW_RELEASED',

  // Data
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_ACCESSED: 'DATA_VIEWED',
  SENSITIVE_DATA_ACCESSED: 'DATA_SENSITIVE_ACCESSED',

  // Permissions
  PERMISSION_CHANGED: 'AUTHZ_PERMISSION_GRANTED',
  ROLE_ASSIGNED: 'AUTHZ_ROLE_ASSIGNED',

  // Settings
  SETTINGS_CHANGED: 'SYSTEM_CONFIG_CHANGED',

  // Security
  SUSPICIOUS_LOGIN: 'SECURITY_SUSPICIOUS_LOGIN',
  BRUTE_FORCE_DETECTED: 'SECURITY_BRUTE_FORCE',
  FRAUD_DETECTED: 'SECURITY_FRAUD_DETECTED',

  // Admin/Cockpit
  ADMIN_IMPERSONATION: 'COCKPIT_IMPERSONATION_STARTED',
  SYSTEM_CONFIG_UPDATED: 'COCKPIT_SYSTEM_CONFIG_CHANGED',

  // Compliance
  GDPR_DATA_REQUEST: 'COMPLIANCE_GDPR_DATA_REQUEST',
  GDPR_DATA_DELETED: 'COMPLIANCE_GDPR_DATA_DELETED',
  CONSENT_GRANTED: 'COMPLIANCE_CONSENT_GRANTED',
  CONSENT_REVOKED: 'COMPLIANCE_CONSENT_REVOKED',
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];
