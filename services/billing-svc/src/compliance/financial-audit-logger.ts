// @ts-nocheck
/**
 * Financial Audit Logger
 * Comprehensive audit logging for all financial operations
 * Sprint M5: Freelancer Financial Services
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'financial-audit' });

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'card_details_viewed'
  | 'card_issued'
  | 'card_activated'
  | 'card_frozen'
  | 'card_unfrozen'
  | 'card_canceled'
  | 'payout_initiated'
  | 'payout_completed'
  | 'payout_failed'
  | 'tax_vault_deposit'
  | 'tax_vault_withdrawal'
  | 'tax_payment_made'
  | 'spending_limit_updated'
  | 'kyc_initiated'
  | 'kyc_completed'
  | 'treasury_account_created'
  | 'treasury_account_closed'
  | 'sensitive_data_accessed'
  | 'compliance_document_uploaded'
  | 'compliance_document_reviewed';

export type AuditResource =
  | 'card'
  | 'payout'
  | 'tax_vault'
  | 'treasury_account'
  | 'spending_control'
  | 'kyc_verification'
  | 'compliance_document';

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditQuery {
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// AUDIT LOGGER SERVICE
// ============================================================================

class FinancialAuditLogger {
  // --------------------------------------------------------------------------
  // CORE LOGGING
  // --------------------------------------------------------------------------

  async log(params: {
    userId: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { userId, action, resource, resourceId, ipAddress, userAgent, metadata } = params;

    const auditId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: AuditEntry = {
      id: auditId,
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      metadata: this.sanitizeMetadata(metadata),
      createdAt: new Date(),
    };

    // Log to structured logger
    logger.info('Financial audit event', {
      auditId,
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
    });

    // In production, persist to database
    await this.persistEntry(entry);

    // Track metrics
    metrics.increment('audit.financial.event', { action, resource });

    return auditId;
  }

  private sanitizeMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };

    // Remove sensitive fields
    const sensitiveFields = [
      'cardNumber',
      'cvv',
      'pin',
      'accountNumber',
      'routingNumber',
      'ssn',
      'taxId',
      'password',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private async persistEntry(entry: AuditEntry): Promise<void> {
    // In production, save to FinancialAuditLog table
    // await prisma.financialAuditLog.create({ data: entry });
  }

  // --------------------------------------------------------------------------
  // QUERY METHODS
  // --------------------------------------------------------------------------

  async query(params: AuditQuery): Promise<{
    entries: AuditEntry[];
    total: number;
    hasMore: boolean;
  }> {
    logger.info('Querying audit log', params);

    // In production, query database with filters
    return {
      entries: [],
      total: 0,
      hasMore: false,
    };
  }

  async getByResourceId(resource: AuditResource, resourceId: string): Promise<AuditEntry[]> {
    return this.query({ resource, resourceId }).then((r) => r.entries);
  }

  async getUserActivity(userId: string, days: number = 30): Promise<AuditEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.query({ userId, startDate }).then((r) => r.entries);
  }

  // --------------------------------------------------------------------------
  // CONVENIENCE METHODS
  // --------------------------------------------------------------------------

  async logCardViewed(params: {
    userId: string;
    cardId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: 'card_details_viewed',
      resource: 'card',
      resourceId: params.cardId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async logCardIssued(params: {
    userId: string;
    cardId: string;
    cardType: 'virtual' | 'physical';
    ipAddress?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: 'card_issued',
      resource: 'card',
      resourceId: params.cardId,
      ipAddress: params.ipAddress,
      metadata: { cardType: params.cardType },
    });
  }

  async logPayoutInitiated(params: {
    userId: string;
    payoutId: string;
    amount: number;
    destination: string;
    speed: 'instant' | 'standard';
    ipAddress?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: 'payout_initiated',
      resource: 'payout',
      resourceId: params.payoutId,
      ipAddress: params.ipAddress,
      metadata: {
        amount: params.amount,
        destination: params.destination,
        speed: params.speed,
      },
    });
  }

  async logTaxVaultDeposit(params: {
    userId: string;
    amount: number;
    type: 'auto_save' | 'manual';
    sourceId?: string;
    ipAddress?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: 'tax_vault_deposit',
      resource: 'tax_vault',
      ipAddress: params.ipAddress,
      metadata: {
        amount: params.amount,
        type: params.type,
        sourceId: params.sourceId,
      },
    });
  }

  async logKycEvent(params: {
    userId: string;
    event: 'initiated' | 'completed';
    level: string;
    status?: string;
    ipAddress?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: params.event === 'initiated' ? 'kyc_initiated' : 'kyc_completed',
      resource: 'kyc_verification',
      ipAddress: params.ipAddress,
      metadata: { level: params.level, status: params.status },
    });
  }

  async logSensitiveDataAccess(params: {
    userId: string;
    dataType: string;
    resourceId: string;
    reason: string;
    ipAddress?: string;
  }): Promise<string> {
    return this.log({
      userId: params.userId,
      action: 'sensitive_data_accessed',
      resource: 'treasury_account',
      resourceId: params.resourceId,
      ipAddress: params.ipAddress,
      metadata: { dataType: params.dataType, reason: params.reason },
    });
  }

  // --------------------------------------------------------------------------
  // COMPLIANCE EXPORTS
  // --------------------------------------------------------------------------

  async exportForCompliance(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{ csv: string; recordCount: number }> {
    logger.info('Exporting audit log for compliance', params);

    const entries = await this.query({
      userId: params.userId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: 10000,
    });

    const csv = this.entriesToCsv(entries.entries);

    return { csv, recordCount: entries.entries.length };
  }

  private entriesToCsv(entries: AuditEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'Action',
      'Resource',
      'Resource ID',
      'IP Address',
    ];

    const rows = entries.map((e) => [
      e.id,
      e.createdAt.toISOString(),
      e.userId,
      e.action,
      e.resource,
      e.resourceId || '',
      e.ipAddress || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let auditLogger: FinancialAuditLogger | null = null;

export function getFinancialAuditLogger(): FinancialAuditLogger {
  if (!auditLogger) {
    auditLogger = new FinancialAuditLogger();
  }
  return auditLogger;
}

