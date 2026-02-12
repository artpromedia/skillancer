// @ts-nocheck
/**
 * Executive SkillPod Service
 *
 * Manages SkillPod sessions for executive engagements, including
 * session creation, time tracking integration, and access control.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// Types
export interface ExecutiveSessionConfig {
  engagementId: string;
  executiveId: string;
  workspaceId: string;
  accessLevel: 'ADMIN' | 'DEVELOPER' | 'VIEWER' | 'CUSTOM';
  clientTenantId: string;
  allowedResources?: string[];
  restrictedActions?: string[];
}

export interface ExecutiveSession {
  sessionId: string;
  sessionUrl: string;
  engagementId: string;
  executiveId: string;
  workspaceId: string;
  status: 'initializing' | 'ready' | 'active' | 'paused' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  durationMinutes?: number;
  accessLevel: string;
}

class ExecutiveSkillPodService {
  /**
   * Create a new SkillPod session for an executive engagement
   */
  async createSession(config: ExecutiveSessionConfig): Promise<ExecutiveSession> {
    logger.info('Creating executive SkillPod session', {
      engagementId: config.engagementId,
      executiveId: config.executiveId,
    });

    // Validate engagement
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: config.engagementId },
      include: {
        workspace: true,
      },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    if (engagement.executiveId !== config.executiveId) {
      throw new Error('Access denied');
    }

    if (engagement.status !== 'ACTIVE') {
      throw new Error('Engagement must be active to launch SkillPod');
    }

    if (!engagement.workspace?.skillpodEnabled) {
      throw new Error('SkillPod is not enabled for this workspace');
    }

    // Generate session ID and URL
    const sessionId = crypto.randomUUID();
    const sessionUrl = this.generateSessionUrl(sessionId, config);

    // Create session record (would normally be stored in database)
    const session: ExecutiveSession = {
      sessionId,
      sessionUrl,
      engagementId: config.engagementId,
      executiveId: config.executiveId,
      workspaceId: config.workspaceId,
      status: 'ready',
      startedAt: new Date(),
      accessLevel: config.accessLevel,
    };

    // Update workspace with active session
    await prisma.executiveWorkspace.update({
      where: { id: config.workspaceId },
      data: {
        skillpodSessionId: sessionId,
      },
    });

    logger.info('Executive SkillPod session created', {
      sessionId,
      engagementId: config.engagementId,
    });

    return session;
  }

  /**
   * End a SkillPod session and sync time
   */
  async endSession(
    sessionId: string,
    executiveId: string
  ): Promise<{ duration: number; timeEntrySynced: boolean }> {
    // Would normally fetch session from database
    const session = await this.getSessionById(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.executiveId !== executiveId) {
      throw new Error('Access denied');
    }

    const endedAt = new Date();
    const durationMinutes = Math.round(
      (endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60)
    );

    // Clear session from workspace
    const workspace = await prisma.executiveWorkspace.findFirst({
      where: { skillpodSessionId: sessionId },
    });

    if (workspace) {
      await prisma.executiveWorkspace.update({
        where: { id: workspace.id },
        data: {
          skillpodSessionId: null,
        },
      });
    }

    // Auto-create time entry if session was significant (> 5 minutes)
    let timeEntrySynced = false;
    if (durationMinutes >= 5) {
      try {
        await this.syncSessionTime(session.engagementId, executiveId, {
          sessionId,
          duration: durationMinutes,
          date: session.startedAt,
        });
        timeEntrySynced = true;
      } catch (error) {
        logger.warn('Failed to sync session time', { sessionId, error });
      }
    }

    logger.info('Executive SkillPod session ended', {
      sessionId,
      durationMinutes,
      timeEntrySynced,
    });

    return { duration: durationMinutes, timeEntrySynced };
  }

  /**
   * Sync session time to time tracking
   */
  private async syncSessionTime(
    engagementId: string,
    executiveId: string,
    sessionData: { sessionId: string; duration: number; date: Date }
  ): Promise<void> {
    const hours = Math.round((sessionData.duration / 60) * 100) / 100; // Round to 2 decimals

    await prisma.executiveTimeEntry.create({
      data: {
        engagementId,
        executiveId,
        date: sessionData.date,
        hours,
        description: `SkillPod session (auto-tracked)`,
        category: 'EXECUTION',
        billable: true,
        status: 'PENDING',
        skillpodSessionId: sessionData.sessionId,
      },
    });

    // Update engagement totals
    await prisma.executiveEngagement.update({
      where: { id: engagementId },
      data: {
        totalHoursLogged: { increment: hours },
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Get active session for engagement
   */
  async getActiveSession(engagementId: string): Promise<ExecutiveSession | null> {
    const workspace = await prisma.executiveWorkspace.findUnique({
      where: { engagementId },
    });

    if (!workspace?.skillpodSessionId) {
      return null;
    }

    return this.getSessionById(workspace.skillpodSessionId);
  }

  /**
   * Generate session URL with security tokens
   */
  private generateSessionUrl(sessionId: string, config: ExecutiveSessionConfig): string {
    const baseUrl = process.env.SKILLPOD_URL || 'https://skillpod.skillancer.dev';

    // In production, this would include signed tokens for authentication
    const params = new URLSearchParams({
      session: sessionId,
      engagement: config.engagementId,
      access: config.accessLevel,
    });

    return `${baseUrl}/session/${sessionId}?${params.toString()}`;
  }

  /**
   * Get session by ID
   * In production, this would fetch from database
   */
  private async getSessionById(sessionId: string): Promise<ExecutiveSession | null> {
    // Mock implementation - would normally query database
    return null;
  }

  /**
   * Get session history for engagement
   */
  async getSessionHistory(engagementId: string, limit = 10): Promise<ExecutiveSession[]> {
    // Would query session history from database
    return [];
  }

  /**
   * Check if executive has active session anywhere
   */
  async hasActiveSession(executiveId: string): Promise<boolean> {
    const activeWorkspace = await prisma.executiveWorkspace.findFirst({
      where: {
        engagement: { executiveId },
        skillpodSessionId: { not: null },
      },
    });

    return !!activeWorkspace;
  }
}

export const executiveSkillPodService = new ExecutiveSkillPodService();
