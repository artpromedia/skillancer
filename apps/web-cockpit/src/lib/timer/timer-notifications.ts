/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Timer Notifications Module
 *
 * Browser notifications and reminders for timer events.
 * Includes idle detection and configurable notification preferences.
 *
 * @module lib/timer/timer-notifications
 */

// ============================================================================
// Types
// ============================================================================

export interface TimerNotificationConfig {
  enabled: boolean;
  idleReminderEnabled: boolean;
  idleReminderMinutes: number;
  longRunningEnabled: boolean;
  longRunningMinutes: number;
  soundEnabled: boolean;
  soundVolume: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export type NotificationEventType =
  | 'timer_started'
  | 'timer_stopped'
  | 'timer_paused'
  | 'idle_reminder'
  | 'long_running'
  | 'daily_summary';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: TimerNotificationConfig = {
  enabled: true,
  idleReminderEnabled: true,
  idleReminderMinutes: 30,
  longRunningEnabled: true,
  longRunningMinutes: 480, // 8 hours
  soundEnabled: false,
  soundVolume: 0.5,
};

const STORAGE_KEY = 'timerNotificationConfig';
const NOTIFICATION_ICON = '/icons/timer-icon.png';

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

// ============================================================================
// TimerNotifications Class
// ============================================================================

export class TimerNotifications {
  private config: TimerNotificationConfig;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private longRunningTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityTime: number = Date.now();
  private timerStartTime: number | null = null;
  private permissionGranted = false;

  constructor(config?: Partial<TimerNotificationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    void this.init();
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Load config from storage
    this.loadConfig();

    // Request notification permission
    await this.requestPermission();

    // Set up activity listeners
    this.setupActivityListeners();
  }

  private loadConfig(): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed: TimerNotificationConfig = JSON.parse(stored);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.config = { ...DEFAULT_CONFIG, ...parsed };
      } catch (e) {
        // Failed to parse notification config - using defaults
      }
    }
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

  private async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      this.permissionGranted = false;
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permissionGranted = permission === 'granted';
    return this.permissionGranted;
  }

  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;

    const updateActivity = () => {
      this.lastActivityTime = Date.now();
      this.resetIdleTimer();
    };

    // Track user activity
    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });
    window.addEventListener('scroll', updateActivity, { passive: true });
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    if (this.config.idleReminderEnabled && this.timerStartTime) {
      this.idleTimer = setTimeout(
        () => {
          this.showIdleReminder();
        },
        this.config.idleReminderMinutes * 60 * 1000
      );
    }
  }

  private showIdleReminder(): void {
    if (!this.timerStartTime) return;

    const elapsedMinutes = Math.floor((Date.now() - this.timerStartTime) / 60000);

    void this.showNotification('idle_reminder', {
      title: 'Timer Still Running',
      body: `Your timer has been running for ${formatDuration(elapsedMinutes)}. Are you still working?`,
      tag: 'idle-reminder',
      requireInteraction: true,
      actions: [
        { action: 'continue', title: 'Continue' },
        { action: 'stop', title: 'Stop Timer' },
      ],
    });
  }

  private showLongRunningWarning(): void {
    if (!this.timerStartTime) return;

    const elapsedMinutes = Math.floor((Date.now() - this.timerStartTime) / 60000);

    void this.showNotification('long_running', {
      title: 'Long Running Timer',
      body: `Your timer has been running for ${formatDuration(elapsedMinutes)}. Consider taking a break!`,
      tag: 'long-running',
      requireInteraction: true,
      actions: [
        { action: 'snooze', title: 'Remind Later' },
        { action: 'stop', title: 'Stop Timer' },
      ],
    });
  }

  /**
   * Show a notification
   */
  private showNotification(
    type: NotificationEventType,
    payload: NotificationPayload
  ): Notification | null {
    if (!this.config.enabled || !this.permissionGranted) {
      return null;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }

    // Don't show notifications if tab is focused
    if (document.visibilityState === 'visible' && type !== 'idle_reminder') {
      return null;
    }

    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || NOTIFICATION_ICON,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction,
    });

    // Play sound if enabled
    if (this.config.soundEnabled) {
      this.playNotificationSound();
    }

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }

  private playNotificationSound(): void {
    // Create and play a simple notification sound
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.value = this.config.soundVolume * 0.1;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);

      // Cleanup
      setTimeout(() => {
        void audioContext.close();
      }, 200);
    } catch (e) {
      console.error('Failed to play notification sound:', e);
    }
  }

  /**
   * Called when timer starts
   */
  onTimerStart(projectName: string): void {
    this.timerStartTime = Date.now();

    // Set up idle reminder
    this.resetIdleTimer();

    // Set up long running warning
    if (this.config.longRunningEnabled) {
      if (this.longRunningTimer) {
        clearTimeout(this.longRunningTimer);
      }
      this.longRunningTimer = setTimeout(
        () => {
          this.showLongRunningWarning();
        },
        this.config.longRunningMinutes * 60 * 1000
      );
    }

    // Show start notification
    void this.showNotification('timer_started', {
      title: 'Timer Started',
      body: `Started tracking time for ${projectName}`,
      tag: 'timer-started',
    });
  }

  /**
   * Called when timer stops
   */
  onTimerStop(duration: number, projectName: string): void {
    this.timerStartTime = null;

    // Clear timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.longRunningTimer) {
      clearTimeout(this.longRunningTimer);
      this.longRunningTimer = null;
    }

    // Show stop notification
    void this.showNotification('timer_stopped', {
      title: 'Timer Stopped',
      body: `Tracked ${formatDuration(duration)} for ${projectName}`,
      tag: 'timer-stopped',
    });
  }

  /**
   * Called when timer is paused
   */
  onTimerPause(): void {
    // Pause idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    void this.showNotification('timer_paused', {
      title: 'Timer Paused',
      body: "Your timer is paused. Don't forget to resume!",
      tag: 'timer-paused',
    });
  }

  /**
   * Show daily summary notification
   */
  showDailySummary(totalHours: number, projectCount: number, earnings: number): void {
    const earningsStr = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(earnings);

    void this.showNotification('daily_summary', {
      title: 'Daily Summary',
      body: `You tracked ${formatDuration(totalHours * 60)} across ${projectCount} project${
        projectCount > 1 ? 's' : ''
      }. Earned ${earningsStr}`,
      tag: 'daily-summary',
      requireInteraction: true,
    });
  }

  /**
   * Update notification config
   */
  updateConfig(updates: Partial<TimerNotificationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Get current config
   */
  getConfig(): TimerNotificationConfig {
    return { ...this.config };
  }

  /**
   * Check if notifications are supported and enabled
   */
  isEnabled(): boolean {
    return (
      this.config.enabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      this.permissionGranted
    );
  }

  /**
   * Request notification permission from user
   */
  async requestNotificationPermission(): Promise<boolean> {
    return this.requestPermission();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.longRunningTimer) {
      clearTimeout(this.longRunningTimer);
      this.longRunningTimer = null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let instance: TimerNotifications | null = null;

/**
 * Get or create TimerNotifications singleton instance
 */
export function getTimerNotifications(
  config?: Partial<TimerNotificationConfig>
): TimerNotifications {
  if (!instance) {
    instance = new TimerNotifications(config);
  }
  return instance;
}

/**
 * Destroy TimerNotifications instance
 */
export function destroyTimerNotifications(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default TimerNotifications;
