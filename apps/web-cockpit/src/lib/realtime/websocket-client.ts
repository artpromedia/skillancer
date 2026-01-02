/**
 * @module @skillancer/web-cockpit/lib/realtime/websocket-client
 * WebSocket Client for Real-time Updates
 *
 * Features:
 * - JWT authentication
 * - Auto-reconnect with exponential backoff
 * - Subscription management
 * - Offline detection
 */

import { io, type Socket } from 'socket.io-client';

export type MessageType =
  | 'WIDGET_DATA_UPDATE'
  | 'INTEGRATION_STATUS'
  | 'SYNC_COMPLETE'
  | 'ERROR'
  | 'RECONNECT';

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface WebSocketMessage {
  type: MessageType;
  channel: string;
  payload: unknown;
  timestamp: number;
}

export interface WidgetUpdatePayload {
  integrationId: string;
  widgetId: string;
  data: unknown;
}

export interface IntegrationStatusPayload {
  integrationId: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing' | 'rate_limited';
}

export interface SyncCompletePayload {
  integrationId: string;
  success: boolean;
  widgetsUpdated: string[];
  duration: number;
  error?: string;
}

export interface ErrorPayload {
  integrationId?: string;
  widgetId?: string;
  code: string;
  message: string;
  recoveryAction?: string;
  retryAfter?: number;
}

type MessageCallback<T> = (payload: T) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private subscriptions: Set<string> = new Set();
  private messageQueue: WebSocketMessage[] = [];

  // Callbacks
  private stateCallbacks: Set<(state: ConnectionState) => void> = new Set();
  private widgetUpdateCallbacks: Set<MessageCallback<WidgetUpdatePayload>> = new Set();
  private integrationStatusCallbacks: Set<MessageCallback<IntegrationStatusPayload>> = new Set();
  private syncCompleteCallbacks: Set<MessageCallback<SyncCompletePayload>> = new Set();
  private errorCallbacks: Set<MessageCallback<ErrorPayload>> = new Set();
  private reconnectCallbacks: Set<() => void> = new Set();

  private readonly BASE_URL: string;

  constructor(baseUrl?: string) {
    this.BASE_URL = baseUrl || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:4000';
  }

  /**
   * Connect to WebSocket server
   */
  connect(token: string, workspaceId?: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.setState('connecting');

    this.socket = io(this.BASE_URL, {
      auth: { token },
      query: workspaceId ? { workspaceId } : undefined,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.setState('connected');
      this.reconnectAttempts = 0;

      // Re-subscribe to channels
      for (const channel of this.subscriptions) {
        this.socket?.emit('subscribe', channel);
      }

      // Flush queued messages
      this.flushMessageQueue();
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.setState('disconnected');
      } else {
        this.setState('reconnecting');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.setState('error');
      } else {
        this.setState('reconnecting');
      }
    });

    // Message handlers
    this.socket.on('WIDGET_DATA_UPDATE', (message: WebSocketMessage) => {
      const payload = message.payload as WidgetUpdatePayload;
      this.widgetUpdateCallbacks.forEach((cb) => cb(payload));
    });

    this.socket.on('INTEGRATION_STATUS', (message: WebSocketMessage) => {
      const payload = message.payload as IntegrationStatusPayload;
      this.integrationStatusCallbacks.forEach((cb) => cb(payload));
    });

    this.socket.on('SYNC_COMPLETE', (message: WebSocketMessage) => {
      const payload = message.payload as SyncCompletePayload;
      this.syncCompleteCallbacks.forEach((cb) => cb(payload));
    });

    this.socket.on('ERROR', (message: WebSocketMessage) => {
      const payload = message.payload as ErrorPayload;
      this.errorCallbacks.forEach((cb) => cb(payload));
    });

    this.socket.on('RECONNECT', () => {
      this.reconnectCallbacks.forEach((cb) => cb());
    });

    this.socket.on('subscribed', ({ channel }: { channel: string }) => {
      this.subscriptions.add(channel);
    });

    this.socket.on('unsubscribed', ({ channel }: { channel: string }) => {
      this.subscriptions.delete(channel);
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('disconnected');
    this.subscriptions.clear();
  }

  /**
   * Subscribe to workspace updates
   */
  subscribeToWorkspace(workspaceId: string): void {
    this.subscribe(`workspace:${workspaceId}`);
  }

  /**
   * Subscribe to widget updates
   */
  subscribeToWidget(workspaceId: string, widgetId: string): void {
    this.subscribe(`widget:${workspaceId}:${widgetId}`);
  }

  /**
   * Subscribe to integration updates
   */
  subscribeToIntegration(workspaceId: string, integrationId: string): void {
    this.subscribe(`integration:${workspaceId}:${integrationId}`);
  }

  /**
   * Subscribe to channel
   */
  subscribe(channel: string): void {
    this.subscriptions.add(channel);

    if (this.socket?.connected) {
      this.socket.emit('subscribe', channel);
    }
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);

    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', channel);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    for (const channel of this.subscriptions) {
      this.unsubscribe(channel);
    }
  }

  // ==================== Callbacks ====================

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  onWidgetUpdate(callback: MessageCallback<WidgetUpdatePayload>): () => void {
    this.widgetUpdateCallbacks.add(callback);
    return () => this.widgetUpdateCallbacks.delete(callback);
  }

  onIntegrationStatus(callback: MessageCallback<IntegrationStatusPayload>): () => void {
    this.integrationStatusCallbacks.add(callback);
    return () => this.integrationStatusCallbacks.delete(callback);
  }

  onSyncComplete(callback: MessageCallback<SyncCompletePayload>): () => void {
    this.syncCompleteCallbacks.add(callback);
    return () => this.syncCompleteCallbacks.delete(callback);
  }

  onError(callback: MessageCallback<ErrorPayload>): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  onReconnect(callback: () => void): () => void {
    this.reconnectCallbacks.add(callback);
    return () => this.reconnectCallbacks.delete(callback);
  }

  // ==================== Getters ====================

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  // ==================== Private Methods ====================

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallbacks.forEach((cb) => cb(state));
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.socket?.connected) {
        this.socket.emit(message.type, message);
      }
    }
  }
}

// Singleton instance
let clientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!clientInstance) {
    clientInstance = new WebSocketClient();
  }
  return clientInstance;
}

export function resetWebSocketClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}
