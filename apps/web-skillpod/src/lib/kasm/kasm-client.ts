/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/require-await, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */
/**
 * Kasm Workspaces Client
 *
 * Client wrapper for Kasm Workspaces integration:
 * - Connection lifecycle management
 * - Event handling
 * - Quality control
 * - Clipboard integration
 */

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type QualityLevel = 'auto' | 'high' | 'medium' | 'low';

export interface KasmConfig {
  apiUrl: string;
  sessionToken: string;
  userId: string;
}

export interface KasmConnectionOptions {
  quality?: QualityLevel;
  frameRate?: 30 | 60;
  audioEnabled?: boolean;
  microphoneEnabled?: boolean;
}

export interface KasmQualityMetrics {
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidth: {
    up: number;
    down: number;
  };
  frameRate: number;
  resolution: string;
}

export interface KasmEventHandlers {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onError?: (error: Error) => void;
  onQualityChange?: (metrics: KasmQualityMetrics) => void;
  onLatencyChange?: (latency: number) => void;
  onClipboardChange?: (content: string) => void;
  onReconnecting?: (attempt: number) => void;
}

export interface KeyEvent {
  key: string;
  code: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  type: 'keydown' | 'keyup';
}

export interface MouseEvent {
  x: number;
  y: number;
  button?: number;
  type: 'move' | 'down' | 'up' | 'wheel';
  deltaX?: number;
  deltaY?: number;
}

// ============================================================================
// KASM CLIENT CLASS
// ============================================================================

export class KasmClient {
  private config: KasmConfig | null = null;
  private state: ConnectionState = 'disconnected';
  private handlers: KasmEventHandlers = {};
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private qualityLevel: QualityLevel = 'auto';
  private metricsInterval: NodeJS.Timeout | null = null;

  // Current metrics
  private metrics: KasmQualityMetrics = {
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    bandwidth: { up: 0, down: 0 },
    frameRate: 0,
    resolution: '1920x1080',
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the Kasm client with configuration
   */
  initialize(config: KasmConfig): void {
    this.config = config;
    this.state = 'disconnected';
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: KasmEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // ============================================================================
  // CONNECTION LIFECYCLE
  // ============================================================================

  /**
   * Connect to Kasm workspace
   */
  async connect(options: KasmConnectionOptions = {}): Promise<void> {
    if (!this.config) {
      throw new Error('Kasm client not initialized');
    }

    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.qualityLevel = options.quality || 'auto';

    try {
      // Get WebSocket URL from Kasm API
      const wsUrl = await this.getWebSocketUrl();

      // Establish WebSocket connection
      await this.establishConnection(wsUrl, options);

      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.handlers.onConnected?.();

      // Start metrics polling
      this.startMetricsPolling();
    } catch (error) {
      this.state = 'error';
      this.handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Disconnect from Kasm workspace
   */
  disconnect(): void {
    this.stopMetricsPolling();
    this.clearReconnectTimeout();

    if (this.wsConnection) {
      this.wsConnection.close(1000, 'User requested disconnect');
      this.wsConnection = null;
    }

    this.state = 'disconnected';
    this.handlers.onDisconnected?.('User requested disconnect');
  }

  /**
   * Reconnect to Kasm workspace
   */
  async reconnect(): Promise<void> {
    if (!this.config) {
      throw new Error('Kasm client not initialized');
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    this.handlers.onReconnecting?.(this.reconnectAttempts);

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.state = 'error';
      this.handlers.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      console.warn('Reconnection attempt failed:', error);
      // Schedule next reconnect attempt with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectTimeout = setTimeout(() => this.reconnect(), delay);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async getWebSocketUrl(): Promise<string> {
    if (!this.config) throw new Error('Not initialized');

    // In production, this would call the Kasm API
    // For now, construct the URL from config
    const baseUrl = this.config.apiUrl.replace(/^http/, 'ws');
    return `${baseUrl}/ws/${this.config.sessionToken}`;
  }

  private async establishConnection(wsUrl: string, options: KasmConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(wsUrl);

        this.wsConnection.onopen = () => {
          // Send initial configuration
          this.sendConfig(options);
          resolve();
        };

        this.wsConnection.onerror = (event) => {
          reject(new Error('WebSocket connection error'));
        };

        this.wsConnection.onclose = (event) => {
          if (this.state === 'connected') {
            // Unexpected disconnect, attempt reconnect
            this.reconnect();
          }
        };

        this.wsConnection.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.state === 'connecting') {
            this.wsConnection?.close();
            reject(new Error('Connection timeout'));
          }
        }, 30000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private sendConfig(options: KasmConnectionOptions): void {
    this.send({
      type: 'config',
      data: {
        quality: options.quality || 'auto',
        frameRate: options.frameRate || 30,
        audioEnabled: options.audioEnabled ?? true,
        microphoneEnabled: options.microphoneEnabled ?? false,
      },
    });
  }

  private send(message: any): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'metrics':
          this.updateMetrics(message.data);
          break;
        case 'clipboard':
          this.handlers.onClipboardChange?.(message.data.content);
          break;
        case 'error':
          this.handlers.onError?.(new Error(message.data.message));
          break;
      }
    } catch (error) {
      console.error('Failed to parse Kasm message:', error);
    }
  }

  private updateMetrics(data: any): void {
    this.metrics = {
      latency: data.latency ?? this.metrics.latency,
      jitter: data.jitter ?? this.metrics.jitter,
      packetLoss: data.packetLoss ?? this.metrics.packetLoss,
      bandwidth: data.bandwidth ?? this.metrics.bandwidth,
      frameRate: data.frameRate ?? this.metrics.frameRate,
      resolution: data.resolution ?? this.metrics.resolution,
    };

    this.handlers.onQualityChange?.(this.metrics);
    this.handlers.onLatencyChange?.(this.metrics.latency);
  }

  private startMetricsPolling(): void {
    // Poll metrics every second
    this.metricsInterval = setInterval(() => {
      this.send({ type: 'getMetrics' });
    }, 1000);
  }

  private stopMetricsPolling(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ============================================================================
  // CONTROL METHODS
  // ============================================================================

  /**
   * Set video quality level
   */
  setQuality(level: QualityLevel): void {
    this.qualityLevel = level;
    this.send({ type: 'setQuality', data: { level } });
  }

  /**
   * Send key event to remote
   */
  sendKeyEvent(event: KeyEvent): void {
    this.send({ type: 'keyEvent', data: event });
  }

  /**
   * Send mouse event to remote
   */
  sendMouseEvent(event: MouseEvent): void {
    this.send({ type: 'mouseEvent', data: event });
  }

  /**
   * Toggle audio playback
   */
  toggleAudio(enabled?: boolean): void {
    this.send({ type: 'toggleAudio', data: { enabled } });
  }

  /**
   * Toggle microphone
   */
  toggleMicrophone(enabled?: boolean): void {
    this.send({ type: 'toggleMicrophone', data: { enabled } });
  }

  // ============================================================================
  // CLIPBOARD METHODS
  // ============================================================================

  /**
   * Get clipboard content from remote
   */
  async getRemoteClipboard(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Clipboard request timeout'));
      }, 5000);

      const handler = (content: string) => {
        clearTimeout(timeout);
        resolve(content);
      };

      // Temporarily set handler
      const originalHandler = this.handlers.onClipboardChange;
      this.handlers.onClipboardChange = handler;

      this.send({ type: 'getClipboard' });

      // Restore original handler after response
      setTimeout(() => {
        this.handlers.onClipboardChange = originalHandler;
      }, 5100);
    });
  }

  /**
   * Set clipboard content on remote
   */
  async setRemoteClipboard(content: string): Promise<void> {
    this.send({ type: 'setClipboard', data: { content } });
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current quality metrics
   */
  getMetrics(): KasmQualityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current quality level
   */
  getQualityLevel(): QualityLevel {
    return this.qualityLevel;
  }

  /**
   * Get reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const kasmClient = new KasmClient();
