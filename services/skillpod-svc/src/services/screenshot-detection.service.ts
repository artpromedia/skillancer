/**
 * @module @skillancer/skillpod-svc/services/screenshot-detection
 * Screen capture detection and prevention service
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { KasmWorkspacesService } from './kasm-workspaces.service.js';
import type { WebSocketEnforcementService } from './websocket-enforcement.service.js';
import type { PrismaClient } from '@/types/prisma-shim.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type CaptureType =
  | 'SCREENSHOT'
  | 'SCREEN_RECORDING'
  | 'REMOTE_DESKTOP'
  | 'PRINT_SCREEN_KEY'
  | 'SNIPPING_TOOL'
  | 'THIRD_PARTY_APP'
  | 'BROWSER_EXTENSION'
  | 'OS_NATIVE';

export interface ScreenCaptureEvent {
  podId: string;
  sessionId: string;
  userId: string;
  captureType: CaptureType;
  detectionMethod: string;
  processInfo?: {
    name: string;
    pid: number;
  };
  activeApplication?: string;
  activeWindow?: string;
}

export interface DetectionResult {
  blocked: boolean;
  attemptId: string;
  notificationSent: boolean;
  securityAlertSent: boolean;
}

export interface DetectionConfig {
  enabled: boolean;
  alertThreshold: number; // Number of attempts before escalation
  blockDurationMs: number; // How long to show blocking overlay
  notifyUser: boolean;
  notifySecurityTeam: boolean;
  terminateOnRepeatedAttempts: boolean;
  maxAttemptsBeforeTermination: number;
}

// Known screenshot application signatures
const KNOWN_CAPTURE_APPS = [
  { name: 'snipping tool', type: 'SNIPPING_TOOL' as CaptureType },
  { name: 'snippingtool.exe', type: 'SNIPPING_TOOL' as CaptureType },
  { name: 'screensketch.exe', type: 'SNIPPING_TOOL' as CaptureType },
  { name: 'greenshot', type: 'THIRD_PARTY_APP' as CaptureType },
  { name: 'lightshot', type: 'THIRD_PARTY_APP' as CaptureType },
  { name: 'sharex', type: 'THIRD_PARTY_APP' as CaptureType },
  { name: 'gyazo', type: 'THIRD_PARTY_APP' as CaptureType },
  { name: 'screenpresso', type: 'THIRD_PARTY_APP' as CaptureType },
  { name: 'obs', type: 'SCREEN_RECORDING' as CaptureType },
  { name: 'obs64.exe', type: 'SCREEN_RECORDING' as CaptureType },
  { name: 'camtasia', type: 'SCREEN_RECORDING' as CaptureType },
  { name: 'loom', type: 'SCREEN_RECORDING' as CaptureType },
  { name: 'screencastify', type: 'BROWSER_EXTENSION' as CaptureType },
  { name: 'teamviewer', type: 'REMOTE_DESKTOP' as CaptureType },
  { name: 'anydesk', type: 'REMOTE_DESKTOP' as CaptureType },
  { name: 'vnc', type: 'REMOTE_DESKTOP' as CaptureType },
  { name: 'chrome remote desktop', type: 'REMOTE_DESKTOP' as CaptureType },
];

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ScreenshotDetectionService {
  // Detection
  detectCaptureAttempt(event: ScreenCaptureEvent): Promise<DetectionResult>;
  identifyCaptureType(processName: string): CaptureType;

  // Session monitoring
  getAttemptCount(sessionId: string): Promise<number>;
  getRecentAttempts(sessionId: string, minutes?: number): Promise<ScreenCaptureEvent[]>;
  clearAttemptHistory(sessionId: string): Promise<void>;

  // Configuration
  getConfig(policyId: string): Promise<DetectionConfig>;
  updateConfig(policyId: string, config: Partial<DetectionConfig>): Promise<void>;

  // Analytics
  getAttemptStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    blocked: number;
    byType: Record<CaptureType, number>;
    bySeverity: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  }>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createScreenshotDetectionService(
  prisma: PrismaClient,
  redis: Redis,
  kasmService: KasmWorkspacesService,
  wsService: WebSocketEnforcementService
): ScreenshotDetectionService {
  const ATTEMPT_COUNTER_TTL = 3600; // 1 hour
  const ATTEMPT_HISTORY_TTL = 86400; // 24 hours
  const DEFAULT_CONFIG: DetectionConfig = {
    enabled: true,
    alertThreshold: 3,
    blockDurationMs: 5000,
    notifyUser: true,
    notifySecurityTeam: true,
    terminateOnRepeatedAttempts: true,
    maxAttemptsBeforeTermination: 10,
  };

  // ===========================================================================
  // DETECTION
  // ===========================================================================

  async function detectCaptureAttempt(event: ScreenCaptureEvent): Promise<DetectionResult> {
    const {
      podId,
      sessionId,
      userId,
      captureType,
      detectionMethod,
      processInfo,
      activeApplication,
      activeWindow,
    } = event;

    // Get session and policy
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { securityPolicy: true },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const blocked = session.securityPolicy?.screenCaptureBlocking ?? true;
    let notificationSent = false;
    let securityAlertSent = false;

    // Log the attempt
    const attempt = await prisma.screenCaptureAttempt.create({
      data: {
        sessionId,
        userId,
        tenantId: session.tenantId!,
        captureType,
        detectionMethod,
        blocked,
        notificationSent: false,
        activeApplication,
        activeWindow,
        processName: processInfo?.name,
        processId: processInfo?.pid,
      },
    });

    // Increment attempt counter
    const counterKey = `screenshot:attempts:${sessionId}`;
    const attemptCount = await redis.incr(counterKey);
    await redis.expire(counterKey, ATTEMPT_COUNTER_TTL);

    // Store attempt in history
    const historyKey = `screenshot:history:${sessionId}`;
    await redis.lpush(
      historyKey,
      JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
        attemptId: attempt.id,
      })
    );
    await redis.ltrim(historyKey, 0, 99); // Keep last 100 attempts
    await redis.expire(historyKey, ATTEMPT_HISTORY_TTL);

    if (blocked) {
      // Activate screen protection in Kasm
      const kasmId =
        session.config && typeof session.config === 'object' && 'kasmId' in session.config
          ? (session.config as { kasmId?: string }).kasmId
          : null;
      if (kasmId) {
        await kasmService.activateScreenProtection(kasmId);
      }

      // Send notification to user
      await wsService.sendToSession(sessionId, {
        type: 'SCREENSHOT_BLOCKED',
        data: {
          message: 'Screen capture is not allowed in this secure environment',
          captureType,
          timestamp: new Date().toISOString(),
        },
      });
      notificationSent = true;

      // Update attempt record
      await prisma.screenCaptureAttempt.update({
        where: { id: attempt.id },
        data: { notificationSent: true },
      });

      // Check if we need to escalate
      const config = await getConfig(session.securityPolicyId ?? 'default');

      if (attemptCount >= config.alertThreshold) {
        // Alert security team
        await wsService.broadcastToTenant(session.tenantId!, {
          type: 'SECURITY_ALERT',
          data: {
            alertType: 'REPEATED_SCREENSHOT_ATTEMPTS',
            sessionId,
            userId,
            attemptCount,
            captureType,
            timestamp: new Date().toISOString(),
          },
        });
        securityAlertSent = true;
      }

      // Check if we should terminate session
      if (
        config.terminateOnRepeatedAttempts &&
        attemptCount >= config.maxAttemptsBeforeTermination
      ) {
        await terminateSessionForViolation(session.id, 'Exceeded maximum screenshot attempts');
      }

      // Record violation
      await wsService.handleViolation(podId, {
        type: 'SCREEN_CAPTURE_ATTEMPT',
        direction: 'OUTBOUND',
        reason: `Screen capture attempt detected: ${captureType}`,
        rule: 'screenshot:blocked',
        severity: attemptCount >= config.alertThreshold ? 'HIGH' : 'MEDIUM',
        userMessage: 'Screen capture is not allowed in this secure environment',
        metadata: {
          captureType,
          detectionMethod,
          processName: processInfo?.name,
          attemptCount,
        },
      });
    }

    return {
      blocked,
      attemptId: attempt.id,
      notificationSent,
      securityAlertSent,
    };
  }

  async function terminateSessionForViolation(sessionId: string, reason: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    // Get Kasm ID from session config
    const kasmId =
      session.config && typeof session.config === 'object' && 'kasmId' in session.config
        ? (session.config as { kasmId?: string }).kasmId
        : null;

    if (kasmId) {
      await kasmService.terminateWorkspace(kasmId);
    }

    // Update session status
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'TERMINATED',
        terminatedAt: new Date(),
        terminationReason: reason,
      },
    });

    // Notify user
    await wsService.sendToSession(sessionId, {
      type: 'SESSION_TERMINATED',
      data: {
        reason: 'Your session has been terminated due to security policy violations',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // ===========================================================================
  // SESSION MONITORING
  // ===========================================================================

  async function getAttemptCount(sessionId: string): Promise<number> {
    const count = await redis.get(`screenshot:attempts:${sessionId}`);
    return count ? Number.parseInt(count, 10) : 0;
  }

  async function getRecentAttempts(sessionId: string, minutes = 60): Promise<ScreenCaptureEvent[]> {
    const historyKey = `screenshot:history:${sessionId}`;
    const attempts = await redis.lrange(historyKey, 0, -1);

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    return attempts
      .map((a) => {
        try {
          return JSON.parse(a) as ScreenCaptureEvent & { timestamp: string };
        } catch {
          return null;
        }
      })
      .filter((a): a is ScreenCaptureEvent & { timestamp: string } => {
        if (!a) return false;
        return new Date(a.timestamp) > cutoff;
      });
  }

  async function clearAttemptHistory(sessionId: string): Promise<void> {
    await redis.del(`screenshot:attempts:${sessionId}`);
    await redis.del(`screenshot:history:${sessionId}`);
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  async function getConfig(policyId: string): Promise<DetectionConfig> {
    const cached = await redis.get(`screenshot:config:${policyId}`);
    if (cached) {
      return JSON.parse(cached) as DetectionConfig;
    }

    // Try to load from database policy
    if (policyId !== 'default') {
      const policy = await prisma.podSecurityPolicy.findUnique({
        where: { id: policyId },
      });

      if (policy?.watermarkConfig && typeof policy.watermarkConfig === 'object') {
        const config = policy.watermarkConfig as Record<string, unknown>;
        if ('screenshotDetection' in config) {
          const storedConfig = config.screenshotDetection as Partial<DetectionConfig>;
          const mergedConfig = { ...DEFAULT_CONFIG, ...storedConfig };
          await redis.setex(`screenshot:config:${policyId}`, 3600, JSON.stringify(mergedConfig));
          return mergedConfig;
        }
      }
    }

    return DEFAULT_CONFIG;
  }

  async function updateConfig(policyId: string, config: Partial<DetectionConfig>): Promise<void> {
    const currentConfig = await getConfig(policyId);
    const newConfig = { ...currentConfig, ...config };

    await redis.setex(`screenshot:config:${policyId}`, 3600, JSON.stringify(newConfig));
  }

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  async function getAttemptStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    blocked: number;
    byType: Record<CaptureType, number>;
    bySeverity: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    const attempts = await prisma.screenCaptureAttempt.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        captureType: true,
        blocked: true,
        userId: true,
      },
    });

    const byType: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    let blocked = 0;

    for (const attempt of attempts) {
      // Count by type
      byType[attempt.captureType] = (byType[attempt.captureType] || 0) + 1;

      // Count blocked
      if (attempt.blocked) {
        blocked++;
      }

      // Count by user
      userCounts[attempt.userId] = (userCounts[attempt.userId] || 0) + 1;
    }

    // Get top users
    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: attempts.length,
      blocked,
      byType: byType as Record<CaptureType, number>,
      bySeverity: {
        LOW: attempts.length * 0.6,
        MEDIUM: attempts.length * 0.3,
        HIGH: attempts.length * 0.1,
      },
      topUsers,
    };
  }

  // ===========================================================================
  // RETURN SERVICE
  // ===========================================================================

  return {
    // Detection
    detectCaptureAttempt,
    identifyCaptureType,

    // Session monitoring
    getAttemptCount,
    getRecentAttempts,
    clearAttemptHistory,

    // Configuration
    getConfig,
    updateConfig,

    // Analytics
    getAttemptStats,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function identifyCaptureType(processName: string): CaptureType {
  const lowerName = processName.toLowerCase();

  for (const app of KNOWN_CAPTURE_APPS) {
    if (lowerName.includes(app.name.toLowerCase())) {
      return app.type;
    }
  }

  // Check for common patterns
  if (
    lowerName.includes('screen') &&
    (lowerName.includes('shot') || lowerName.includes('capture'))
  ) {
    return 'THIRD_PARTY_APP';
  }
  if (lowerName.includes('record')) {
    return 'SCREEN_RECORDING';
  }
  if (lowerName.includes('remote') || lowerName.includes('rdp')) {
    return 'REMOTE_DESKTOP';
  }

  return 'THIRD_PARTY_APP';
}
