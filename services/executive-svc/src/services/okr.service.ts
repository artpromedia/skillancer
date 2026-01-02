import { PrismaClient, OKRStatus } from '@prisma/client';

// OKR Service
// Manages objectives, key results, check-ins, and alignment

const prisma = new PrismaClient();

export interface CreateObjectiveInput {
  engagementId: string;
  title: string;
  description?: string;
  ownerId: string;
  timeframe: string;
  startDate?: Date;
  endDate?: Date;
  parentObjectiveId?: string;
}

export interface CreateKeyResultInput {
  objectiveId: string;
  title: string;
  description?: string;
  ownerId: string;
  targetValue: number;
  startValue?: number;
  unit: string;
  keyResultType: 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'BOOLEAN';
}

export interface OKRCheckInInput {
  objectiveId: string;
  userId: string;
  notes?: string;
  overallConfidence: number;
  keyResultUpdates?: Record<string, { value: number; confidence: number }>;
}

export class OKRService {
  // Create a new objective
  async createObjective(input: CreateObjectiveInput) {
    return prisma.objective.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        description: input.description,
        ownerId: input.ownerId,
        timeframe: input.timeframe,
        startDate: input.startDate,
        endDate: input.endDate,
        parentObjectiveId: input.parentObjectiveId,
        status: OKRStatus.NOT_STARTED,
        progress: 0,
      },
      include: {
        keyResults: true,
        parentObjective: { select: { id: true, title: true } },
      },
    });
  }

  // Get all objectives for an engagement
  async getObjectives(
    engagementId: string,
    options?: {
      timeframe?: string;
      ownerId?: string;
      status?: OKRStatus;
      includeChildren?: boolean;
    }
  ) {
    const where: Record<string, unknown> = { engagementId };

    if (options?.timeframe) where.timeframe = options.timeframe;
    if (options?.ownerId) where.ownerId = options.ownerId;
    if (options?.status) where.status = options.status;

    return prisma.objective.findMany({
      where,
      include: {
        keyResults: true,
        parentObjective: options?.includeChildren
          ? { select: { id: true, title: true } }
          : undefined,
        childObjectives: options?.includeChildren ? true : undefined,
        checkIns: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get single objective with full details
  async getObjective(id: string) {
    return prisma.objective.findUnique({
      where: { id },
      include: {
        keyResults: true,
        parentObjective: true,
        childObjectives: {
          include: {
            keyResults: true,
          },
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  // Update objective
  async updateObjective(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: OKRStatus;
      ownerId: string;
      endDate: Date;
    }>
  ) {
    const objective = await prisma.objective.update({
      where: { id },
      data,
      include: {
        keyResults: true,
      },
    });

    // Recalculate progress
    await this.recalculateObjectiveProgress(id);

    return objective;
  }

  // Delete objective
  async deleteObjective(id: string) {
    return prisma.objective.delete({ where: { id } });
  }

  // Create key result
  async createKeyResult(input: CreateKeyResultInput) {
    const keyResult = await prisma.keyResult.create({
      data: {
        objectiveId: input.objectiveId,
        title: input.title,
        description: input.description,
        ownerId: input.ownerId,
        targetValue: input.targetValue,
        startValue: input.startValue ?? 0,
        currentValue: input.startValue ?? 0,
        unit: input.unit,
        status: OKRStatus.NOT_STARTED,
        progress: 0,
      },
      include: {
        objective: { select: { id: true, title: true } },
      },
    });

    // Recalculate objective progress
    await this.recalculateObjectiveProgress(input.objectiveId);

    return keyResult;
  }

  // Update key result value
  async updateKeyResultValue(
    keyResultId: string,
    userId: string,
    data: {
      currentValue: number;
      confidence?: number;
      notes?: string;
    }
  ) {
    const keyResult = await prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    if (!keyResult) throw new Error('Key result not found');

    // Calculate progress
    const targetValue = Number(keyResult.targetValue);
    const startValue = Number(keyResult.startValue);
    const range = targetValue - startValue;
    const current = data.currentValue - startValue;
    const progress = range > 0 ? Math.min(100, Math.max(0, (current / range) * 100)) : 0;

    // Create update record
    await prisma.keyResultUpdate.create({
      data: {
        keyResultId,
        recordedBy: userId,
        previousValue: keyResult.currentValue,
        newValue: data.currentValue,
        notes: data.notes,
      },
    });

    // Update key result
    const updated = await prisma.keyResult.update({
      where: { id: keyResultId },
      data: {
        currentValue: data.currentValue,
        progress: Math.round(progress),
        status: this.calculateStatus(progress, data.confidence ?? 50),
      },
      include: {
        objective: { select: { id: true, title: true } },
      },
    });

    // Recalculate objective progress
    await this.recalculateObjectiveProgress(keyResult.objectiveId);

    return updated;
  }

  // Check-in on OKR
  async createCheckIn(input: OKRCheckInInput) {
    const objective = await prisma.objective.findUnique({
      where: { id: input.objectiveId },
    });

    if (!objective) throw new Error('Objective not found');

    // Create check-in record
    return prisma.oKRCheckIn.create({
      data: {
        objectiveId: input.objectiveId,
        createdBy: input.userId,
        notes: input.notes ?? '',
        confidence: input.overallConfidence,
        blockers: [],
        wins: [],
      },
      include: {
        objective: { select: { id: true, title: true } },
      },
    });
  }

  // Get OKR tree for alignment view
  async getOKRTree(engagementId: string, timeframe?: string) {
    const objectives = await prisma.objective.findMany({
      where: {
        engagementId,
        parentObjectiveId: null, // Get top-level objectives only
        ...(timeframe && { timeframe }),
      },
      include: {
        keyResults: true,
        childObjectives: {
          include: {
            keyResults: true,
            childObjectives: {
              include: {
                keyResults: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return objectives;
  }

  // Get OKR summary for widget
  async getOKRSummary(engagementId: string, timeframe?: string) {
    const objectives = await this.getObjectives(engagementId, { timeframe });

    const totalObjectives = objectives.length;
    const totalKeyResults = objectives.reduce((sum, o) => sum + o.keyResults.length, 0);

    const avgProgress =
      totalObjectives > 0
        ? Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / totalObjectives)
        : 0;

    const byStatus = {
      onTrack: objectives.filter((o) => o.status === OKRStatus.ON_TRACK).length,
      atRisk: objectives.filter((o) => o.status === OKRStatus.AT_RISK).length,
      behind: objectives.filter((o) => o.status === OKRStatus.BEHIND).length,
      completed: objectives.filter((o) => o.status === OKRStatus.ACHIEVED).length,
    };

    return {
      totalObjectives,
      totalKeyResults,
      avgProgress,
      byStatus,
      objectives: objectives.slice(0, 5).map((o) => ({
        id: o.id,
        title: o.title,
        progress: o.progress,
        status: o.status,
        keyResultsCount: o.keyResults.length,
      })),
    };
  }

  // Recalculate objective progress based on key results
  private async recalculateObjectiveProgress(objectiveId: string) {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: { keyResults: true },
    });

    if (!objective || objective.keyResults.length === 0) return;

    const avgProgress =
      objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0) / objective.keyResults.length;
    // Default confidence to 50 since KeyResult doesn't have confidence field
    const avgConfidence = 50;

    await prisma.objective.update({
      where: { id: objectiveId },
      data: {
        progress: Math.round(avgProgress),
        confidence: Math.round(avgConfidence),
        status: this.calculateStatus(avgProgress, avgConfidence),
      },
    });
  }

  // Calculate status based on progress and confidence
  private calculateStatus(progress: number, confidence: number): OKRStatus {
    if (progress >= 100) return OKRStatus.ACHIEVED;
    if (confidence >= 70 && progress >= 50) return OKRStatus.ON_TRACK;
    if (confidence >= 40 || progress >= 30) return OKRStatus.AT_RISK;
    return OKRStatus.BEHIND;
  }
}

export const okrService = new OKRService();
