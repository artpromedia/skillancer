/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, no-console */
/**
 * WebSocket Messaging Client
 *
 * Real-time messaging infrastructure with automatic reconnection,
 * heartbeat monitoring, and event handling.
 */

// ============================================================================
// Types
// ============================================================================

export type WebSocketStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type MessageEventType =
  | 'message.new'
  | 'message.updated'
  | 'message.deleted'
  | 'message.reaction'
  | 'typing.start'
  | 'typing.stop'
  | 'user.presence'
  | 'conversation.updated'
  | 'read.receipt';

export interface WebSocketMessage<T = unknown> {
  type: MessageEventType;
  conversationId: string;
  data: T;
  timestamp: string;
}

export interface NewMessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'TEXT' | 'FILE' | 'IMAGE' | 'VOICE' | 'SYSTEM' | 'CONTRACT_EVENT';
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  createdAt: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface ReadReceiptEvent {
  conversationId: string;
  userId: string;
  messageId: string;
  readAt: string;
}

export interface MessageReactionEvent {
  messageId: string;
  conversationId: string;
  userId: string;
  userName: string;
  emoji: string;
  action: 'add' | 'remove';
}

export interface EventHandlers {
  'message.new'?: (event: NewMessageEvent) => void;
  'message.updated'?: (event: NewMessageEvent) => void;
  'message.deleted'?: (event: { messageId: string; conversationId: string }) => void;
  'message.reaction'?: (event: MessageReactionEvent) => void;
  'typing.start'?: (event: TypingEvent) => void;
  'typing.stop'?: (event: TypingEvent) => void;
  'user.presence'?: (event: PresenceEvent) => void;
  'conversation.updated'?: (event: { conversationId: string }) => void;
  'read.receipt'?: (event: ReadReceiptEvent) => void;
}

export interface MessagingClientOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

// ============================================================================
// MessagingClient Class
// ============================================================================

export class MessagingClient {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'DISCONNECTED';
  private eventHandlers: EventHandlers = {};
  private statusHandlers: Array<(status: WebSocketStatus) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectInterval: number;
  private heartbeatInterval: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private debug: boolean;
  private subscribedConversations: Set<string> = new Set();

  constructor(options: MessagingClientOptions = {}) {
    this.url = options.url || this.getDefaultUrl();
    this.maxReconnectAttempts = options.reconnectAttempts ?? 5;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.heartbeatInterval = options.heartbeatInterval ?? 30000;
    this.debug = options.debug ?? false;
  }

  private getDefaultUrl(): string {
    const protocol =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    return `${protocol}//${host}/ws/messages`;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[MessagingClient]', ...args);
    }
  }

  private setStatus(status: WebSocketStatus): void {
    this.status = status;
    this.log('Status changed:', status);
    this.statusHandlers.forEach((handler) => handler(status));
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('CONNECTING');
      this.log('Connecting to', this.url);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.log('Connected');
          this.setStatus('CONNECTED');
          this.reconnectAttempts = 0;
          this.startHeartbeat();

          // Re-subscribe to conversations
          this.subscribedConversations.forEach((id) => {
            this.sendRaw({ type: 'subscribe', conversationId: id });
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.log('Error:', error);
          this.setStatus('ERROR');
          reject(error);
        };

        this.ws.onclose = (event) => {
          this.log('Disconnected:', event.code, event.reason);
          this.stopHeartbeat();

          if (event.code !== 1000) {
            this.attemptReconnect();
          } else {
            this.setStatus('DISCONNECTED');
          }
        };
      } catch (error) {
        this.log('Connection error:', error);
        this.setStatus('ERROR');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting');
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('DISCONNECTED');
  }

  /**
   * Subscribe to a conversation for real-time updates
   */
  subscribeToConversation(conversationId: string): void {
    this.subscribedConversations.add(conversationId);
    this.log('Subscribing to conversation:', conversationId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: 'subscribe', conversationId });
    }
  }

  /**
   * Unsubscribe from a conversation
   */
  unsubscribeFromConversation(conversationId: string): void {
    this.subscribedConversations.delete(conversationId);
    this.log('Unsubscribing from conversation:', conversationId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: 'unsubscribe', conversationId });
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId: string, isTyping: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({
        type: isTyping ? 'typing.start' : 'typing.stop',
        conversationId,
      });
    }
  }

  /**
   * Send read receipt
   */
  sendReadReceipt(conversationId: string, messageId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw({
        type: 'read.receipt',
        conversationId,
        messageId,
        readAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Register event handler
   */
  on<K extends keyof EventHandlers>(event: K, handler: NonNullable<EventHandlers[K]>): () => void {
    this.eventHandlers[event] = handler as EventHandlers[K];

    return () => {
      delete this.eventHandlers[event];
    };
  }

  /**
   * Register status change handler
   */
  onStatusChange(handler: (status: WebSocketStatus) => void): () => void {
    this.statusHandlers.push(handler);

    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index > -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      this.log('Received:', message.type, message);

      // Handle pong for heartbeat
      if ((message as unknown as { type: string }).type === 'pong') {
        return;
      }

      const handler = this.eventHandlers[message.type];
      if (handler) {
        (handler as (data: unknown) => void)(message.data);
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  private sendRaw(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.setStatus('DISCONNECTED');
      return;
    }

    this.reconnectAttempts++;
    this.setStatus('RECONNECTING');

    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    this.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.log('Reconnect failed:', error);
      });
    }, delay);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let clientInstance: MessagingClient | null = null;

export function getMessagingClient(options?: MessagingClientOptions): MessagingClient {
  if (!clientInstance) {
    clientInstance = new MessagingClient(options);
  }
  return clientInstance;
}

export function destroyMessagingClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}

// ============================================================================
// Mock Event Simulator (for development)
// ============================================================================

export function simulateMockEvents(client: MessagingClient): () => void {
  const intervals: ReturnType<typeof setInterval>[] = [];

  // Simulate incoming messages every 30 seconds
  intervals.push(
    setInterval(() => {
      const mockMessage: NewMessageEvent = {
        id: `msg-${Date.now()}`,
        conversationId: 'conv-1',
        senderId: 'sarah-1',
        senderName: 'Sarah Johnson',
        senderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
        content: 'Just checking in - how is everything going?',
        type: 'TEXT',
        attachments: [],
        createdAt: new Date().toISOString(),
      };

      const handlers = (client as unknown as { eventHandlers: EventHandlers }).eventHandlers;
      if (handlers['message.new']) {
        handlers['message.new'](mockMessage);
      }
    }, 30000)
  );

  // Simulate typing indicators
  intervals.push(
    setInterval(() => {
      const handlers = (client as unknown as { eventHandlers: EventHandlers }).eventHandlers;
      if (handlers['typing.start']) {
        handlers['typing.start']({
          conversationId: 'conv-1',
          userId: 'sarah-1',
          userName: 'Sarah Johnson',
          isTyping: true,
        });

        setTimeout(() => {
          if (handlers['typing.stop']) {
            handlers['typing.stop']({
              conversationId: 'conv-1',
              userId: 'sarah-1',
              userName: 'Sarah Johnson',
              isTyping: false,
            });
          }
        }, 3000);
      }
    }, 60000)
  );

  return () => {
    intervals.forEach((interval) => clearInterval(interval));
  };
}
