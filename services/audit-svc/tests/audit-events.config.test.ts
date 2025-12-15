/**
 * @module @skillancer/audit-svc/tests/audit-events.config.test
 * Unit tests for audit event configuration
 */

import { describe, it, expect } from 'vitest';

import {
  AUDIT_EVENT_TYPES,
  getComplianceConfig,
  getCategoryForEvent,
  requiresImmediateAlert,
  getRetentionPolicy,
  getComplianceTags,
  SENSITIVE_FIELDS,
} from '../src/config/audit-events.config.js';
import { AuditCategory, ComplianceTag, RetentionPolicy } from '../src/types/index.js';

describe('Audit Events Config', () => {
  describe('AUDIT_EVENT_TYPES', () => {
    it('should have authentication events', () => {
      expect(AUDIT_EVENT_TYPES.LOGIN_SUCCESS).toBe('AUTH_LOGIN_SUCCESS');
      expect(AUDIT_EVENT_TYPES.LOGIN_FAILED).toBe('AUTH_LOGIN_FAILED');
      expect(AUDIT_EVENT_TYPES.LOGOUT).toBe('AUTH_LOGOUT');
      expect(AUDIT_EVENT_TYPES.PASSWORD_CHANGED).toBe('AUTH_PASSWORD_CHANGED');
      expect(AUDIT_EVENT_TYPES.MFA_ENABLED).toBe('AUTH_MFA_ENABLED');
    });

    it('should have user management events', () => {
      expect(AUDIT_EVENT_TYPES.USER_CREATED).toBe('USER_CREATED');
      expect(AUDIT_EVENT_TYPES.USER_UPDATED).toBe('USER_UPDATED');
      expect(AUDIT_EVENT_TYPES.USER_DELETED).toBe('USER_DELETED');
      expect(AUDIT_EVENT_TYPES.EMAIL_CHANGED).toBe('USER_EMAIL_CHANGED');
    });

    it('should have payment events', () => {
      expect(AUDIT_EVENT_TYPES.PAYMENT_INITIATED).toBe('PAYMENT_INITIATED');
      expect(AUDIT_EVENT_TYPES.PAYMENT_COMPLETED).toBe('PAYMENT_COMPLETED');
      expect(AUDIT_EVENT_TYPES.PAYMENT_FAILED).toBe('PAYMENT_FAILED');
      expect(AUDIT_EVENT_TYPES.ESCROW_FUNDED).toBe('PAYMENT_ESCROW_FUNDED');
    });

    it('should have security events', () => {
      expect(AUDIT_EVENT_TYPES.SUSPICIOUS_LOGIN_DETECTED).toBe('SECURITY_SUSPICIOUS_LOGIN');
      expect(AUDIT_EVENT_TYPES.BRUTE_FORCE_DETECTED).toBe('SECURITY_BRUTE_FORCE');
      expect(AUDIT_EVENT_TYPES.FRAUD_DETECTED).toBe('SECURITY_FRAUD_DETECTED');
      expect(AUDIT_EVENT_TYPES.DATA_BREACH_DETECTED).toBe('SECURITY_DATA_BREACH');
    });

    it('should have compliance events', () => {
      expect(AUDIT_EVENT_TYPES.GDPR_DATA_REQUEST).toBe('COMPLIANCE_GDPR_DATA_REQUEST');
      expect(AUDIT_EVENT_TYPES.GDPR_DATA_DELETED).toBe('COMPLIANCE_GDPR_DATA_DELETED');
      expect(AUDIT_EVENT_TYPES.CONSENT_GRANTED).toBe('COMPLIANCE_CONSENT_GRANTED');
    });

    it('should have cockpit/admin events', () => {
      expect(AUDIT_EVENT_TYPES.ADMIN_LOGIN).toBe('COCKPIT_ADMIN_LOGIN');
      expect(AUDIT_EVENT_TYPES.USER_IMPERSONATION_STARTED).toBe('COCKPIT_IMPERSONATION_STARTED');
      expect(AUDIT_EVENT_TYPES.SYSTEM_CONFIG_CHANGED).toBe('COCKPIT_SYSTEM_CONFIG_CHANGED');
    });
  });

  describe('getComplianceConfig', () => {
    it('should return config for login success event', () => {
      const config = getComplianceConfig('AUTH_LOGIN_SUCCESS');
      expect(config.regulations).toContain(ComplianceTag.SOC2);
      expect(config.retentionDays).toBe(365);
      expect(config.retentionPolicy).toBe(RetentionPolicy.STANDARD);
    });

    it('should return config for login failed event with immediate alert', () => {
      const config = getComplianceConfig('AUTH_LOGIN_FAILED');
      expect(config.requiresImmediateAlert).toBe(true);
    });

    it('should return config for payment events with extended retention', () => {
      const config = getComplianceConfig('PAYMENT_COMPLETED');
      expect(config.retentionPolicy).toBe(RetentionPolicy.EXTENDED);
      expect(config.dataClassification).toBe('confidential');
    });

    it('should return config for GDPR events with permanent retention', () => {
      const config = getComplianceConfig('COMPLIANCE_GDPR_DATA_REQUEST');
      expect(config.regulations).toContain(ComplianceTag.GDPR);
      expect(config.retentionPolicy).toBe(RetentionPolicy.PERMANENT);
    });

    it('should return config for security events with immediate alert', () => {
      const config = getComplianceConfig('SECURITY_FRAUD_DETECTED');
      expect(config.requiresImmediateAlert).toBe(true);
      expect(config.retentionPolicy).toBe(RetentionPolicy.PERMANENT);
    });

    it('should return default config for unknown events', () => {
      const config = getComplianceConfig('UNKNOWN_EVENT' as never);
      expect(config.regulations).toContain(ComplianceTag.SOC2);
      expect(config.retentionPolicy).toBe(RetentionPolicy.STANDARD);
    });
  });

  describe('getCategoryForEvent', () => {
    it('should return AUTHENTICATION for AUTH_ prefixed events', () => {
      expect(getCategoryForEvent('AUTH_LOGIN_SUCCESS')).toBe(AuditCategory.AUTHENTICATION);
      expect(getCategoryForEvent('AUTH_LOGOUT')).toBe(AuditCategory.AUTHENTICATION);
    });

    it('should return AUTHORIZATION for AUTHZ_ prefixed events', () => {
      expect(getCategoryForEvent('AUTHZ_PERMISSION_GRANTED')).toBe(AuditCategory.AUTHORIZATION);
      expect(getCategoryForEvent('AUTHZ_ROLE_ASSIGNED')).toBe(AuditCategory.AUTHORIZATION);
    });

    it('should return USER_MANAGEMENT for USER_ prefixed events', () => {
      expect(getCategoryForEvent('USER_CREATED')).toBe(AuditCategory.USER_MANAGEMENT);
      expect(getCategoryForEvent('USER_DELETED')).toBe(AuditCategory.USER_MANAGEMENT);
    });

    it('should return DATA_ACCESS for data read events', () => {
      expect(getCategoryForEvent('DATA_VIEWED')).toBe(AuditCategory.DATA_ACCESS);
      expect(getCategoryForEvent('DATA_EXPORTED')).toBe(AuditCategory.DATA_ACCESS);
    });

    it('should return DATA_MODIFICATION for data write events', () => {
      expect(getCategoryForEvent('DATA_CREATED')).toBe(AuditCategory.DATA_MODIFICATION);
      expect(getCategoryForEvent('DATA_DELETED')).toBe(AuditCategory.DATA_MODIFICATION);
    });

    it('should return PAYMENT for PAYMENT_ prefixed events', () => {
      expect(getCategoryForEvent('PAYMENT_COMPLETED')).toBe(AuditCategory.PAYMENT);
      expect(getCategoryForEvent('PAYMENT_ESCROW_FUNDED')).toBe(AuditCategory.PAYMENT);
    });

    it('should return CONTRACT for CONTRACT_ prefixed events', () => {
      expect(getCategoryForEvent('CONTRACT_CREATED')).toBe(AuditCategory.CONTRACT);
      expect(getCategoryForEvent('CONTRACT_MILESTONE_SUBMITTED')).toBe(AuditCategory.CONTRACT);
    });

    it('should return SECURITY for SECURITY_ prefixed events', () => {
      expect(getCategoryForEvent('SECURITY_FRAUD_DETECTED')).toBe(AuditCategory.SECURITY);
      expect(getCategoryForEvent('SECURITY_BRUTE_FORCE')).toBe(AuditCategory.SECURITY);
    });

    it('should return COMPLIANCE for COCKPIT_ and COMPLIANCE_ events', () => {
      expect(getCategoryForEvent('COCKPIT_ADMIN_LOGIN')).toBe(AuditCategory.COMPLIANCE);
      expect(getCategoryForEvent('COMPLIANCE_GDPR_DATA_REQUEST')).toBe(AuditCategory.COMPLIANCE);
    });

    it('should return SYSTEM for unknown prefixes', () => {
      expect(getCategoryForEvent('UNKNOWN_EVENT')).toBe(AuditCategory.SYSTEM);
    });
  });

  describe('requiresImmediateAlert', () => {
    it('should return true for security events requiring alerts', () => {
      expect(requiresImmediateAlert('AUTH_LOGIN_FAILED')).toBe(true);
      expect(requiresImmediateAlert('SECURITY_FRAUD_DETECTED')).toBe(true);
      expect(requiresImmediateAlert('SECURITY_DATA_BREACH')).toBe(true);
      expect(requiresImmediateAlert('COCKPIT_IMPERSONATION_STARTED')).toBe(true);
    });

    it('should return false for normal events', () => {
      expect(requiresImmediateAlert('AUTH_LOGIN_SUCCESS')).toBe(false);
      expect(requiresImmediateAlert('USER_CREATED')).toBe(false);
      expect(requiresImmediateAlert('PAYMENT_COMPLETED')).toBe(false);
    });
  });

  describe('getRetentionPolicy', () => {
    it('should return STANDARD for normal events', () => {
      expect(getRetentionPolicy('AUTH_LOGIN_SUCCESS')).toBe(RetentionPolicy.STANDARD);
    });

    it('should return EXTENDED for payment events', () => {
      expect(getRetentionPolicy('PAYMENT_COMPLETED')).toBe(RetentionPolicy.EXTENDED);
    });

    it('should return PERMANENT for compliance events', () => {
      expect(getRetentionPolicy('COMPLIANCE_GDPR_DATA_REQUEST')).toBe(RetentionPolicy.PERMANENT);
      expect(getRetentionPolicy('SECURITY_FRAUD_DETECTED')).toBe(RetentionPolicy.PERMANENT);
    });
  });

  describe('getComplianceTags', () => {
    it('should return SOC2 for authentication events', () => {
      const tags = getComplianceTags('AUTH_LOGIN_SUCCESS');
      expect(tags).toContain(ComplianceTag.SOC2);
    });

    it('should return GDPR for user data events', () => {
      const tags = getComplianceTags('USER_CREATED');
      expect(tags).toContain(ComplianceTag.GDPR);
      expect(tags).toContain(ComplianceTag.PII);
    });

    it('should return GDPR for compliance events', () => {
      const tags = getComplianceTags('COMPLIANCE_GDPR_DATA_REQUEST');
      expect(tags).toContain(ComplianceTag.GDPR);
    });
  });

  describe('SENSITIVE_FIELDS', () => {
    it('should include password-related fields', () => {
      expect(SENSITIVE_FIELDS).toContain('password');
      expect(SENSITIVE_FIELDS).toContain('passwordHash');
    });

    it('should include token-related fields', () => {
      expect(SENSITIVE_FIELDS).toContain('token');
      expect(SENSITIVE_FIELDS).toContain('accessToken');
      expect(SENSITIVE_FIELDS).toContain('refreshToken');
    });

    it('should include financial fields', () => {
      expect(SENSITIVE_FIELDS).toContain('creditCard');
      expect(SENSITIVE_FIELDS).toContain('cardNumber');
      expect(SENSITIVE_FIELDS).toContain('cvv');
      expect(SENSITIVE_FIELDS).toContain('bankAccount');
    });

    it('should include PII fields', () => {
      expect(SENSITIVE_FIELDS).toContain('ssn');
      expect(SENSITIVE_FIELDS).toContain('socialSecurity');
      expect(SENSITIVE_FIELDS).toContain('taxId');
    });

    it('should include security fields', () => {
      expect(SENSITIVE_FIELDS).toContain('apiKey');
      expect(SENSITIVE_FIELDS).toContain('apiSecret');
      expect(SENSITIVE_FIELDS).toContain('privateKey');
    });
  });
});
