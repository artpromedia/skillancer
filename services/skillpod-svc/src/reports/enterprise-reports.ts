// @ts-nocheck
/**
 * Enterprise Reports Service
 * Generates comprehensive reports for B2B customers
 * Usage, security, compliance, and executive dashboards
 */

import { prisma } from '@skillancer/database';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';

const logger = getLogger('enterprise-reports');
const audit = getAuditClient();

// =============================================================================
// TYPES
// =============================================================================

export type ReportType =
  | 'usage'
  | 'security'
  | 'compliance'
  | 'executive'
  | 'user_activity'
  | 'session_analytics'
  | 'cost_analysis';

export type ReportFormat = 'json' | 'csv' | 'pdf' | 'xlsx';

export type DateRange = {
  start: Date;
  end: Date;
};

export interface ReportRequest {
  tenantId: string;
  reportType: ReportType;
  dateRange: DateRange;
  format?: ReportFormat;
  filters?: Record<string, any>;
  requestedBy: string;
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: DateRange;
  generatedAt: Date;
  expiresAt: Date;
  downloadUrl?: string;
  data?: any;
  metadata: {
    recordCount: number;
    generationTimeMs: number;
    filters?: Record<string, any>;
  };
}

// Usage Report Types
export interface UsageReport {
  summary: {
    totalSessions: number;
    totalSessionMinutes: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    peakConcurrentSessions: number;
  };
  dailyUsage: Array<{
    date: string;
    sessions: number;
    users: number;
    minutes: number;
  }>;
  userBreakdown: Array<{
    userId: string;
    email: string;
    sessions: number;
    totalMinutes: number;
    avgDuration: number;
  }>;
  topApplications: Array<{
    name: string;
    sessions: number;
    minutes: number;
  }>;
}

// Security Report Types
export interface SecurityReport {
  summary: {
    totalSecurityEvents: number;
    criticalAlerts: number;
    policiesTriggered: number;
    blockedAttempts: number;
    suspiciousActivities: number;
  };
  eventsByCategory: Array<{
    category: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  topRiskyUsers: Array<{
    userId: string;
    email: string;
    riskScore: number;
    incidents: number;
  }>;
  policyViolations: Array<{
    policyId: string;
    policyName: string;
    violations: number;
    affectedUsers: number;
  }>;
  geoBreakdown: Array<{
    country: string;
    city?: string;
    sessions: number;
    flagged: number;
  }>;
}

// Compliance Report Types
export interface ComplianceReport {
  summary: {
    overallScore: number;
    controlsTotal: number;
    controlsPassing: number;
    controlsFailing: number;
    openFindings: number;
  };
  frameworkStatus: Array<{
    framework: string;
    status: 'compliant' | 'partial' | 'non_compliant';
    score: number;
    lastAssessment: string;
  }>;
  controls: Array<{
    controlId: string;
    controlName: string;
    framework: string;
    status: 'passing' | 'failing' | 'not_assessed';
    evidence: string[];
    lastChecked: string;
  }>;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
    resource: string;
    details: string;
  }>;
}

// Executive Report Types
export interface ExecutiveReport {
  overview: {
    activeUsers: number;
    userGrowth: number;
    totalSessions: number;
    sessionGrowth: number;
    securityScore: number;
    complianceScore: number;
  };
  keyMetrics: {
    avgDailyActiveUsers: number;
    avgSessionsPerUser: number;
    avgSessionDuration: number;
    costPerUser: number;
    roiIndicator: number;
  };
  trends: {
    userAdoption: Array<{ date: string; users: number }>;
    sessionTrend: Array<{ date: string; sessions: number }>;
    securityTrend: Array<{ date: string; incidents: number }>;
  };
  highlights: string[];
  recommendations: string[];
}

// =============================================================================
// REPORT SERVICE
// =============================================================================

class EnterpriseReportsService {
  /**
   * Generate a report based on type
   */
  async generateReport(request: ReportRequest): Promise<GeneratedReport> {
    const startTime = Date.now();
    const format = request.format || 'json';

    logger.info('Generating enterprise report', {
      tenantId: request.tenantId,
      type: request.reportType,
      dateRange: request.dateRange,
    });

    await audit.log({
      action: 'report.generate',
      actorId: request.requestedBy,
      resource: 'report',
      resourceId: request.reportType,
      tenantId: request.tenantId,
      metadata: { dateRange: request.dateRange },
    });

    let data: any;

    switch (request.reportType) {
      case 'usage':
        data = await this.generateUsageReport(request.tenantId, request.dateRange, request.filters);
        break;
      case 'security':
        data = await this.generateSecurityReport(
          request.tenantId,
          request.dateRange,
          request.filters
        );
        break;
      case 'compliance':
        data = await this.generateComplianceReport(request.tenantId, request.dateRange);
        break;
      case 'executive':
        data = await this.generateExecutiveReport(request.tenantId, request.dateRange);
        break;
      case 'user_activity':
        data = await this.generateUserActivityReport(
          request.tenantId,
          request.dateRange,
          request.filters
        );
        break;
      case 'session_analytics':
        data = await this.generateSessionAnalyticsReport(
          request.tenantId,
          request.dateRange,
          request.filters
        );
        break;
      case 'cost_analysis':
        data = await this.generateCostAnalysisReport(request.tenantId, request.dateRange);
        break;
      default:
        throw new Error(`Unknown report type: ${request.reportType}`);
    }

    const generationTimeMs = Date.now() - startTime;
    const recordCount = this.countRecords(data);

    // Store report metadata
    const reportRecord = await prisma.report.create({
      data: {
        tenantId: request.tenantId,
        type: request.reportType,
        format,
        dateRangeStart: request.dateRange.start,
        dateRangeEnd: request.dateRange.end,
        generatedBy: request.requestedBy,
        recordCount,
        generationTimeMs,
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // For non-JSON formats, convert and upload
    let downloadUrl: string | undefined;
    if (format !== 'json') {
      downloadUrl = await this.convertAndUpload(reportRecord.id, data, format, request.reportType);
    }

    logger.info('Report generated successfully', {
      reportId: reportRecord.id,
      type: request.reportType,
      recordCount,
      generationTimeMs,
    });

    return {
      id: reportRecord.id,
      type: request.reportType,
      format,
      dateRange: request.dateRange,
      generatedAt: reportRecord.createdAt,
      expiresAt: reportRecord.expiresAt,
      downloadUrl,
      data: format === 'json' ? data : undefined,
      metadata: {
        recordCount,
        generationTimeMs,
        filters: request.filters,
      },
    };
  }

  /**
   * Generate usage report
   */
  private async generateUsageReport(
    tenantId: string,
    dateRange: DateRange,
    filters?: Record<string, any>
  ): Promise<UsageReport> {
    // Get session data
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.policyId && { policyId: filters.policyId }),
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    // Calculate summary
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => {
      const duration = s.endedAt ? (s.endedAt.getTime() - s.createdAt.getTime()) / 60000 : 0;
      return sum + duration;
    }, 0);
    const uniqueUserIds = new Set(sessions.map((s) => s.userId));
    const avgDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;

    // Daily usage breakdown
    const dailyMap = new Map<string, { sessions: number; users: Set<string>; minutes: number }>();
    for (const session of sessions) {
      const date = session.createdAt.toISOString().split('T')[0];
      const entry = dailyMap.get(date) || { sessions: 0, users: new Set(), minutes: 0 };
      entry.sessions++;
      entry.users.add(session.userId);
      if (session.endedAt) {
        entry.minutes += (session.endedAt.getTime() - session.createdAt.getTime()) / 60000;
      }
      dailyMap.set(date, entry);
    }

    const dailyUsage = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        sessions: data.sessions,
        users: data.users.size,
        minutes: Math.round(data.minutes),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // User breakdown
    const userMap = new Map<string, { email: string; sessions: number; minutes: number }>();
    for (const session of sessions) {
      const entry = userMap.get(session.userId) || {
        email: session.user.email,
        sessions: 0,
        minutes: 0,
      };
      entry.sessions++;
      if (session.endedAt) {
        entry.minutes += (session.endedAt.getTime() - session.createdAt.getTime()) / 60000;
      }
      userMap.set(session.userId, entry);
    }

    const userBreakdown = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        email: data.email,
        sessions: data.sessions,
        totalMinutes: Math.round(data.minutes),
        avgDuration: data.sessions > 0 ? Math.round(data.minutes / data.sessions) : 0,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 20);

    // Peak concurrent sessions (simplified calculation)
    const peakConcurrent = await this.calculatePeakConcurrent(tenantId, dateRange);

    return {
      summary: {
        totalSessions,
        totalSessionMinutes: Math.round(totalMinutes),
        uniqueUsers: uniqueUserIds.size,
        avgSessionDuration: Math.round(avgDuration),
        peakConcurrentSessions: peakConcurrent,
      },
      dailyUsage,
      userBreakdown,
      topApplications: [], // Would come from session metadata
    };
  }

  /**
   * Generate security report
   */
  private async generateSecurityReport(
    tenantId: string,
    dateRange: DateRange,
    filters?: Record<string, any>
  ): Promise<SecurityReport> {
    // Get security events
    const securityEvents = await prisma.securityEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.category && { category: filters.category }),
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    // Calculate summary
    const criticalAlerts = securityEvents.filter((e) => e.severity === 'CRITICAL').length;
    const uniquePolicies = new Set(securityEvents.filter((e) => e.policyId).map((e) => e.policyId));
    const blockedAttempts = securityEvents.filter((e) => e.blocked).length;

    // Events by category
    const categoryMap = new Map<string, { count: number; maxSeverity: string }>();
    for (const event of securityEvents) {
      const entry = categoryMap.get(event.category) || { count: 0, maxSeverity: 'low' };
      entry.count++;
      // Update max severity
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      if (
        severityOrder.indexOf(event.severity.toLowerCase()) >
        severityOrder.indexOf(entry.maxSeverity)
      ) {
        entry.maxSeverity = event.severity.toLowerCase();
      }
      categoryMap.set(event.category, entry);
    }

    const eventsByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      severity: data.maxSeverity as 'low' | 'medium' | 'high' | 'critical',
    }));

    // Top risky users
    const userRiskMap = new Map<string, { email: string; incidents: number; riskScore: number }>();
    for (const event of securityEvents) {
      if (!event.userId) continue;
      const entry = userRiskMap.get(event.userId) || {
        email: event.user?.email || 'unknown',
        incidents: 0,
        riskScore: 0,
      };
      entry.incidents++;
      // Increment risk score based on severity
      const severityScores: Record<string, number> = { LOW: 1, MEDIUM: 3, HIGH: 5, CRITICAL: 10 };
      entry.riskScore += severityScores[event.severity] || 1;
      userRiskMap.set(event.userId, entry);
    }

    const topRiskyUsers = Array.from(userRiskMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    // Policy violations
    const policyViolations = await prisma.policyViolation.groupBy({
      by: ['policyId'],
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      _count: { id: true },
    });

    const policyData = await Promise.all(
      policyViolations.map(async (pv) => {
        const policy = await prisma.policy.findUnique({ where: { id: pv.policyId } });
        const affectedUsers = await prisma.policyViolation.findMany({
          where: { policyId: pv.policyId, tenantId },
          select: { userId: true },
          distinct: ['userId'],
        });
        return {
          policyId: pv.policyId,
          policyName: policy?.name || 'Unknown',
          violations: pv._count.id,
          affectedUsers: affectedUsers.length,
        };
      })
    );

    // Geo breakdown
    const geoBreakdown = await this.getGeoBreakdown(tenantId, dateRange);

    return {
      summary: {
        totalSecurityEvents: securityEvents.length,
        criticalAlerts,
        policiesTriggered: uniquePolicies.size,
        blockedAttempts,
        suspiciousActivities: securityEvents.filter((e) => e.suspicious).length,
      },
      eventsByCategory,
      topRiskyUsers,
      policyViolations: policyData,
      geoBreakdown,
    };
  }

  /**
   * Generate compliance report
   */
  private async generateComplianceReport(
    tenantId: string,
    dateRange: DateRange
  ): Promise<ComplianceReport> {
    // Get compliance controls for tenant
    const controls = await prisma.complianceControl.findMany({
      where: { tenantId },
      include: {
        framework: true,
        assessments: {
          where: { assessedAt: { gte: dateRange.start, lte: dateRange.end } },
          orderBy: { assessedAt: 'desc' },
          take: 1,
        },
      },
    });

    const passing = controls.filter((c) => c.assessments[0]?.status === 'PASSING').length;
    const failing = controls.filter((c) => c.assessments[0]?.status === 'FAILING').length;
    const overallScore = controls.length > 0 ? Math.round((passing / controls.length) * 100) : 0;

    // Open findings
    const openFindings = await prisma.complianceFinding.count({
      where: {
        tenantId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    // Framework status
    const frameworks = await prisma.complianceFramework.findMany({
      where: { tenantId },
    });

    const frameworkStatus = await Promise.all(
      frameworks.map(async (fw) => {
        const fwControls = controls.filter((c) => c.frameworkId === fw.id);
        const fwPassing = fwControls.filter((c) => c.assessments[0]?.status === 'PASSING').length;
        const score = fwControls.length > 0 ? Math.round((fwPassing / fwControls.length) * 100) : 0;

        return {
          framework: fw.name,
          status: score >= 90 ? 'compliant' : score >= 70 ? 'partial' : ('non_compliant' as const),
          score,
          lastAssessment: fw.lastAssessedAt?.toISOString() || 'Never',
        };
      })
    );

    // Control details
    const controlDetails = controls.slice(0, 50).map((c) => ({
      controlId: c.id,
      controlName: c.name,
      framework: c.framework.name,
      status: (c.assessments[0]?.status || 'not_assessed').toLowerCase() as
        | 'passing'
        | 'failing'
        | 'not_assessed',
      evidence: c.assessments[0]?.evidence || [],
      lastChecked: c.assessments[0]?.assessedAt?.toISOString() || 'Never',
    }));

    // Audit trail
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        action: { contains: 'compliance' },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const auditTrail = auditLogs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      action: log.action,
      actor: log.actorId,
      resource: log.resourceType,
      details: log.details || '',
    }));

    return {
      summary: {
        overallScore,
        controlsTotal: controls.length,
        controlsPassing: passing,
        controlsFailing: failing,
        openFindings,
      },
      frameworkStatus,
      controls: controlDetails,
      auditTrail,
    };
  }

  /**
   * Generate executive dashboard report
   */
  private async generateExecutiveReport(
    tenantId: string,
    dateRange: DateRange
  ): Promise<ExecutiveReport> {
    // Current period metrics
    const currentPeriodDays = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Previous period for comparison
    const previousStart = new Date(
      dateRange.start.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000
    );
    const previousEnd = new Date(dateRange.start.getTime() - 1);

    // Current period data
    const currentUsers = await prisma.user.count({
      where: {
        tenantId,
        lastActiveAt: { gte: dateRange.start, lte: dateRange.end },
      },
    });

    const previousUsers = await prisma.user.count({
      where: {
        tenantId,
        lastActiveAt: { gte: previousStart, lte: previousEnd },
      },
    });

    const currentSessions = await prisma.session.count({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
    });

    const previousSessions = await prisma.session.count({
      where: {
        tenantId,
        createdAt: { gte: previousStart, lte: previousEnd },
      },
    });

    // Growth calculations
    const userGrowth =
      previousUsers > 0 ? Math.round(((currentUsers - previousUsers) / previousUsers) * 100) : 0;
    const sessionGrowth =
      previousSessions > 0
        ? Math.round(((currentSessions - previousSessions) / previousSessions) * 100)
        : 0;

    // Security and compliance scores
    const securityScore = await this.calculateSecurityScore(tenantId, dateRange);
    const complianceScore = await this.calculateComplianceScore(tenantId);

    // Key metrics
    const avgDailyActiveUsers = Math.round(currentUsers / currentPeriodDays);
    const avgSessionsPerUser = currentUsers > 0 ? Math.round(currentSessions / currentUsers) : 0;

    // Session duration
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        endedAt: { not: null },
      },
      select: { createdAt: true, endedAt: true },
    });

    const totalMinutes = sessions.reduce((sum, s) => {
      return sum + (s.endedAt!.getTime() - s.createdAt.getTime()) / 60000;
    }, 0);
    const avgSessionDuration = sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0;

    // Trends
    const userAdoption = await this.getUserAdoptionTrend(tenantId, dateRange);
    const sessionTrend = await this.getSessionTrend(tenantId, dateRange);
    const securityTrend = await this.getSecurityTrend(tenantId, dateRange);

    // Generate highlights and recommendations
    const highlights = this.generateHighlights(
      currentUsers,
      userGrowth,
      sessionGrowth,
      securityScore
    );
    const recommendations = this.generateRecommendations(
      userGrowth,
      securityScore,
      complianceScore
    );

    return {
      overview: {
        activeUsers: currentUsers,
        userGrowth,
        totalSessions: currentSessions,
        sessionGrowth,
        securityScore,
        complianceScore,
      },
      keyMetrics: {
        avgDailyActiveUsers,
        avgSessionsPerUser,
        avgSessionDuration,
        costPerUser: 0, // Would be calculated from billing
        roiIndicator: 0, // Would be calculated
      },
      trends: {
        userAdoption,
        sessionTrend,
        securityTrend,
      },
      highlights,
      recommendations,
    };
  }

  /**
   * Generate user activity report
   */
  private async generateUserActivityReport(
    tenantId: string,
    dateRange: DateRange,
    filters?: Record<string, any>
  ): Promise<any> {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        ...(filters?.departmentId && { departmentId: filters.departmentId }),
        ...(filters?.role && { role: filters.role }),
      },
      include: {
        sessions: {
          where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
        },
      },
    });

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastActiveAt: user.lastActiveAt,
        sessionCount: user.sessions.length,
        totalMinutes: user.sessions.reduce((sum, s) => {
          if (!s.endedAt) return sum;
          return sum + (s.endedAt.getTime() - s.createdAt.getTime()) / 60000;
        }, 0),
        firstSession: user.sessions.length > 0 ? user.sessions[0].createdAt : null,
        lastSession:
          user.sessions.length > 0 ? user.sessions[user.sessions.length - 1].createdAt : null,
      })),
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.sessions.length > 0).length,
        inactiveUsers: users.filter((u) => u.sessions.length === 0).length,
      },
    };
  }

  /**
   * Generate session analytics report
   */
  private async generateSessionAnalyticsReport(
    tenantId: string,
    dateRange: DateRange,
    filters?: Record<string, any>
  ): Promise<any> {
    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        ...(filters?.policyId && { policyId: filters.policyId }),
      },
      include: {
        user: { select: { id: true, email: true } },
        policy: { select: { id: true, name: true } },
      },
    });

    // Duration distribution
    const durationBuckets = {
      under_5min: 0,
      '5_15min': 0,
      '15_30min': 0,
      '30_60min': 0,
      over_60min: 0,
    };

    for (const session of sessions) {
      if (!session.endedAt) continue;
      const durationMinutes = (session.endedAt.getTime() - session.createdAt.getTime()) / 60000;
      if (durationMinutes < 5) durationBuckets['under_5min']++;
      else if (durationMinutes < 15) durationBuckets['5_15min']++;
      else if (durationMinutes < 30) durationBuckets['15_30min']++;
      else if (durationMinutes < 60) durationBuckets['30_60min']++;
      else durationBuckets['over_60min']++;
    }

    // Hourly distribution
    const hourlyDistribution = new Array(24).fill(0);
    for (const session of sessions) {
      const hour = session.createdAt.getHours();
      hourlyDistribution[hour]++;
    }

    // By policy
    const byPolicy = new Map<string, number>();
    for (const session of sessions) {
      const policyName = session.policy?.name || 'No Policy';
      byPolicy.set(policyName, (byPolicy.get(policyName) || 0) + 1);
    }

    return {
      summary: {
        totalSessions: sessions.length,
        completedSessions: sessions.filter((s) => s.endedAt).length,
        activeSessions: sessions.filter((s) => !s.endedAt).length,
        avgDuration: 0, // Calculate
      },
      durationDistribution: durationBuckets,
      hourlyDistribution: hourlyDistribution.map((count, hour) => ({ hour, count })),
      byPolicy: Array.from(byPolicy.entries()).map(([policy, count]) => ({ policy, count })),
    };
  }

  /**
   * Generate cost analysis report
   */
  private async generateCostAnalysisReport(tenantId: string, dateRange: DateRange): Promise<any> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: true,
      },
    });

    const sessions = await prisma.session.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
    });

    const userCount = await prisma.user.count({ where: { tenantId } });

    const totalMinutes = sessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      return sum + (s.endedAt.getTime() - s.createdAt.getTime()) / 60000;
    }, 0);

    // Cost assumptions (would come from billing config)
    const basePrice = tenant?.subscription?.pricePerMonth || 0;
    const costPerMinute = 0.02; // $0.02 per compute minute
    const computeCost = totalMinutes * costPerMinute;

    return {
      summary: {
        totalCost: basePrice + computeCost,
        licenseCost: basePrice,
        computeCost,
        userCount,
        costPerUser: userCount > 0 ? (basePrice + computeCost) / userCount : 0,
      },
      breakdown: {
        license: {
          amount: basePrice,
          description: 'Monthly subscription fee',
        },
        compute: {
          amount: computeCost,
          minutes: Math.round(totalMinutes),
          ratePerMinute: costPerMinute,
        },
      },
      projections: {
        monthlyEstimate:
          (basePrice + computeCost) *
          (30 /
            Math.max(
              1,
              Math.ceil(
                (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
              )
            )),
      },
    };
  }

  // =============================================================================
  // SCHEDULED REPORTS
  // =============================================================================

  /**
   * Schedule a recurring report
   */
  async scheduleReport(params: {
    tenantId: string;
    reportType: ReportType;
    frequency: 'daily' | 'weekly' | 'monthly';
    format: ReportFormat;
    recipients: string[];
    createdBy: string;
  }): Promise<{ id: string }> {
    const schedule = await prisma.reportSchedule.create({
      data: {
        tenantId: params.tenantId,
        reportType: params.reportType,
        frequency: params.frequency,
        format: params.format,
        recipients: params.recipients,
        createdBy: params.createdBy,
        nextRunAt: this.calculateNextRun(params.frequency),
        enabled: true,
      },
    });

    await audit.log({
      action: 'report.schedule.create',
      actorId: params.createdBy,
      resource: 'report_schedule',
      resourceId: schedule.id,
      tenantId: params.tenantId,
    });

    return { id: schedule.id };
  }

  /**
   * List scheduled reports
   */
  async listScheduledReports(tenantId: string): Promise<any[]> {
    const schedules = await prisma.reportSchedule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return schedules;
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(scheduleId: string, actorId: string): Promise<void> {
    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    await prisma.reportSchedule.delete({ where: { id: scheduleId } });

    await audit.log({
      action: 'report.schedule.delete',
      actorId,
      resource: 'report_schedule',
      resourceId: scheduleId,
      tenantId: schedule.tenantId,
    });
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private countRecords(data: any): number {
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && data !== null) {
      return Object.values(data).reduce((sum: number, val) => {
        return sum + this.countRecords(val);
      }, 0);
    }
    return 1;
  }

  private async convertAndUpload(
    reportId: string,
    data: any,
    format: ReportFormat,
    reportType: ReportType
  ): Promise<string> {
    // In production, this would convert to the appropriate format
    // and upload to S3/blob storage
    const fileName = `reports/${reportId}.${format}`;

    // Placeholder - would upload to S3
    logger.info('Converting and uploading report', { reportId, format, fileName });

    return `https://storage.example.com/${fileName}`;
  }

  private async calculatePeakConcurrent(tenantId: string, dateRange: DateRange): Promise<number> {
    // Simplified - would need more sophisticated calculation
    const activeSessions = await prisma.session.count({
      where: {
        tenantId,
        createdAt: { lte: dateRange.end },
        OR: [{ endedAt: null }, { endedAt: { gte: dateRange.start } }],
      },
    });
    return activeSessions;
  }

  private async getGeoBreakdown(tenantId: string, dateRange: DateRange): Promise<any[]> {
    // Would aggregate from session geo data
    return [];
  }

  private async calculateSecurityScore(tenantId: string, dateRange: DateRange): Promise<number> {
    const events = await prisma.securityEvent.count({
      where: {
        tenantId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    });
    // Simple scoring - fewer incidents = higher score
    return Math.max(0, 100 - events * 5);
  }

  private async calculateComplianceScore(tenantId: string): Promise<number> {
    const controls = await prisma.complianceControl.findMany({
      where: { tenantId },
      include: {
        assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      },
    });

    if (controls.length === 0) return 100;

    const passing = controls.filter((c) => c.assessments[0]?.status === 'PASSING').length;
    return Math.round((passing / controls.length) * 100);
  }

  private async getUserAdoptionTrend(tenantId: string, dateRange: DateRange): Promise<any[]> {
    // Simplified trend data
    return [];
  }

  private async getSessionTrend(tenantId: string, dateRange: DateRange): Promise<any[]> {
    // Simplified trend data
    return [];
  }

  private async getSecurityTrend(tenantId: string, dateRange: DateRange): Promise<any[]> {
    // Simplified trend data
    return [];
  }

  private generateHighlights(
    users: number,
    userGrowth: number,
    sessionGrowth: number,
    securityScore: number
  ): string[] {
    const highlights: string[] = [];

    if (userGrowth > 10) {
      highlights.push(`User adoption increased by ${userGrowth}% this period`);
    }
    if (sessionGrowth > 20) {
      highlights.push(`Session volume grew ${sessionGrowth}%, indicating strong engagement`);
    }
    if (securityScore >= 90) {
      highlights.push('Security posture remains excellent with minimal incidents');
    }
    if (users > 100) {
      highlights.push(`Platform now serving ${users} active users`);
    }

    return highlights;
  }

  private generateRecommendations(
    userGrowth: number,
    securityScore: number,
    complianceScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (userGrowth < 0) {
      recommendations.push('Consider user engagement initiatives to improve adoption');
    }
    if (securityScore < 80) {
      recommendations.push('Review security policies and address recent incidents');
    }
    if (complianceScore < 90) {
      recommendations.push('Focus on failing compliance controls to improve score');
    }

    return recommendations;
  }

  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let service: EnterpriseReportsService | null = null;

export function getEnterpriseReportsService(): EnterpriseReportsService {
  if (!service) {
    service = new EnterpriseReportsService();
  }
  return service;
}
