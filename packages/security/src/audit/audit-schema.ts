/**
 * Security Event Schema
 *
 * Comprehensive type definitions for security events, audit logging,
 * data classification, PII categories, and consent management.
 */

import { z } from 'zod';

// ==================== Security Event Types ====================

export type SecurityEventCategory =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'admin_action'
  | 'security_alert'
  | 'compliance'
  | 'system';

export type SecurityEventType =
  // Authentication Events
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_challenge_success'
  | 'mfa_challenge_failure'
  | 'session_created'
  | 'session_expired'
  | 'session_revoked'
  | 'token_issued'
  | 'token_revoked'
  | 'oauth_authorize'
  | 'oauth_token_grant'
  | 'oauth_token_revoke'

  // Authorization Events
  | 'permission_granted'
  | 'permission_denied'
  | 'role_assigned'
  | 'role_removed'
  | 'access_denied'
  | 'rate_limit_exceeded'
  | 'ip_blocked'
  | 'ip_unblocked'

  // Data Access Events
  | 'data_viewed'
  | 'data_exported'
  | 'data_downloaded'
  | 'pii_accessed'
  | 'financial_data_accessed'
  | 'bulk_data_access'
  | 'api_key_used'

  // Data Modification Events
  | 'data_created'
  | 'data_updated'
  | 'data_deleted'
  | 'data_restored'
  | 'pii_modified'
  | 'account_created'
  | 'account_updated'
  | 'account_deleted'
  | 'account_suspended'
  | 'account_reactivated'

  // Admin Actions
  | 'admin_login'
  | 'admin_action'
  | 'config_changed'
  | 'feature_flag_changed'
  | 'user_impersonation_start'
  | 'user_impersonation_end'
  | 'bulk_operation'

  // Security Alerts
  | 'suspicious_activity'
  | 'brute_force_detected'
  | 'credential_stuffing_detected'
  | 'account_takeover_attempt'
  | 'unusual_location'
  | 'unusual_device'
  | 'impossible_travel'
  | 'malicious_payload_detected'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt'

  // Compliance Events
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'data_subject_request'
  | 'data_deletion_request'
  | 'data_export_request'
  | 'data_retention_applied'
  | 'data_anonymized'
  | 'compliance_report_generated';

// ==================== Security Event Schema ====================

export const SecurityEventActorSchema = z.object({
  type: z.enum(['user', 'admin', 'system', 'api', 'anonymous']),
  id: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  ipAddress: z.string(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  apiKeyId: z.string().optional(),
});

export const SecurityEventTargetSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  ownerId: z.string().optional(),
});

export const SecurityEventActionSchema = z.object({
  method: z.string().optional(),
  path: z.string().optional(),
  query: z.record(z.any()).optional(),
  requestId: z.string().optional(),
});

export const SecurityEventResultSchema = z.object({
  status: z.enum(['success', 'failure', 'partial', 'blocked']),
  statusCode: z.number().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const SecurityEventContextSchema = z.object({
  service: z.string(),
  environment: z.string(),
  version: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  correlationId: z.string().optional(),
  requestId: z.string().optional(),
});

export const SecurityEventLocationSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const SecurityEventDeviceSchema = z.object({
  type: z.string().optional(),
  os: z.string().optional(),
  browser: z.string().optional(),
  fingerprint: z.string().optional(),
});

export const SecurityEventChangesSchema = z.object({
  before: z.record(z.any()).optional(),
  after: z.record(z.any()).optional(),
  fields: z.array(z.string()).optional(),
});

export const SecurityEventRiskSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  factors: z.array(z.string()).optional(),
  indicators: z.array(z.string()).optional(),
});

export const SecurityEventComplianceSchema = z.object({
  regulations: z.array(z.string()).optional(),
  dataClassification: z.string().optional(),
  piiInvolved: z.boolean().optional(),
  financialData: z.boolean().optional(),
});

export const SecurityEventSchema = z.object({
  // Event identification
  id: z.string().uuid(),
  timestamp: z.date(),
  eventType: z.string(),
  category: z.string(),

  // Severity
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),

  // Actor (who performed the action)
  actor: SecurityEventActorSchema,

  // Target (what was affected)
  target: SecurityEventTargetSchema.optional(),

  // Action details
  action: SecurityEventActionSchema.optional(),

  // Result
  result: SecurityEventResultSchema,

  // Context
  context: SecurityEventContextSchema,

  // Location
  location: SecurityEventLocationSchema.optional(),

  // Device
  device: SecurityEventDeviceSchema.optional(),

  // Additional data
  metadata: z.record(z.any()).optional(),

  // Data changes (for audit)
  changes: SecurityEventChangesSchema.optional(),

  // Risk assessment
  risk: SecurityEventRiskSchema.optional(),

  // Compliance tags
  compliance: SecurityEventComplianceSchema.optional(),
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;
export type SecurityEventActor = z.infer<typeof SecurityEventActorSchema>;
export type SecurityEventTarget = z.infer<typeof SecurityEventTargetSchema>;
export type SecurityEventResult = z.infer<typeof SecurityEventResultSchema>;
export type SecurityEventContext = z.infer<typeof SecurityEventContextSchema>;
export type SecurityEventRisk = z.infer<typeof SecurityEventRiskSchema>;

// ==================== Data Classification ====================

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
}

export interface DataClassificationPolicy {
  classification: DataClassification;
  description: string;
  accessRequirements: string[];
  retentionPeriod: number; // days, -1 for indefinite
  encryptionRequired: boolean;
  auditRequired: boolean;
  piiCategories: string[];
}

export const dataClassificationPolicies: Record<DataClassification, DataClassificationPolicy> = {
  [DataClassification.PUBLIC]: {
    classification: DataClassification.PUBLIC,
    description: 'Information that can be freely shared',
    accessRequirements: [],
    retentionPeriod: -1,
    encryptionRequired: false,
    auditRequired: false,
    piiCategories: [],
  },
  [DataClassification.INTERNAL]: {
    classification: DataClassification.INTERNAL,
    description: 'Information for internal use only',
    accessRequirements: ['authenticated'],
    retentionPeriod: 365 * 7,
    encryptionRequired: false,
    auditRequired: false,
    piiCategories: [],
  },
  [DataClassification.CONFIDENTIAL]: {
    classification: DataClassification.CONFIDENTIAL,
    description: 'Sensitive business information',
    accessRequirements: ['authenticated', 'authorized'],
    retentionPeriod: 365 * 7,
    encryptionRequired: true,
    auditRequired: true,
    piiCategories: ['email', 'name', 'phone'],
  },
  [DataClassification.RESTRICTED]: {
    classification: DataClassification.RESTRICTED,
    description: 'Highly sensitive data requiring strict controls',
    accessRequirements: ['authenticated', 'authorized', 'mfa', 'justification'],
    retentionPeriod: 365 * 3,
    encryptionRequired: true,
    auditRequired: true,
    piiCategories: ['ssn', 'financial', 'health', 'biometric'],
  },
};

// ==================== PII Categories ====================

export interface PIICategory {
  id: string;
  name: string;
  description: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  retentionPeriod: number; // days
  requiresConsent: boolean;
  canBeExported: boolean;
  mustBeAnonymized: boolean;
  encryptionRequired: boolean;
}

export const piiCategories: PIICategory[] = [
  {
    id: 'email',
    name: 'Email Address',
    description: 'User email addresses',
    sensitivity: 'medium',
    retentionPeriod: 365 * 3,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: false,
    encryptionRequired: false,
  },
  {
    id: 'name',
    name: 'Full Name',
    description: 'User full name',
    sensitivity: 'medium',
    retentionPeriod: 365 * 3,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: false,
    encryptionRequired: false,
  },
  {
    id: 'phone',
    name: 'Phone Number',
    description: 'User phone numbers',
    sensitivity: 'medium',
    retentionPeriod: 365 * 3,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: false,
    encryptionRequired: false,
  },
  {
    id: 'address',
    name: 'Physical Address',
    description: 'User physical addresses',
    sensitivity: 'high',
    retentionPeriod: 365 * 3,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: false,
    encryptionRequired: true,
  },
  {
    id: 'dob',
    name: 'Date of Birth',
    description: 'User date of birth',
    sensitivity: 'high',
    retentionPeriod: 365 * 3,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: true,
    encryptionRequired: true,
  },
  {
    id: 'ssn',
    name: 'Social Security Number',
    description: 'Government identification numbers',
    sensitivity: 'critical',
    retentionPeriod: 365 * 7,
    requiresConsent: true,
    canBeExported: false,
    mustBeAnonymized: true,
    encryptionRequired: true,
  },
  {
    id: 'financial',
    name: 'Financial Information',
    description: 'Bank accounts, payment cards',
    sensitivity: 'critical',
    retentionPeriod: 365 * 7,
    requiresConsent: true,
    canBeExported: false,
    mustBeAnonymized: true,
    encryptionRequired: true,
  },
  {
    id: 'ip_address',
    name: 'IP Address',
    description: 'User IP addresses',
    sensitivity: 'low',
    retentionPeriod: 90,
    requiresConsent: false,
    canBeExported: true,
    mustBeAnonymized: true,
    encryptionRequired: false,
  },
  {
    id: 'location',
    name: 'Location Data',
    description: 'Geographic location information',
    sensitivity: 'high',
    retentionPeriod: 365,
    requiresConsent: true,
    canBeExported: true,
    mustBeAnonymized: true,
    encryptionRequired: false,
  },
  {
    id: 'biometric',
    name: 'Biometric Data',
    description: 'Fingerprints, facial recognition',
    sensitivity: 'critical',
    retentionPeriod: 365,
    requiresConsent: true,
    canBeExported: false,
    mustBeAnonymized: true,
    encryptionRequired: true,
  },
];

// ==================== Consent Schema ====================

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  purpose: string;
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  source: 'signup' | 'settings' | 'prompt' | 'api';
  version: string;
  ipAddress: string;
  userAgent: string;
}

export type ConsentType =
  | 'terms_of_service'
  | 'privacy_policy'
  | 'marketing_email'
  | 'marketing_sms'
  | 'analytics'
  | 'personalization'
  | 'third_party_sharing'
  | 'data_processing'
  | 'cookies_essential'
  | 'cookies_analytics'
  | 'cookies_marketing';

export interface ConsentRequirement {
  required: boolean;
  defaultValue: boolean;
  description: string;
  legalBasis: string;
}

export const consentRequirements: Record<ConsentType, ConsentRequirement> = {
  terms_of_service: {
    required: true,
    defaultValue: false,
    description: 'Agreement to terms of service',
    legalBasis: 'contract',
  },
  privacy_policy: {
    required: true,
    defaultValue: false,
    description: 'Acknowledgment of privacy policy',
    legalBasis: 'contract',
  },
  marketing_email: {
    required: false,
    defaultValue: false,
    description: 'Receive marketing emails',
    legalBasis: 'consent',
  },
  marketing_sms: {
    required: false,
    defaultValue: false,
    description: 'Receive marketing SMS',
    legalBasis: 'consent',
  },
  analytics: {
    required: false,
    defaultValue: true,
    description: 'Usage analytics collection',
    legalBasis: 'legitimate_interest',
  },
  personalization: {
    required: false,
    defaultValue: true,
    description: 'Personalized experience',
    legalBasis: 'consent',
  },
  third_party_sharing: {
    required: false,
    defaultValue: false,
    description: 'Share data with partners',
    legalBasis: 'consent',
  },
  data_processing: {
    required: true,
    defaultValue: false,
    description: 'Process personal data',
    legalBasis: 'contract',
  },
  cookies_essential: {
    required: true,
    defaultValue: true,
    description: 'Essential cookies for functionality',
    legalBasis: 'contract',
  },
  cookies_analytics: {
    required: false,
    defaultValue: false,
    description: 'Analytics cookies',
    legalBasis: 'consent',
  },
  cookies_marketing: {
    required: false,
    defaultValue: false,
    description: 'Marketing and advertising cookies',
    legalBasis: 'consent',
  },
};

// ==================== Data Subject Request Types ====================

export interface DataSubjectRequest {
  id: string;
  userId: string;
  type: 'access' | 'deletion' | 'rectification' | 'portability' | 'restriction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  submittedAt: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  verificationMethod?: string;
  requestDetails?: string;
  responseDetails?: string;
  processedBy?: string;
}

// ==================== Retention Policy Types ====================

export interface RetentionPolicy {
  id: string;
  name: string;
  dataType: string;
  retentionDays: number;
  action: 'delete' | 'anonymize' | 'archive';
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

// ==================== Security Severity Levels ====================

export const severityLevels = {
  info: { value: 0, label: 'Info', color: 'blue' },
  low: { value: 1, label: 'Low', color: 'green' },
  medium: { value: 2, label: 'Medium', color: 'yellow' },
  high: { value: 3, label: 'High', color: 'orange' },
  critical: { value: 4, label: 'Critical', color: 'red' },
} as const;

export type SeverityLevel = keyof typeof severityLevels;

// ==================== High-Risk Event Types ====================

export const highRiskEventTypes: SecurityEventType[] = [
  'login_failure',
  'mfa_challenge_failure',
  'access_denied',
  'suspicious_activity',
  'brute_force_detected',
  'credential_stuffing_detected',
  'account_takeover_attempt',
  'impossible_travel',
  'sql_injection_attempt',
  'xss_attempt',
  'csrf_attempt',
];

// ==================== Compliance Regulations ====================

export const complianceRegulations = {
  GDPR: {
    name: 'General Data Protection Regulation',
    region: 'EU',
    requirements: [
      'lawful_basis',
      'consent_management',
      'data_subject_rights',
      'data_protection',
      'breach_notification',
      'dpia',
      'dpo_appointment',
    ],
  },
  CCPA: {
    name: 'California Consumer Privacy Act',
    region: 'US-CA',
    requirements: ['right_to_know', 'right_to_delete', 'right_to_opt_out', 'non_discrimination'],
  },
  SOC2: {
    name: 'System and Organization Controls 2',
    region: 'Global',
    requirements: [
      'security',
      'availability',
      'processing_integrity',
      'confidentiality',
      'privacy',
    ],
  },
  'PCI-DSS': {
    name: 'Payment Card Industry Data Security Standard',
    region: 'Global',
    requirements: [
      'network_security',
      'cardholder_data_protection',
      'vulnerability_management',
      'access_control',
      'monitoring',
      'security_policy',
    ],
  },
} as const;

export type ComplianceRegulation = keyof typeof complianceRegulations;
