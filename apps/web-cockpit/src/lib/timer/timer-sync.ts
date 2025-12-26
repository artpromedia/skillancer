/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Timer Sync Module
 *
 * Cross-tab synchronization for timer state using BroadcastChannel API
 * with localStorage fallback. Ensures consistent timer state across
 * multiple browser tabs.
 *
 * @module lib/timer/timer-sync
 */

// ============================================================================
// Types
// ============================================================================

export interface TimerState {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  description: string;
  taskId?: string;
  taskName?: string;
  startTime: number;
  pausedAt?: number;
  pausedDuration: number;
  isPaused: boolean;
  tags?: string[];
  billable?: boolean;
}

export type TimerSyncEvent =
  | { type: 'TIMER_STARTED'; timer: TimerState }
  | { type: 'TIMER_STOPPED'; timer: null }
  | { type: 'TIMER_PAUSED'; timer: TimerState }
  | { type: 'TIMER_RESUMED'; timer: TimerState }
  | { type: 'TIMER_UPDATED'; timer: TimerState }
  | { type: 'TIMER_DISCARDED'; timer: null }
  | { type: 'SYNC_REQUEST'; timer: null }
  | { type: 'SYNC_RESPONSE'; timer: TimerState | null };

export interface TimerSyncOptions {
  channelName?: string;
  storageKey?: string;
  onStateChange?: (timer: TimerState | null) => void;
  onSyncRequest?: () => TimerState | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHANNEL_NAME = 'skillancer-timer-sync';
const DEFAULT_STORAGE_KEY = 'activeTimer';

// ============================================================================
// TimerSync Class
// ============================================================================

export class TimerSync {
  private channel: BroadcastChannel | null = null;
  private storageKey: string;
  private channelName: string;
  private onStateChange?: (timer: TimerState | null) => void;
  private onSyncRequest?: () => TimerState | null;
  private isLeader = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: TimerSyncOptions = {}) {
    this.channelName = options.channelName || DEFAULT_CHANNEL_NAME;
    this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    this.onStateChange = options.onStateChange;
    this.onSyncRequest = options.onSyncRequest;

    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    // Initialize BroadcastChannel if available
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = this.handleMessage.bind(this);
    }

    // Storage event listener as fallback
    window.addEventListener('storage', this.handleStorageEvent.bind(this));

    // Visibility change listener for tab focus
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Request sync on init
    this.requestSync();
  }

  private handleMessage(event: MessageEvent<TimerSyncEvent>): void {
    const { type, timer } = event.data;

    switch (type) {
      case 'TIMER_STARTED':
      case 'TIMER_PAUSED':
      case 'TIMER_RESUMED':
      case 'TIMER_UPDATED':
        this.onStateChange?.(timer);
        this.saveToStorage(timer);
        break;

      case 'TIMER_STOPPED':
      case 'TIMER_DISCARDED':
        this.onStateChange?.(null);
        this.removeFromStorage();
        break;

      case 'SYNC_REQUEST':
        // Respond with current state if we have one
        if (this.onSyncRequest) {
          const currentTimer = this.onSyncRequest();
          if (currentTimer) {
            this.broadcast({ type: 'SYNC_RESPONSE', timer: currentTimer });
          }
        }
        break;

      case 'SYNC_RESPONSE':
        if (timer) {
          this.onStateChange?.(timer);
        }
        break;
    }
  }

  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== this.storageKey) return;

    if (event.newValue) {
      try {
        const timer = JSON.parse(event.newValue) as TimerState;
        this.onStateChange?.(timer);
      } catch (e) {
        console.error('Failed to parse timer from storage:', e);
      }
    } else {
      this.onStateChange?.(null);
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // Request sync when tab becomes visible
      this.requestSync();

      // Also check localStorage for latest state
      const stored = this.loadFromStorage();
      if (stored) {
        this.onStateChange?.(stored);
      }
    }
  }

  private broadcast(event: TimerSyncEvent): void {
    if (this.channel) {
      this.channel.postMessage(event);
    }
  }

  private saveToStorage(timer: TimerState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(timer));
  }

  private removeFromStorage(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKey);
  }

  private loadFromStorage(): TimerState | null {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as TimerState;
    } catch (e) {
      console.error('Failed to parse stored timer:', e);
      return null;
    }
  }

  /**
   * Request sync from other tabs
   */
  requestSync(): void {
    this.broadcast({ type: 'SYNC_REQUEST', timer: null });
  }

  /**
   * Broadcast timer started event
   */
  timerStarted(timer: TimerState): void {
    this.saveToStorage(timer);
    this.broadcast({ type: 'TIMER_STARTED', timer });
  }

  /**
   * Broadcast timer stopped event
   */
  timerStopped(): void {
    this.removeFromStorage();
    this.broadcast({ type: 'TIMER_STOPPED', timer: null });
  }

  /**
   * Broadcast timer paused event
   */
  timerPaused(timer: TimerState): void {
    this.saveToStorage(timer);
    this.broadcast({ type: 'TIMER_PAUSED', timer });
  }

  /**
   * Broadcast timer resumed event
   */
  timerResumed(timer: TimerState): void {
    this.saveToStorage(timer);
    this.broadcast({ type: 'TIMER_RESUMED', timer });
  }

  /**
   * Broadcast timer updated event
   */
  timerUpdated(timer: TimerState): void {
    this.saveToStorage(timer);
    this.broadcast({ type: 'TIMER_UPDATED', timer });
  }

  /**
   * Broadcast timer discarded event
   */
  timerDiscarded(): void {
    this.removeFromStorage();
    this.broadcast({ type: 'TIMER_DISCARDED', timer: null });
  }

  /**
   * Get current timer state from storage
   */
  getCurrentState(): TimerState | null {
    return this.loadFromStorage();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent.bind(this));
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let instance: TimerSync | null = null;

/**
 * Get or create TimerSync singleton instance
 */
export function getTimerSync(options?: TimerSyncOptions): TimerSync {
  if (!instance) {
    instance = new TimerSync(options);
  }
  return instance;
}

/**
 * Destroy TimerSync instance
 */
export function destroyTimerSync(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default TimerSync;
