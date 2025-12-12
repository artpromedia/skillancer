/**
 * @module @skillancer/audit-svc/services/data-redaction.service
 * PII/sensitive data redaction for GDPR compliance
 */

import * as auditLogRepository from '../repositories/audit-log.repository.js';

import type { AuditLogEntry } from '../types/index.js';

export interface RedactionRule {
  field: string;
  pattern?: RegExp;
  replacement: string;
}

const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  { field: 'email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, replacement: '[EMAIL_REDACTED]' },
  { field: 'phone', pattern: /[\d\s\-+()]+/, replacement: '[PHONE_REDACTED]' },
  { field: 'ssn', pattern: /\d{3}-?\d{2}-?\d{4}/, replacement: '[SSN_REDACTED]' },
  {
    field: 'creditCard',
    pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
    replacement: '[CC_REDACTED]',
  },
  { field: 'password', replacement: '[PASSWORD_REDACTED]' },
  { field: 'token', replacement: '[TOKEN_REDACTED]' },
  { field: 'secret', replacement: '[SECRET_REDACTED]' },
  { field: 'apiKey', replacement: '[APIKEY_REDACTED]' },
  { field: 'ipAddress', replacement: '[IP_REDACTED]' },
  { field: 'userAgent', replacement: '[USERAGENT_REDACTED]' },
];

export interface GDPRDeletionRequest {
  subjectId: string;
  requestedAt: Date;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  recordsAffected?: number;
  error?: string;
}

export function applyRedaction(
  log: AuditLogEntry,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES
): AuditLogEntry {
  const redacted = JSON.parse(JSON.stringify(log)) as AuditLogEntry;

  const redactObject = (obj: Record<string, unknown>, path: string[] = []): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      const fieldName = key.toLowerCase();

      const matchingRule = rules.find(
        (rule) =>
          fieldName.includes(rule.field.toLowerCase()) ||
          rule.field.toLowerCase().includes(fieldName)
      );

      if (matchingRule) {
        if (typeof value === 'string') {
          if (matchingRule.pattern) {
            obj[key] = value.replace(matchingRule.pattern, matchingRule.replacement);
          } else {
            obj[key] = matchingRule.replacement;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        redactObject(value as Record<string, unknown>, currentPath);
      }
    }
  };

  if (redacted.actor && typeof redacted.actor === 'object') {
    redactObject(redacted.actor as unknown as Record<string, unknown>);
  }

  if (redacted.changes) {
    if (redacted.changes.before) {
      redactObject(redacted.changes.before);
    }
    if (redacted.changes.after) {
      redactObject(redacted.changes.after);
    }
  }

  if (redacted.request) {
    redactObject(redacted.request as unknown as Record<string, unknown>);
  }

  if (redacted.metadata) {
    redactObject(redacted.metadata);
  }

  return redacted;
}

export async function processGDPRDeletion(
  subjectId: string,
  reason: string
): Promise<GDPRDeletionRequest> {
  const request: GDPRDeletionRequest = {
    subjectId,
    requestedAt: new Date(),
    reason,
    status: 'processing',
  };

  try {
    const logsToRedact = await auditLogRepository.findAuditLogs({ actorId: subjectId }, 0, 100000);

    let recordsAffected = 0;

    for (const log of logsToRedact) {
      const redactedLog = applyRedaction(log, [
        ...DEFAULT_REDACTION_RULES,
        { field: 'actor.id', replacement: '[SUBJECT_REDACTED]' },
        { field: 'actor.name', replacement: '[NAME_REDACTED]' },
      ]);

      redactedLog.metadata = {
        ...redactedLog.metadata,
        gdprRedacted: true,
        redactionDate: new Date().toISOString(),
        redactionReason: reason,
      };

      await auditLogRepository.updateAuditLog(log.id, redactedLog);
      recordsAffected++;
    }

    request.status = 'completed';
    request.processedAt = new Date();
    request.recordsAffected = recordsAffected;
  } catch (error) {
    request.status = 'failed';
    request.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return request;
}

export async function generateGDPRDataExport(subjectId: string): Promise<{
  subjectId: string;
  exportDate: Date;
  totalRecords: number;
  data: {
    auditLogs: AuditLogEntry[];
  };
}> {
  const logs = await auditLogRepository.findAuditLogs({ actorId: subjectId }, 0, 100000);

  return {
    subjectId,
    exportDate: new Date(),
    totalRecords: logs.length,
    data: {
      auditLogs: logs,
    },
  };
}

export function maskPII(value: string, type: 'email' | 'phone' | 'name' | 'partial'): string {
  switch (type) {
    case 'email': {
      const [local, domain] = value.split('@');
      if (!local || !domain) return '[INVALID_EMAIL]';
      const maskedLocal =
        local.length > 2
          ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
          : '*'.repeat(local.length);
      return `${maskedLocal}@${domain}`;
    }
    case 'phone': {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 4) return '*'.repeat(digits.length);
      return '*'.repeat(digits.length - 4) + digits.slice(-4);
    }
    case 'name': {
      const parts = value.split(' ');
      return parts.map((p) => p[0] + '*'.repeat(Math.max(0, p.length - 1))).join(' ');
    }
    case 'partial':
    default: {
      if (value.length <= 4) return '*'.repeat(value.length);
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    }
  }
}
