/**
 * @module @skillancer/api-client/websocket
 * WebSocket client for real-time features
 */

// =============================================================================
// Types
// =============================================================================

export type WebSocketEventType =
  // Messages
  | 'message:new'
  | 'message:updated'
  | 'message:deleted'
  | 'message:read'
  | 'typing:start'
  | 'typing:stop'
  // Notifications
  | 'notification:new'
  | 'notification:read'
  // Contracts
  | 'contract:created'
  | 'contract:updated'
  | 'contract:completed'
  | 'milestone:submitted'
  | 'milestone:approved'
  | 'milestone:paid'
  // Jobs
  | 'job:created'
  | 'job:updated'
  | 'job:closed'
  | 'proposal:received'
  | 'proposal:accepted'
  | 'proposal:rejected'
  // Payments
  | 'payment:received'
  | 'payment:sent'
  | 'escrow:funded'
  | 'escrow:released'
  | 'withdrawal:completed'
  // Presence
  | 'presence:online'
  | 'presence:offline'
  | 'presence:away'
  // System
  | 'connection:established'
  | 'connection:lost'
  | 'connection:error'
  | 'auth:required'
  | 'auth:failed';

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
  metadata?: {
    userId?: string;
    conversationId?: string;
    contractId?: string;
    jobId?: string;
  };
}

export interface WebSocketConfig {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectMaxAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export type EventHandler<T = unknown> = (event: WebSocketEvent<T>) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Error) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_RECONNECT_INTERVAL = 3000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

// =============================================================================
// WebSocket Client
// =============================================================================

export class WebSocketClient {
  private config: Required<WebSocketConfig>;
  private socket: WebSocket | null = null;
  private eventHandlers: Map<WebSocketEventType | '*', Set<EventHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isManuallyDisconnected = false;
  private pendingMessages: Array<{ type: string; payload: unknown }> = [];

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      token: config.token ?? '',
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL,
      reconnectMaxAttempts: config.reconnectMaxAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      heartbeatInterval: config.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL,
      debug: config.debug ?? false,
    };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    this.isManuallyDisconnected = false;
    this.createConnection();
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.cleanup();

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
  }

  reconnect(): void {
    this.disconnect();
    this.isManuallyDisconnected = false;
    this.connect();
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ===========================================================================
  // Token Management
  // ===========================================================================

  setToken(token: string): void {
    this.config.token = token;

    // Re-authenticate if connected
    if (this.isConnected()) {
      this.send('auth', { token });
    }
  }

  clearToken(): void {
    this.config.token = '';
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  on<T = unknown>(event: WebSocketEventType | '*', handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler as EventHandler);
    };
  }

  off<T = unknown>(event: WebSocketEventType | '*', handler?: EventHandler<T>): void {
    if (handler) {
      this.eventHandlers.get(event)?.delete(handler as EventHandler);
    } else {
      this.eventHandlers.delete(event);
    }
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // ===========================================================================
  // Message Sending
  // ===========================================================================

  send(type: string, payload: unknown): boolean {
    if (!this.isConnected()) {
      this.log('Not connected, queueing message');
      this.pendingMessages.push({ type, payload });
      return false;
    }

    try {
      const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
      this.socket!.send(message);
      this.log('Sent:', type, payload);
      return true;
    } catch (error) {
      this.log('Send error:', error);
      return false;
    }
  }

  // Convenience methods for common events
  sendTypingStart(conversationId: string): void {
    this.send('typing:start', { conversationId });
  }

  sendTypingStop(conversationId: string): void {
    this.send('typing:stop', { conversationId });
  }

  markMessageRead(conversationId: string, messageId: string): void {
    this.send('message:read', { conversationId, messageId });
  }

  subscribeToConversation(conversationId: string): void {
    this.send('subscribe', { channel: `conversation:${conversationId}` });
  }

  unsubscribeFromConversation(conversationId: string): void {
    this.send('unsubscribe', { channel: `conversation:${conversationId}` });
  }

  subscribeToContract(contractId: string): void {
    this.send('subscribe', { channel: `contract:${contractId}` });
  }

  unsubscribeFromContract(contractId: string): void {
    this.send('unsubscribe', { channel: `contract:${contractId}` });
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private createConnection(): void {
    try {
      const url = this.config.token
        ? `${this.config.url}?token=${encodeURIComponent(this.config.token)}`
        : this.config.url;

      this.log('Connecting to', url);
      this.socket = new WebSocket(url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log('Connection error:', error);
      this.handleReconnect();
    }
  }

  private handleOpen(): void {
    this.log('Connected');
    this.reconnectAttempts = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Notify handlers
    this.connectionHandlers.forEach((handler) => handler());

    // Emit connection event
    this.emit({
      type: 'connection:established',
      payload: null,
      timestamp: new Date().toISOString(),
    });

    // Send pending messages
    while (this.pendingMessages.length > 0) {
      const { type, payload } = this.pendingMessages.shift()!;
      this.send(type, payload);
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as WebSocketEvent;
      this.log('Received:', data.type, data.payload);
      this.emit(data);
    } catch (error) {
      this.log('Failed to parse message:', event.data);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.log('Disconnected:', event.code, event.reason);
    this.cleanup();

    // Notify handlers
    this.disconnectionHandlers.forEach((handler) => handler());

    // Emit disconnection event
    this.emit({
      type: 'connection:lost',
      payload: { code: event.code, reason: event.reason },
      timestamp: new Date().toISOString(),
    });

    // Attempt reconnection if not manually disconnected
    if (!this.isManuallyDisconnected && this.config.reconnect) {
      this.handleReconnect();
    }
  }

  private handleError(event: Event): void {
    const error = new Error('WebSocket error');
    this.log('Error:', event);

    // Notify handlers
    this.errorHandlers.forEach((handler) => handler(error));

    // Emit error event
    this.emit({
      type: 'connection:error',
      payload: { message: error.message },
      timestamp: new Date().toISOString(),
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectMaxAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private emit(event: WebSocketEvent): void {
    // Call specific event handlers
    this.eventHandlers.get(event.type)?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        this.log('Handler error:', error);
      }
    });

    // Call wildcard handlers
    this.eventHandlers.get('*')?.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        this.log('Wildcard handler error:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
  return new WebSocketClient(config);
}
