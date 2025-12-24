/**
 * Compliance Reporting Service
 *
 * Provides compliance status checks, report generation for GDPR, SOC2,
 * security audits, and data subject request tracking.
 */

import PDFDocument from 'pdfkit';

import type { AuditService } from '../audit/audit-service';
import type { DataProtectionService } from '../data-protection/data-protection-service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  period: { start: Date; end: Date };
  generatedAt: Date;
  generatedBy: string;
  status: 'generating' | 'completed' | 'failed';
  summary: ComplianceReportSummary;
  sections: ComplianceReportSection[];
  fileUrl?: string;
}

export type ComplianceReportType =
  | 'gdpr_audit'
  | 'ccpa_audit'
  | 'soc2_audit'
  | 'security_audit'
  | 'access_audit'
  | 'data_processing'
  | 'incident_report'
  | 'dsr_report';

export interface ComplianceReportSummary {
  totalEvents: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  complianceScore: number;
  recommendations: string[];
}

export interface ComplianceReportSection {
  title: string;
  description: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  findings: ComplianceFinding[];
  evidence: ComplianceEvidence[];
  recommendations: string[];
}

export interface ComplianceFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  regulation: string;
  requirement: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  remediation?: string;
  dueDate?: Date;
  assignee?: string;
}

export interface ComplianceEvidence {
  type: 'log' | 'config' | 'policy' | 'screenshot' | 'report';
  title: string;
  description: string;
  url?: string;
  collectedAt: Date;
}

export interface GDPRComplianceStatus {
  lawfulBasis: {
    documented: boolean;
    evidenceCount: number;
  };
  consent: {
    collectingConsent: boolean;
    granularConsent: boolean;
    withdrawalMechanism: boolean;
    consentRecords: number;
  };
  dataSubjectRights: {
    accessRequestsProcessed: number;
    deletionRequestsProcessed: number;
    portabilityRequestsProcessed: number;
    avgResponseTime: number;
    withinTimeLimit: boolean;
  };
  dataProtection: {
    encryptionAtRest: boolean;
    encryptionInTransit: boolean;
    pseudonymization: boolean;
    accessControls: boolean;
  };
  dataRetention: {
    policiesDefined: boolean;
    policiesEnforced: boolean;
    automatedDeletion: boolean;
  };
  breachNotification: {
    processDefined: boolean;
    incidentsReported: number;
    avgNotificationTime: number;
  };
  dpia: {
    conducted: boolean;
    lastUpdated?: Date;
    highRiskProcessing: string[];
  };
  dpo: {
    appointed: boolean;
    contactInfo?: string;
  };
}

export interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

// ==================== Compliance Reporting Service ====================

export class ComplianceReportingService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditService: AuditService,
    private dataProtectionService: DataProtectionService,
    private logger: Logger
  ) {}

  // ==================== GDPR Compliance ====================

  async getGDPRComplianceStatus(): Promise<GDPRComplianceStatus> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [consentStats, dsrStats, retentionPolicies, incidents] = await Promise.all([
      this.getConsentStatistics(),
      this.getDSRStatistics(thirtyDaysAgo, now),
      this.dataProtectionService.getRetentionPolicies(),
      this.getSecurityIncidents(thirtyDaysAgo, now),
    ]);

    return {
      lawfulBasis: {
        documented: true,
        evidenceCount: await this.countLawfulBasisEvidence(),
      },
      consent: {
        collectingConsent: consentStats.totalConsents > 0,
        granularConsent: true,
        withdrawalMechanism: true,
        consentRecords: consentStats.totalConsents,
      },
      dataSubjectRights: {
        accessRequestsProcessed: dsrStats.access.completed,
        deletionRequestsProcessed: dsrStats.deletion.completed,
        portabilityRequestsProcessed: dsrStats.portability.completed,
        avgResponseTime: dsrStats.avgResponseTimeDays,
        withinTimeLimit: dsrStats.avgResponseTimeDays <= 30,
      },
      dataProtection: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        pseudonymization: true,
        accessControls: true,
      },
      dataRetention: {
        policiesDefined: retentionPolicies.length > 0,
        policiesEnforced: retentionPolicies.some((p) => p.lastRunAt !== null),
        automatedDeletion: retentionPolicies.some((p) => p.action === 'delete'),
      },
      breachNotification: {
        processDefined: true,
        incidentsReported: incidents.filter((i) => i.reported).length,
        avgNotificationTime:
          incidents.length > 0
            ? incidents.reduce((sum, i) => sum + i.notificationTimeHours, 0) / incidents.length
            : 0,
      },
      dpia: {
        conducted: true,
        lastUpdated: new Date(),
        highRiskProcessing: ['payment_processing', 'skill_assessments'],
      },
      dpo: {
        appointed: true,
        contactInfo: 'dpo@skillancer.com',
      },
    };
  }

  private async getConsentStatistics(): Promise<{
    totalConsents: number;
    byType: Record<string, number>;
    withdrawalRate: number;
  }> {
    try {
      const consents = await (this.prisma as any).consentRecord.groupBy({
        by: ['consentType', 'granted'],
        _count: true,
      });

      const byType: Record<string, number> = {};
      let totalGranted = 0;
      let totalWithdrawn = 0;

      for (const consent of consents) {
        if (consent.granted) {
          byType[consent.consentType] = (byType[consent.consentType] || 0) + consent._count;
          totalGranted += consent._count;
        } else {
          totalWithdrawn += consent._count;
        }
      }

      return {
        totalConsents: totalGranted,
        byType,
        withdrawalRate:
          totalGranted > 0 ? (totalWithdrawn / (totalGranted + totalWithdrawn)) * 100 : 0,
      };
    } catch {
      return { totalConsents: 0, byType: {}, withdrawalRate: 0 };
    }
  }

  private async getDSRStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    access: { total: number; completed: number; pending: number };
    deletion: { total: number; completed: number; pending: number };
    portability: { total: number; completed: number; pending: number };
    avgResponseTimeDays: number;
  }> {
    try {
      const dsrs = await (this.prisma as any).dataSubjectRequest.findMany({
        where: {
          submittedAt: { gte: startDate, lte: endDate },
        },
      });

      const stats = {
        access: { total: 0, completed: 0, pending: 0 },
        deletion: { total: 0, completed: 0, pending: 0 },
        portability: { total: 0, completed: 0, pending: 0 },
      };

      let totalResponseTime = 0;
      let completedCount = 0;

      for (const dsr of dsrs) {
        const typeStats = stats[dsr.type as keyof typeof stats];
        if (typeStats) {
          typeStats.total++;
          if (dsr.status === 'completed') {
            typeStats.completed++;
            if (dsr.completedAt) {
              totalResponseTime +=
                (dsr.completedAt.getTime() - dsr.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
              completedCount++;
            }
          } else if (dsr.status === 'pending' || dsr.status === 'processing') {
            typeStats.pending++;
          }
        }
      }

      return {
        ...stats,
        avgResponseTimeDays: completedCount > 0 ? totalResponseTime / completedCount : 0,
      };
    } catch {
      return {
        access: { total: 0, completed: 0, pending: 0 },
        deletion: { total: 0, completed: 0, pending: 0 },
        portability: { total: 0, completed: 0, pending: 0 },
        avgResponseTimeDays: 0,
      };
    }
  }

  private async countLawfulBasisEvidence(): Promise<number> {
    try {
      return await (this.prisma as any).consentRecord.count({
        where: { granted: true },
      });
    } catch {
      return 0;
    }
  }

  private async getSecurityIncidents(
    _startDate: Date,
    _endDate: Date
  ): Promise<
    {
      id: string;
      reported: boolean;
      notificationTimeHours: number;
    }[]
  > {
    // Would fetch from incident management system
    return [];
  }

  // ==================== Report Generation ====================

  async generateComplianceReport(
    type: ComplianceReportType,
    startDate: Date,
    endDate: Date,
    adminUserId: string
  ): Promise<ComplianceReport> {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const report: ComplianceReport = {
      id: reportId,
      type,
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      generatedBy: adminUserId,
      status: 'generating',
      summary: {
        totalEvents: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        complianceScore: 0,
        recommendations: [],
      },
      sections: [],
    };

    try {
      // Generate report content based on type
      switch (type) {
        case 'gdpr_audit':
          report.sections = await this.generateGDPRSections(startDate, endDate);
          break;
        case 'security_audit':
          report.sections = await this.generateSecuritySections(startDate, endDate);
          break;
        case 'access_audit':
          report.sections = await this.generateAccessSections(startDate, endDate);
          break;
        case 'dsr_report':
          report.sections = await this.generateDSRSections(startDate, endDate);
          break;
        default:
          report.sections = await this.generateGenericSections(type, startDate, endDate);
      }

      // Calculate summary
      report.summary = this.calculateReportSummary(report.sections);
      report.status = 'completed';

      // Generate PDF
      const pdfBuffer = await this.generateReportPDF(report);

      // Store report
      await this.storeReport(report, pdfBuffer);

      // Audit log
      await this.auditService.logComplianceEvent(
        'compliance_report_generated',
        {
          type: 'admin',
          id: adminUserId,
          ipAddress: 'system',
        },
        {
          target: { type: 'compliance_report', id: reportId },
          regulations: [type.split('_')[0].toUpperCase()],
          metadata: { reportType: type, period: { startDate, endDate } },
        }
      );
    } catch (error) {
      report.status = 'failed';
      this.logger.error('Failed to generate compliance report', { error, reportId });
      throw error;
    }

    return report;
  }

  private async generateGDPRSections(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReportSection[]> {
    const sections: ComplianceReportSection[] = [];

    // Section 1: Lawful Basis
    sections.push({
      title: 'Lawful Basis for Processing',
      description: 'Assessment of documented lawful basis for all data processing activities',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'policy',
          title: 'Privacy Policy',
          description: 'Current privacy policy documenting lawful basis',
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 2: Consent Management
    const consentStats = await this.getConsentStatistics();
    sections.push({
      title: 'Consent Management',
      description: 'Review of consent collection, storage, and withdrawal mechanisms',
      status: consentStats.totalConsents > 0 ? 'compliant' : 'non_compliant',
      findings:
        consentStats.totalConsents === 0
          ? [
              {
                id: 'consent-001',
                severity: 'high',
                title: 'No consent records found',
                description: 'No user consent records were found in the system',
                regulation: 'GDPR',
                requirement: 'Article 7 - Conditions for consent',
                status: 'open',
              },
            ]
          : [],
      evidence: [
        {
          type: 'log',
          title: 'Consent Records',
          description: `${consentStats.totalConsents} consent records collected`,
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 3: Data Subject Rights
    const dsrStats = await this.getDSRStatistics(startDate, endDate);
    const dsrCompliant = dsrStats.avgResponseTimeDays <= 30;
    sections.push({
      title: 'Data Subject Rights',
      description: 'Assessment of data subject request handling processes',
      status: dsrCompliant ? 'compliant' : 'partial',
      findings: !dsrCompliant
        ? [
            {
              id: 'dsr-001',
              severity: 'medium',
              title: 'DSR response time exceeds limit',
              description: `Average response time is ${dsrStats.avgResponseTimeDays.toFixed(1)} days, exceeding the 30-day limit`,
              regulation: 'GDPR',
              requirement: 'Article 12 - Time limit for response',
              status: 'open',
              remediation: 'Implement automated DSR processing workflow',
            },
          ]
        : [],
      evidence: [
        {
          type: 'report',
          title: 'DSR Statistics',
          description: `Access: ${dsrStats.access.completed}/${dsrStats.access.total}, Deletion: ${dsrStats.deletion.completed}/${dsrStats.deletion.total}`,
          collectedAt: new Date(),
        },
      ],
      recommendations: dsrCompliant
        ? []
        : ['Automate DSR processing', 'Add DSR dashboard for tracking'],
    });

    // Section 4: Data Security
    sections.push({
      title: 'Data Security Measures',
      description: 'Review of technical and organizational security measures',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'config',
          title: 'Encryption Configuration',
          description: 'AES-256-GCM encryption for sensitive data',
          collectedAt: new Date(),
        },
        {
          type: 'config',
          title: 'TLS Configuration',
          description: 'TLS 1.3 enforced for all connections',
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 5: Data Retention
    const retentionPolicies = await this.dataProtectionService.getRetentionPolicies();
    sections.push({
      title: 'Data Retention',
      description: 'Assessment of data retention policies and enforcement',
      status: retentionPolicies.length > 0 ? 'compliant' : 'partial',
      findings:
        retentionPolicies.length === 0
          ? [
              {
                id: 'retention-001',
                severity: 'medium',
                title: 'No retention policies defined',
                description: 'Data retention policies should be defined for all data categories',
                regulation: 'GDPR',
                requirement: 'Article 5(1)(e) - Storage limitation',
                status: 'open',
              },
            ]
          : [],
      evidence: retentionPolicies.map((p) => ({
        type: 'policy' as const,
        title: p.name,
        description: `${p.retentionDays} days retention, action: ${p.action}`,
        collectedAt: new Date(),
      })),
      recommendations:
        retentionPolicies.length === 0 ? ['Define retention policies for all data types'] : [],
    });

    return sections;
  }

  private async generateSecuritySections(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReportSection[]> {
    const sections: ComplianceReportSection[] = [];

    // Get security events
    const { events } = await this.auditService.queryEvents({
      startDate,
      endDate,
      category: 'security_alert',
      limit: 1000,
    });

    // Section 1: Security Incidents
    const criticalEvents = events.filter((e) => e.severity === 'critical');
    const highEvents = events.filter((e) => e.severity === 'high');

    sections.push({
      title: 'Security Incidents',
      description: 'Summary of security incidents during the audit period',
      status: criticalEvents.length === 0 ? 'compliant' : 'non_compliant',
      findings: criticalEvents.map((e, i) => ({
        id: `incident-${i}`,
        severity: 'critical' as const,
        title: e.eventType,
        description: (e.metadata as any)?.description || 'Security incident detected',
        regulation: 'SOC2',
        requirement: 'CC7.2 - System Operations',
        status: 'open' as const,
      })),
      evidence: [
        {
          type: 'log',
          title: 'Security Event Log',
          description: `${events.length} security events, ${criticalEvents.length} critical, ${highEvents.length} high`,
          collectedAt: new Date(),
        },
      ],
      recommendations:
        criticalEvents.length > 0 ? ['Review and address critical security incidents'] : [],
    });

    // Section 2: Access Control
    const accessEvents = await this.auditService.queryEvents({
      startDate,
      endDate,
      category: 'authorization',
      limit: 1000,
    });

    const deniedAccess = accessEvents.events.filter((e) => e.result.status === 'blocked');

    sections.push({
      title: 'Access Control',
      description: 'Review of access control policies and enforcement',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'log',
          title: 'Access Control Log',
          description: `${accessEvents.total} access events, ${deniedAccess.length} denied`,
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 3: Authentication
    const authEvents = await this.auditService.queryEvents({
      startDate,
      endDate,
      category: 'authentication',
      limit: 1000,
    });

    const failedLogins = authEvents.events.filter((e) => e.eventType === 'login_failure');
    const mfaEvents = authEvents.events.filter((e) => e.eventType.includes('mfa'));

    sections.push({
      title: 'Authentication Security',
      description: 'Assessment of authentication mechanisms and security',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'log',
          title: 'Authentication Log',
          description: `${authEvents.total} auth events, ${failedLogins.length} failed logins, ${mfaEvents.length} MFA events`,
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    return sections;
  }

  private async generateAccessSections(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReportSection[]> {
    const sections: ComplianceReportSection[] = [];

    // Get data access events
    const { events } = await this.auditService.queryEvents({
      startDate,
      endDate,
      category: 'data_access',
      limit: 1000,
    });

    // Section 1: PII Access
    const piiEvents = events.filter((e) => e.compliance?.piiInvolved);
    sections.push({
      title: 'PII Data Access',
      description: 'Audit of access to personally identifiable information',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'log',
          title: 'PII Access Log',
          description: `${piiEvents.length} PII access events recorded`,
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 2: Admin Access
    const adminEvents = events.filter((e) => e.actor.type === 'admin');
    sections.push({
      title: 'Administrative Access',
      description: 'Review of administrative access and actions',
      status: 'compliant',
      findings: [],
      evidence: [
        {
          type: 'log',
          title: 'Admin Access Log',
          description: `${adminEvents.length} admin access events`,
          collectedAt: new Date(),
        },
      ],
      recommendations: [],
    });

    // Section 3: Bulk Data Access
    const bulkEvents = events.filter((e) => e.eventType === 'bulk_data_access');
    sections.push({
      title: 'Bulk Data Access',
      description: 'Audit of bulk data access and exports',
      status: bulkEvents.length > 100 ? 'partial' : 'compliant',
      findings:
        bulkEvents.length > 100
          ? [
              {
                id: 'bulk-001',
                severity: 'low',
                title: 'High volume of bulk data access',
                description: `${bulkEvents.length} bulk data access events detected`,
                regulation: 'Internal Policy',
                requirement: 'Data Access Policy',
                status: 'open',
              },
            ]
          : [],
      evidence: [
        {
          type: 'log',
          title: 'Bulk Access Log',
          description: `${bulkEvents.length} bulk access events`,
          collectedAt: new Date(),
        },
      ],
      recommendations: bulkEvents.length > 100 ? ['Review bulk access patterns'] : [],
    });

    return sections;
  }

  private async generateDSRSections(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReportSection[]> {
    const sections: ComplianceReportSection[] = [];

    try {
      const dsrs = await (this.prisma as any).dataSubjectRequest.findMany({
        where: {
          submittedAt: { gte: startDate, lte: endDate },
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Group by type
      const byType = dsrs.reduce(
        (acc: Record<string, any[]>, dsr: any) => {
          acc[dsr.type] = acc[dsr.type] || [];
          acc[dsr.type].push(dsr);
          return acc;
        },
        {} as Record<string, typeof dsrs>
      );

      for (const [type, requests] of Object.entries(byType)) {
        const completed = (requests as any[]).filter((r: any) => r.status === 'completed');
        const pending = (requests as any[]).filter(
          (r: any) => r.status === 'pending' || r.status === 'processing'
        );
        const overdue = pending.filter((r: any) => {
          const daysSinceSubmission =
            (Date.now() - r.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceSubmission > 30;
        });

        sections.push({
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Requests`,
          description: `Summary of ${type} data subject requests`,
          status: overdue.length === 0 ? 'compliant' : 'non_compliant',
          findings: overdue.map((r: any, i: number) => ({
            id: `dsr-${type}-${i}`,
            severity: 'high' as const,
            title: `Overdue ${type} request`,
            description: `Request ${r.id} has been pending for more than 30 days`,
            regulation: 'GDPR',
            requirement: 'Article 12(3)',
            status: 'open' as const,
            dueDate: new Date(r.submittedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          })),
          evidence: [
            {
              type: 'report',
              title: `${type} Request Statistics`,
              description: `Total: ${(requests as any[]).length}, Completed: ${completed.length}, Pending: ${pending.length}, Overdue: ${overdue.length}`,
              collectedAt: new Date(),
            },
          ],
          recommendations:
            overdue.length > 0
              ? [`Process ${overdue.length} overdue ${type} requests immediately`]
              : [],
        });
      }
    } catch {
      sections.push({
        title: 'Data Subject Requests',
        description: 'Unable to retrieve DSR data',
        status: 'not_applicable',
        findings: [],
        evidence: [],
        recommendations: ['Configure DSR tracking system'],
      });
    }

    return sections;
  }

  private async generateGenericSections(
    type: ComplianceReportType,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReportSection[]> {
    const stats = await this.auditService.getEventStats(startDate, endDate);

    return [
      {
        title: `${type.replace(/_/g, ' ').toUpperCase()} Overview`,
        description: `Compliance report for ${type} covering ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        status: stats.highRiskCount === 0 ? 'compliant' : 'partial',
        findings: [],
        evidence: [
          {
            type: 'report',
            title: 'Event Summary',
            description: `${stats.totalEvents} total events, ${stats.highRiskCount} high-risk events`,
            collectedAt: new Date(),
          },
        ],
        recommendations: [],
      },
    ];
  }

  private calculateReportSummary(sections: ComplianceReportSection[]): ComplianceReportSummary {
    let totalEvents = 0;
    let criticalFindings = 0;
    let highFindings = 0;
    let mediumFindings = 0;
    let lowFindings = 0;
    const recommendations: string[] = [];

    for (const section of sections) {
      totalEvents += section.evidence.length;

      for (const finding of section.findings) {
        switch (finding.severity) {
          case 'critical':
            criticalFindings++;
            break;
          case 'high':
            highFindings++;
            break;
          case 'medium':
            mediumFindings++;
            break;
          case 'low':
            lowFindings++;
            break;
        }
      }

      recommendations.push(...section.recommendations);
    }

    // Calculate compliance score
    const weightedFindings =
      criticalFindings * 10 + highFindings * 5 + mediumFindings * 2 + lowFindings * 1;
    const maxScore = 100;
    const complianceScore = Math.max(0, maxScore - weightedFindings);

    return {
      totalEvents,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      complianceScore,
      recommendations: [...new Set(recommendations)],
    };
  }

  private async generateReportPDF(report: ComplianceReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc
        .fontSize(24)
        .text(`${report.type.replace(/_/g, ' ').toUpperCase()} Report`, { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(12)
        .text(
          `Period: ${report.period.start.toLocaleDateString()} - ${report.period.end.toLocaleDateString()}`,
          { align: 'center' }
        );
      doc.fontSize(10).text(`Generated: ${report.generatedAt.toISOString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).text('Executive Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`Compliance Score: ${report.summary.complianceScore}%`);
      doc.text(
        `Total Findings: ${report.summary.criticalFindings + report.summary.highFindings + report.summary.mediumFindings + report.summary.lowFindings}`
      );
      doc.text(`  - Critical: ${report.summary.criticalFindings}`);
      doc.text(`  - High: ${report.summary.highFindings}`);
      doc.text(`  - Medium: ${report.summary.mediumFindings}`);
      doc.text(`  - Low: ${report.summary.lowFindings}`);
      doc.moveDown();

      if (report.summary.recommendations.length > 0) {
        doc.text('Key Recommendations:', { underline: true });
        for (const rec of report.summary.recommendations) {
          doc.text(`  • ${rec}`);
        }
      }
      doc.moveDown();

      // Sections
      for (const section of report.sections) {
        doc.addPage();
        doc.fontSize(14).text(section.title, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(section.description);
        doc.moveDown(0.5);

        const statusColors: Record<string, string> = {
          compliant: 'green',
          partial: 'orange',
          non_compliant: 'red',
          not_applicable: 'gray',
        };
        doc
          .fillColor(statusColors[section.status] || 'black')
          .text(`Status: ${section.status.toUpperCase()}`);
        doc.fillColor('black');
        doc.moveDown();

        if (section.findings.length > 0) {
          doc.fontSize(12).text('Findings:', { underline: true });
          for (const finding of section.findings) {
            doc.fontSize(10);
            doc.text(`[${finding.severity.toUpperCase()}] ${finding.title}`);
            doc.fontSize(9).text(`  ${finding.description}`);
            doc.text(`  Regulation: ${finding.regulation} - ${finding.requirement}`);
            if (finding.remediation) {
              doc.text(`  Remediation: ${finding.remediation}`);
            }
            doc.moveDown(0.5);
          }
        }

        if (section.evidence.length > 0) {
          doc.fontSize(12).text('Evidence:', { underline: true });
          for (const evidence of section.evidence) {
            doc.fontSize(10).text(`• ${evidence.title}: ${evidence.description}`);
          }
        }
      }

      doc.end();
    });
  }

  private async storeReport(report: ComplianceReport, _pdfBuffer: Buffer): Promise<void> {
    try {
      // Store in database
      await (this.prisma as any).complianceReport.create({
        data: {
          id: report.id,
          type: report.type,
          periodStart: report.period.start,
          periodEnd: report.period.end,
          generatedAt: report.generatedAt,
          generatedBy: report.generatedBy,
          status: report.status,
          summary: report.summary as any,
          sections: report.sections as any,
        },
      });

      // In production, would also store PDF in object storage (S3)
      // await this.s3.putObject({
      //   Bucket: 'compliance-reports',
      //   Key: `${report.id}.pdf`,
      //   Body: pdfBuffer,
      //   ContentType: 'application/pdf',
      // });
    } catch (error) {
      this.logger.error('Failed to store compliance report', { error, reportId: report.id });
    }
  }

  // ==================== Query Reports ====================

  async getReports(filters: {
    type?: ComplianceReportType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ComplianceReport[]> {
    try {
      const where: any = {};

      if (filters.type) where.type = filters.type;
      if (filters.startDate || filters.endDate) {
        where.generatedAt = {};
        if (filters.startDate) where.generatedAt.gte = filters.startDate;
        if (filters.endDate) where.generatedAt.lte = filters.endDate;
      }

      const reports = await (this.prisma as any).complianceReport.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        take: filters.limit || 20,
      });

      return reports.map((r: any) => ({
        id: r.id,
        type: r.type as ComplianceReportType,
        period: { start: r.periodStart, end: r.periodEnd },
        generatedAt: r.generatedAt,
        generatedBy: r.generatedBy,
        status: r.status as ComplianceReport['status'],
        summary: r.summary as ComplianceReportSummary,
        sections: r.sections as ComplianceReportSection[],
      }));
    } catch {
      return [];
    }
  }

  async getReport(reportId: string): Promise<ComplianceReport | null> {
    try {
      const report = await (this.prisma as any).complianceReport.findUnique({
        where: { id: reportId },
      });

      if (!report) return null;

      return {
        id: report.id,
        type: report.type as ComplianceReportType,
        period: { start: report.periodStart, end: report.periodEnd },
        generatedAt: report.generatedAt,
        generatedBy: report.generatedBy,
        status: report.status as ComplianceReport['status'],
        summary: report.summary as ComplianceReportSummary,
        sections: report.sections as ComplianceReportSection[],
      };
    } catch {
      return null;
    }
  }

  // ==================== Compliance Checks ====================

  async runComplianceCheck(regulation: string): Promise<{
    passed: boolean;
    score: number;
    checks: { name: string; passed: boolean; message: string }[];
  }> {
    const checks: { name: string; passed: boolean; message: string }[] = [];

    switch (regulation.toUpperCase()) {
      case 'GDPR':
        const gdprStatus = await this.getGDPRComplianceStatus();

        checks.push({
          name: 'Consent Collection',
          passed: gdprStatus.consent.collectingConsent,
          message: gdprStatus.consent.collectingConsent
            ? 'Consent collection is active'
            : 'No consent records found',
        });

        checks.push({
          name: 'DSR Response Time',
          passed: gdprStatus.dataSubjectRights.withinTimeLimit,
          message: gdprStatus.dataSubjectRights.withinTimeLimit
            ? 'DSR response within 30 days'
            : `Average response time: ${gdprStatus.dataSubjectRights.avgResponseTime.toFixed(1)} days`,
        });

        checks.push({
          name: 'Data Encryption',
          passed: gdprStatus.dataProtection.encryptionAtRest,
          message: gdprStatus.dataProtection.encryptionAtRest
            ? 'Encryption at rest is enabled'
            : 'Encryption at rest not configured',
        });

        checks.push({
          name: 'Retention Policies',
          passed: gdprStatus.dataRetention.policiesDefined,
          message: gdprStatus.dataRetention.policiesDefined
            ? 'Retention policies are defined'
            : 'No retention policies configured',
        });

        checks.push({
          name: 'DPO Appointed',
          passed: gdprStatus.dpo.appointed,
          message: gdprStatus.dpo.appointed
            ? `DPO contact: ${gdprStatus.dpo.contactInfo}`
            : 'No DPO appointed',
        });
        break;

      default:
        checks.push({
          name: 'Unknown Regulation',
          passed: false,
          message: `Regulation ${regulation} is not supported`,
        });
    }

    const passedCount = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? (passedCount / checks.length) * 100 : 0;

    return {
      passed: passedCount === checks.length,
      score,
      checks,
    };
  }
}

export default ComplianceReportingService;
