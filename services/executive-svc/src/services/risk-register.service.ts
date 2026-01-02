import { prisma } from '@skillancer/database';
import { EventEmitter } from 'events';

// Risk Register Service for CISO Suite
// Manages security risks, assessments, and mitigation tracking

export type RiskCategory =
  | 'OPERATIONAL'
  | 'TECHNICAL'
  | 'COMPLIANCE'
  | 'FINANCIAL'
  | 'REPUTATIONAL'
  | 'STRATEGIC';

export type RiskStatus = 'OPEN' | 'MITIGATING' | 'ACCEPTED' | 'TRANSFERRED' | 'CLOSED';

export interface RiskInput {
  title: string;
  description?: string;
  category: RiskCategory;
  likelihood: number; // 1-5
  impact: number; // 1-5
  ownerId?: string;
  mitigationPlan?: string;
  targetDate?: Date;
}

export interface RiskUpdate {
  title?: string;
  description?: string;
  category?: RiskCategory;
  likelihood?: number;
  impact?: number;
  status?: RiskStatus;
  ownerId?: string;
  mitigationPlan?: string;
  targetDate?: Date;
}

export interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  risks: Array<{ id: string; title: string; status: RiskStatus }>;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskSummary {
  total: number;
  byStatus: Record<RiskStatus, number>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
  averageScore: number;
  newThisPeriod: number;
}

class RiskRegisterService extends EventEmitter {
  // Add a new risk
  async addRisk(engagementId: string, risk: RiskInput) {
    const riskScore = this.calculateRiskScore(risk.likelihood, risk.impact);

    const created = await prisma.securityRisk.create({
      data: {
        engagementId,
        title: risk.title,
        description: risk.description,
        category: risk.category,
        likelihood: risk.likelihood,
        impact: risk.impact,
        riskScore,
        ownerId: risk.ownerId,
        mitigationPlan: risk.mitigationPlan,
        targetDate: risk.targetDate,
        status: 'OPEN',
      },
    });

    this.emit('risk:created', { engagementId, riskId: created.id });
    return created;
  }

  // Update a risk
  async updateRisk(riskId: string, updates: RiskUpdate) {
    // Recalculate score if likelihood or impact changed
    let riskScore: number | undefined;
    if (updates.likelihood !== undefined || updates.impact !== undefined) {
      const existing = await prisma.securityRisk.findUnique({ where: { id: riskId } });
      if (existing) {
        const likelihood = updates.likelihood ?? existing.likelihood;
        const impact = updates.impact ?? existing.impact;
        riskScore = this.calculateRiskScore(likelihood, impact);
      }
    }

    const updated = await prisma.securityRisk.update({
      where: { id: riskId },
      data: {
        ...updates,
        ...(riskScore !== undefined && { riskScore }),
      },
    });

    this.emit('risk:updated', { riskId, updates });
    return updated;
  }

  // Get all risks for an engagement
  async getRisks(
    engagementId: string,
    filters?: { status?: RiskStatus; category?: RiskCategory; minScore?: number }
  ) {
    return prisma.securityRisk.findMany({
      where: {
        engagementId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.minScore && { riskScore: { gte: filters.minScore } }),
      },
      orderBy: { riskScore: 'desc' },
    });
  }

  // Get a single risk
  async getRisk(riskId: string) {
    return prisma.securityRisk.findUnique({ where: { id: riskId } });
  }

  // Delete a risk
  async deleteRisk(riskId: string) {
    await prisma.securityRisk.delete({ where: { id: riskId } });
    this.emit('risk:deleted', { riskId });
  }

  // Get risk matrix data
  async getRiskMatrix(engagementId: string): Promise<RiskMatrixCell[][]> {
    const risks = await this.getRisks(engagementId);

    // Initialize 5x5 matrix
    const matrix: RiskMatrixCell[][] = [];
    for (let impact = 5; impact >= 1; impact--) {
      const row: RiskMatrixCell[] = [];
      for (let likelihood = 1; likelihood <= 5; likelihood++) {
        const cellRisks = risks.filter((r) => r.likelihood === likelihood && r.impact === impact);
        row.push({
          likelihood,
          impact,
          risks: cellRisks.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status as RiskStatus,
          })),
          count: cellRisks.length,
          severity: this.getSeverityLevel(likelihood, impact),
        });
      }
      matrix.push(row);
    }

    return matrix;
  }

  // Get top risks by score
  async getTopRisks(engagementId: string, limit = 5) {
    return prisma.securityRisk.findMany({
      where: {
        engagementId,
        status: { in: ['OPEN', 'MITIGATING'] },
      },
      orderBy: { riskScore: 'desc' },
      take: limit,
    });
  }

  // Get risk trend over time
  async getRiskTrend(
    engagementId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<Array<{ date: string; open: number; closed: number; score: number }>> {
    const risks = await prisma.securityRisk.findMany({
      where: {
        engagementId,
        createdAt: { lte: dateRange.end },
      },
    });

    // Group by week
    const weeks: Map<string, { open: number; closed: number; totalScore: number }> = new Map();
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      const weekKey = current.toISOString().split('T')[0];
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let open = 0;
      let closed = 0;
      let totalScore = 0;

      for (const risk of risks) {
        if (risk.createdAt <= weekEnd) {
          if (risk.status === 'CLOSED' && risk.updatedAt <= weekEnd) {
            closed++;
          } else {
            open++;
            totalScore += risk.riskScore;
          }
        }
      }

      weeks.set(weekKey, { open, closed, totalScore });
      current.setDate(current.getDate() + 7);
    }

    return Array.from(weeks.entries()).map(([date, data]) => ({
      date,
      open: data.open,
      closed: data.closed,
      score: data.open > 0 ? Math.round(data.totalScore / data.open) : 0,
    }));
  }

  // Get risk summary
  async getRiskSummary(engagementId: string): Promise<RiskSummary> {
    const risks = await this.getRisks(engagementId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const byStatus: Record<RiskStatus, number> = {
      OPEN: 0,
      MITIGATING: 0,
      ACCEPTED: 0,
      TRANSFERRED: 0,
      CLOSED: 0,
    };

    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    let totalScore = 0;
    let newThisPeriod = 0;

    for (const risk of risks) {
      byStatus[risk.status as RiskStatus]++;
      bySeverity[this.getSeverityLevel(risk.likelihood, risk.impact)]++;
      totalScore += risk.riskScore;

      if (risk.createdAt >= thirtyDaysAgo) {
        newThisPeriod++;
      }
    }

    return {
      total: risks.length,
      byStatus,
      bySeverity,
      averageScore: risks.length > 0 ? Math.round(totalScore / risks.length) : 0,
      newThisPeriod,
    };
  }

  // Generate risk report
  async generateRiskReport(engagementId: string) {
    const risks = await this.getRisks(engagementId);
    const summary = await this.getRiskSummary(engagementId);
    const topRisks = await this.getTopRisks(engagementId, 10);
    const matrix = await this.getRiskMatrix(engagementId);

    return {
      summary,
      topRisks,
      matrix,
      allRisks: risks,
      generatedAt: new Date(),
    };
  }

  // Calculate risk score (likelihood * impact)
  private calculateRiskScore(likelihood: number, impact: number): number {
    return Math.min(likelihood, 5) * Math.min(impact, 5);
  }

  // Get severity level from score
  private getSeverityLevel(
    likelihood: number,
    impact: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const score = this.calculateRiskScore(likelihood, impact);
    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }
}

export const riskRegisterService = new RiskRegisterService();
