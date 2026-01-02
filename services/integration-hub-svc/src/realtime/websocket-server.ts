// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/realtime/websocket-server
 * WebSocket Server for Real-time Updates
 *
 * Features:
 * - JWT authentication
 * - Room-based subscriptions
 * - Heartbeat/ping-pong
 * - Redis pub/sub for scaling
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { logger } from '@skillancer/logger';

// Message types
export type MessageType =
  | 'WIDGET_DATA_UPDATE'
  | 'INTEGRATION_STATUS'
  | 'SYNC_COMPLETE'
  | 'ERROR'
  | 'RECONNECT'
  | 'PING'
  | 'PONG';

export interface WebSocketMessage {
  type: MessageType;
  channel: string;
  payload: unknown;
  timestamp: number;
}

export interface AuthenticatedSocket extends Socket {
  userId: string;
  workspaceId?: string;
  subscriptions: Set<string>;
}

export interface ConnectionInfo {
  socketId: string;
  userId: string;
  workspaceId?: string;
  connectedAt: Date;
  lastPing: Date;
  subscriptions: string[];
}

export class WebSocketServer {
  private io: Server | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 10000; // 10 seconds

  /**
   * Initialize WebSocket server
   */
  async initialize(httpServer: HTTPServer): Promise<void> {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      pingTimeout: this.HEARTBEAT_TIMEOUT,
      pingInterval: this.HEARTBEAT_INTERVAL,
    });

    // Setup Redis adapter for horizontal scaling
    if (process.env.REDIS_URL) {
      await this.setupRedisAdapter();
    }

    // Authentication middleware
    this.io.use(this.authenticate.bind(this));

    // Connection handler
    this.io.on('connection', this.handleConnection.bind(this));

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup Redis adapter for multi-instance coordination
   */
  private async setupRedisAdapter(): Promise<void> {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.io!.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter configured for WebSocket scaling');
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticate(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
        userId: string;
        workspaceId?: string;
      };

      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).workspaceId = decoded.workspaceId;
      (socket as AuthenticatedSocket).subscriptions = new Set();

      next();
    } catch (error) {
      logger.warn('WebSocket authentication failed', { error });
      next(new Error('Invalid token'));
    }
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const { userId, workspaceId } = authSocket;

    // Track connection
    this.trackConnection(authSocket);

    logger.info('WebSocket connected', { socketId: socket.id, userId, workspaceId });

    // Auto-subscribe to workspace if provided
    if (workspaceId) {
      this.subscribeToChannel(authSocket, `workspace:${workspaceId}`);
    }

    // Handle subscription requests
    socket.on('subscribe', (channel: string) => {
      this.subscribeToChannel(authSocket, channel);
    });

    socket.on('unsubscribe', (channel: string) => {
      this.unsubscribeFromChannel(authSocket, channel);
    });

    // Handle ping/pong
    socket.on('ping', () => {
      this.updateConnectionPing(socket.id);
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(authSocket, reason);
    });

    // Send connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      timestamp: Date.now(),
    });
  }

  /**
   * Track connection info
   */
  private trackConnection(socket: AuthenticatedSocket): void {
    const info: ConnectionInfo = {
      socketId: socket.id,
      userId: socket.userId,
      workspaceId: socket.workspaceId,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: [],
    };

    this.connections.set(socket.id, info);

    // Track by user
    if (!this.userConnections.has(socket.userId)) {
      this.userConnections.set(socket.userId, new Set());
    }
    this.userConnections.get(socket.userId)!.add(socket.id);
  }

  /**
   * Subscribe socket to channel
   */
  private subscribeToChannel(socket: AuthenticatedSocket, channel: string): void {
    // Validate channel access
    if (!this.canAccessChannel(socket, channel)) {
      socket.emit('error', { message: 'Access denied to channel', channel });
      return;
    }

    socket.join(channel);
    socket.subscriptions.add(channel);

    const info = this.connections.get(socket.id);
    if (info) {
      info.subscriptions = Array.from(socket.subscriptions);
    }

    logger.debug('Socket subscribed to channel', { socketId: socket.id, channel });
    socket.emit('subscribed', { channel });
  }

  /**
   * Unsubscribe socket from channel
   */
  private unsubscribeFromChannel(socket: AuthenticatedSocket, channel: string): void {
    socket.leave(channel);
    socket.subscriptions.delete(channel);

    const info = this.connections.get(socket.id);
    if (info) {
      info.subscriptions = Array.from(socket.subscriptions);
    }

    socket.emit('unsubscribed', { channel });
  }

  /**
   * Check if socket can access channel
   */
  private canAccessChannel(socket: AuthenticatedSocket, channel: string): boolean {
    // Parse channel format: type:workspaceId:...
    const [type, workspaceId] = channel.split(':');

    // If workspace channel, check workspace access
    if (type === 'workspace' && socket.workspaceId && workspaceId !== socket.workspaceId) {
      return false;
    }

    // Widget and integration channels include workspaceId
    if ((type === 'widget' || type === 'integration') && socket.workspaceId) {
      return workspaceId === socket.workspaceId;
    }

    return true;
  }

  /**
   * Update connection ping timestamp
   */
  private updateConnectionPing(socketId: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.lastPing = new Date();
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: AuthenticatedSocket, reason: string): void {
    logger.info('WebSocket disconnected', { socketId: socket.id, userId: socket.userId, reason });

    this.connections.delete(socket.id);

    const userSockets = this.userConnections.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userConnections.delete(socket.userId);
      }
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = this.HEARTBEAT_INTERVAL + this.HEARTBEAT_TIMEOUT;

      for (const [socketId, info] of this.connections) {
        if (now - info.lastPing.getTime() > timeout) {
          logger.warn('Connection timed out', { socketId, userId: info.userId });
          this.io?.sockets.sockets.get(socketId)?.disconnect(true);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // ==================== Public Methods ====================

  /**
   * Broadcast message to channel
   */
  broadcast(channel: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (!this.io) return;

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
    };

    this.io.to(channel).emit(message.type, fullMessage);
    logger.debug('Broadcast message', { channel, type: message.type });
  }

  /**
   * Send message to specific user (all their connections)
   */
  sendToUser(userId: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds || !this.io) return;

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
    };

    for (const socketId of socketIds) {
      this.io.to(socketId).emit(message.type, fullMessage);
    }
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; uniqueUsers: number; channels: number } {
    const channels = new Set<string>();
    for (const info of this.connections.values()) {
      info.subscriptions.forEach((s) => channels.add(s));
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      channels: channels.size,
    };
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.io) {
      // Notify all clients
      this.io.emit('RECONNECT', { reason: 'server_shutdown' });
      await new Promise<void>((resolve) => this.io!.close(() => resolve()));
    }

    logger.info('WebSocket server shutdown complete');
  }
}

// Singleton instance
export const websocketServer = new WebSocketServer();

