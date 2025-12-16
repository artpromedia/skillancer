/**
 * @module @skillancer/skillpod-svc/services/websocket-enforcement
 * Real-time WebSocket-based policy enforcement for VDI sessions
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-require-imports */

import { EventEmitter } from 'events';

import type { ClipboardPolicy, NetworkPolicy, UsbPolicy } from '../types/containment.types.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface PolicyViolation {
  type: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  reason: string;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userMessage: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface PolicyEnforcementConfig {
  policyId: string;
  rules: {
    clipboard: ClipboardPolicy;
    fileTransfer: string;
    usb: UsbPolicy;
    screenshot: boolean;
    network?: NetworkPolicy;
  };
  onViolation: (violation: PolicyViolation) => Promise<void>;
}

export interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface SessionConnection {
  sessionId: string;
  podId: string;
  userId: string;
  connectedAt: Date;
  lastPing: Date;
  policyConfig?: PolicyEnforcementConfig;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface WebSocketEnforcementService {
  // Policy registration
  registerPolicyEnforcement(podId: string, config: PolicyEnforcementConfig): Promise<void>;
  unregisterPolicyEnforcement(podId: string): Promise<void>;
  getPolicyEnforcement(podId: string): PolicyEnforcementConfig | undefined;

  // Session messaging
  sendToSession(sessionId: string, message: WebSocketMessage): Promise<void>;
  sendToPod(podId: string, message: WebSocketMessage): Promise<void>;
  broadcastToTenant(tenantId: string, message: WebSocketMessage): Promise<void>;

  // Connection management
  registerConnection(connection: SessionConnection): Promise<void>;
  removeConnection(sessionId: string): Promise<void>;
  getConnection(sessionId: string): SessionConnection | undefined;
  getActiveConnections(): SessionConnection[];

  // Violation handling
  handleViolation(podId: string, violation: Omit<PolicyViolation, 'timestamp'>): Promise<void>;

  // Events
  on(event: 'connection', listener: (connection: SessionConnection) => void): void;
  on(event: 'disconnect', listener: (sessionId: string) => void): void;
  on(event: 'violation', listener: (podId: string, violation: PolicyViolation) => void): void;
  on(event: 'message', listener: (sessionId: string, message: WebSocketMessage) => void): void;

  // Cleanup
  cleanup(): Promise<void>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createWebSocketEnforcementService(redis: Redis): WebSocketEnforcementService {
  const emitter = new EventEmitter();
  const connections = new Map<string, SessionConnection>();
  const podToSession = new Map<string, string>();
  const policyEnforcements = new Map<string, PolicyEnforcementConfig>();
  const PUBSUB_CHANNEL = 'skillpod:enforcement';

  // Redis pub/sub for distributed message handling
  const subscriber = redis.duplicate();
  const publisher = redis.duplicate();

  // Set up pub/sub listener
  subscriber.subscribe(PUBSUB_CHANNEL).catch((err) => {
    console.error('Failed to subscribe to enforcement channel:', err);
  });

  subscriber.on('message', (channel: string, rawMessage: string) => {
    if (channel !== PUBSUB_CHANNEL) return;

    try {
      const parsed = JSON.parse(rawMessage) as {
        action: string;
        sessionId?: string;
        podId?: string;
        tenantId?: string;
        message?: WebSocketMessage;
        violation?: PolicyViolation;
      };

      switch (parsed.action) {
        case 'send_to_session':
          if (parsed.sessionId && parsed.message) {
            deliverToSession(parsed.sessionId, parsed.message);
          }
          break;
        case 'send_to_pod':
          if (parsed.podId && parsed.message) {
            const sessionId = podToSession.get(parsed.podId);
            if (sessionId) {
              deliverToSession(sessionId, parsed.message);
            }
          }
          break;
        case 'violation':
          if (parsed.podId && parsed.violation) {
            emitter.emit('violation', parsed.podId, parsed.violation);
          }
          break;
      }
    } catch {
      console.error('Failed to parse enforcement message');
    }
  });

  /**
   * Deliver message to a connected session (internal)
   */
  function deliverToSession(sessionId: string, message: WebSocketMessage): void {
    const connection = connections.get(sessionId);
    if (connection) {
      // In a real implementation, this would send via WebSocket
      // For now, emit an event that the application can handle
      emitter.emit('message', sessionId, message);
    }
  }

  // ===========================================================================
  // POLICY REGISTRATION
  // ===========================================================================

  async function registerPolicyEnforcement(
    podId: string,
    config: PolicyEnforcementConfig
  ): Promise<void> {
    policyEnforcements.set(podId, config);

    // Store in Redis for distributed access
    await redis.hset(
      'skillpod:policies',
      podId,
      JSON.stringify({
        policyId: config.policyId,
        rules: config.rules,
      })
    );
  }

  async function unregisterPolicyEnforcement(podId: string): Promise<void> {
    policyEnforcements.delete(podId);
    await redis.hdel('skillpod:policies', podId);
  }

  function getPolicyEnforcement(podId: string): PolicyEnforcementConfig | undefined {
    return policyEnforcements.get(podId);
  }

  // ===========================================================================
  // SESSION MESSAGING
  // ===========================================================================

  async function sendToSession(sessionId: string, message: WebSocketMessage): Promise<void> {
    // Check local connections first
    const localConnection = connections.get(sessionId);
    if (localConnection) {
      deliverToSession(sessionId, message);
      return;
    }

    // Publish to other instances
    await publisher.publish(
      PUBSUB_CHANNEL,
      JSON.stringify({
        action: 'send_to_session',
        sessionId,
        message,
      })
    );
  }

  async function sendToPod(podId: string, message: WebSocketMessage): Promise<void> {
    const sessionId = podToSession.get(podId);
    if (sessionId) {
      await sendToSession(sessionId, message);
      return;
    }

    // Publish to other instances
    await publisher.publish(
      PUBSUB_CHANNEL,
      JSON.stringify({
        action: 'send_to_pod',
        podId,
        message,
      })
    );
  }

  async function broadcastToTenant(tenantId: string, message: WebSocketMessage): Promise<void> {
    // Get all sessions for tenant from Redis
    const sessionKeys = await redis.smembers(`skillpod:tenant:${tenantId}:sessions`);

    for (const sessionId of sessionKeys) {
      await sendToSession(sessionId, message);
    }
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  async function registerConnection(connection: SessionConnection): Promise<void> {
    connections.set(connection.sessionId, connection);
    podToSession.set(connection.podId, connection.sessionId);

    // Store connection info in Redis
    await redis.hset(
      'skillpod:connections',
      connection.sessionId,
      JSON.stringify({
        podId: connection.podId,
        userId: connection.userId,
        connectedAt: connection.connectedAt.toISOString(),
      })
    );

    emitter.emit('connection', connection);
  }

  async function removeConnection(sessionId: string): Promise<void> {
    const connection = connections.get(sessionId);
    if (connection) {
      podToSession.delete(connection.podId);
    }
    connections.delete(sessionId);

    await redis.hdel('skillpod:connections', sessionId);

    emitter.emit('disconnect', sessionId);
  }

  function getConnection(sessionId: string): SessionConnection | undefined {
    return connections.get(sessionId);
  }

  function getActiveConnections(): SessionConnection[] {
    return Array.from(connections.values());
  }

  // ===========================================================================
  // VIOLATION HANDLING
  // ===========================================================================

  async function handleViolation(
    podId: string,
    violation: Omit<PolicyViolation, 'timestamp'>
  ): Promise<void> {
    const fullViolation: PolicyViolation = {
      ...violation,
      timestamp: new Date(),
    };

    // Get policy enforcement config
    const config = policyEnforcements.get(podId);
    if (config?.onViolation) {
      await config.onViolation(fullViolation);
    }

    // Emit locally
    emitter.emit('violation', podId, fullViolation);

    // Publish to other instances
    await publisher.publish(
      PUBSUB_CHANNEL,
      JSON.stringify({
        action: 'violation',
        podId,
        violation: fullViolation,
      })
    );

    // Send notification to user
    const sessionId = podToSession.get(podId);
    if (sessionId) {
      await sendToSession(sessionId, {
        type: 'POLICY_VIOLATION',
        data: {
          violationType: fullViolation.type,
          message: fullViolation.userMessage,
          severity: fullViolation.severity,
          timestamp: fullViolation.timestamp.toISOString(),
        },
      });
    }
  }

  // ===========================================================================
  // EVENT LISTENERS
  // ===========================================================================

  function on(
    event: 'connection' | 'disconnect' | 'violation' | 'message',
    listener: (...args: unknown[]) => void
  ): void {
    emitter.on(event, listener);
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  async function cleanup(): Promise<void> {
    // Unsubscribe from pub/sub
    await subscriber.unsubscribe(PUBSUB_CHANNEL);

    // Clear all connections
    for (const sessionId of connections.keys()) {
      await removeConnection(sessionId);
    }

    // Clear policy enforcements
    policyEnforcements.clear();

    // Close Redis connections
    await subscriber.quit();
    await publisher.quit();
  }

  // ===========================================================================
  // RETURN SERVICE
  // ===========================================================================

  return {
    // Policy registration
    registerPolicyEnforcement,
    unregisterPolicyEnforcement,
    getPolicyEnforcement,

    // Session messaging
    sendToSession,
    sendToPod,
    broadcastToTenant,

    // Connection management
    registerConnection,
    removeConnection,
    getConnection,
    getActiveConnections,

    // Violation handling
    handleViolation,

    // Events
    on,

    // Cleanup
    cleanup,
  };
}
