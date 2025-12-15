/**
 * @module @skillancer/audit-svc/decorators
 * Decorator exports
 */

export {
  Audited,
  AuditDataChange,
  AuditAccess,
  AuditSecurity,
  setAuditContext,
  getAuditContext,
  clearAuditContext,
  type AuditedConfig,
  type AuditDataChangeConfig,
  type AuditContext,
} from './audit.decorators.js';
