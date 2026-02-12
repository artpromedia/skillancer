// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/realtime/event-broadcaster
 * Event Broadcaster Service
 *
 * Broadcasts events to connected WebSocket clients:
 * - Widget data updates
 * - Integration status changes
 * - Sync completion notifications
 * - Error broadcasts
 */

import { logger } from '@skillancer/logger';
import { websocketServer, type WebSocketMessage, type MessageType } from './websocket-server.js';

interface BroadcastRecord {
  channel: string;
  type: MessageType;
  timestamp: number;
}

interface ThrottleConfig {
  maxPerSecond: number;
  windowMs: number;
}

export class EventBroadcaster {
  private recentBroadcasts: BroadcastRecord[] = [];
  private pendingBroadcasts: Map<string, NodeJS.Timeout> = new Map();

  private readonly DEFAULT_THROTTLE: ThrottleConfig = {
    maxPerSecond: 1,
    windowMs: 1000,
  };

  private readonly DEDUP_WINDOW_MS = 500; // 500ms deduplication window

  /**
   * Broadcast widget data update
   */
  broadcastWidgetUpdate(
    workspaceId: string,
    integrationId: string,
    widgetId: string,
    data: unknown,
    options?: { throttle?: boolean }
  ): void {
    const channel = `widget:${workspaceId}:${widgetId}`;
    const workspaceChannel = `workspace:${workspaceId}`;

    const message = {
      type: 'WIDGET_DATA_UPDATE' as MessageType,
      channel,
      payload: {
        integrationId,
        widgetId,
        data,
      },
    };

    if (options?.throttle !== false) {
      this.throttledBroadcast(channel, message);
    } else {
      this.broadcast(channel, message);
    }

    // Also broadcast to workspace channel for dashboard updates
    websocketServer.broadcast(workspaceChannel, {
      type: 'WIDGET_DATA_UPDATE',
      channel: workspaceChannel,
      payload: { integrationId, widgetId, hasUpdate: true },
    });
  }

  /**
   * Broadcast integration status change
   */
  broadcastIntegrationStatus(
    workspaceId: string,
    integrationId: string,
    status: 'connected' | 'disconnected' | 'error' | 'syncing' | 'rate_limited',
    details?: Record<string, unknown>
  ): void {
    const channel = `integration:${workspaceId}:${integrationId}`;
    const workspaceChannel = `workspace:${workspaceId}`;

    const message = {
      type: 'INTEGRATION_STATUS' as MessageType,
      channel,
      payload: {
        integrationId,
        status,
        ...details,
      },
    };

    this.broadcast(channel, message);
    websocketServer.broadcast(workspaceChannel, message);

    logger.info('Integration status broadcast', { integrationId, status });
  }

  /**
   * Broadcast sync completion
   */
  broadcastSyncComplete(
    workspaceId: string,
    integrationId: string,
    result: {
      success: boolean;
      widgetsUpdated: string[];
      duration: number;
      error?: string;
    }
  ): void {
    const channel = `integration:${workspaceId}:${integrationId}`;
    const workspaceChannel = `workspace:${workspaceId}`;

    const message = {
      type: 'SYNC_COMPLETE' as MessageType,
      channel,
      payload: {
        integrationId,
        ...result,
      },
    };

    this.broadcast(channel, message);
    websocketServer.broadcast(workspaceChannel, message);

    logger.info('Sync complete broadcast', { integrationId, success: result.success });
  }

  /**
   * Broadcast error
   */
  broadcastError(
    workspaceId: string,
    error: {
      integrationId?: string;
      widgetId?: string;
      code: string;
      message: string;
      recoveryAction?: string;
      retryAfter?: number;
    }
  ): void {
    const workspaceChannel = `workspace:${workspaceId}`;

    const message = {
      type: 'ERROR' as MessageType,
      channel: workspaceChannel,
      payload: error,
    };

    this.broadcast(workspaceChannel, message);

    // Also broadcast to specific integration channel if applicable
    if (error.integrationId) {
      const integrationChannel = `integration:${workspaceId}:${error.integrationId}`;
      this.broadcast(integrationChannel, message);
    }

    logger.warn('Error broadcast', { workspaceId, error: error.code });
  }

  /**
   * Broadcast to user directly
   */
  broadcastToUser(userId: string, type: MessageType, payload: unknown): void {
    websocketServer.sendToUser(userId, {
      type,
      channel: `user:${userId}`,
      payload,
    });
  }

  // ==================== Internal Methods ====================

  /**
   * Broadcast with deduplication
   */
  private broadcast(channel: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    // Check for duplicate
    if (this.isDuplicate(channel, message.type)) {
      logger.debug('Skipping duplicate broadcast', { channel, type: message.type });
      return;
    }

    // Record broadcast
    this.recordBroadcast(channel, message.type);

    // Send
    websocketServer.broadcast(channel, message);
  }

  /**
   * Throttled broadcast - delays and deduplicates rapid updates
   */
  private throttledBroadcast(channel: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const key = `${channel}:${message.type}`;

    // Cancel pending broadcast for same channel/type
    const existing = this.pendingBroadcasts.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule broadcast
    const timeout = setTimeout(() => {
      this.pendingBroadcasts.delete(key);
      this.broadcast(channel, message);
    }, this.DEFAULT_THROTTLE.windowMs);

    this.pendingBroadcasts.set(key, timeout);
  }

  /**
   * Check if broadcast is duplicate
   */
  private isDuplicate(channel: string, type: MessageType): boolean {
    const now = Date.now();
    const cutoff = now - this.DEDUP_WINDOW_MS;

    // Clean old records
    this.recentBroadcasts = this.recentBroadcasts.filter((r) => r.timestamp > cutoff);

    // Check for duplicate
    return this.recentBroadcasts.some((r) => r.channel === channel && r.type === type);
  }

  /**
   * Record broadcast for deduplication
   */
  private recordBroadcast(channel: string, type: MessageType): void {
    this.recentBroadcasts.push({
      channel,
      type,
      timestamp: Date.now(),
    });

    // Limit array size
    if (this.recentBroadcasts.length > 1000) {
      this.recentBroadcasts = this.recentBroadcasts.slice(-500);
    }
  }

  /**
   * Flush all pending broadcasts
   */
  flushPending(): void {
    for (const [key, timeout] of this.pendingBroadcasts) {
      clearTimeout(timeout);
    }
    this.pendingBroadcasts.clear();
  }
}

// Singleton instance
export const eventBroadcaster = new EventBroadcaster();
