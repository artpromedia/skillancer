'use client';

/**
 * useNotifications Hook
 *
 * Manages browser notifications for new messages with sound support
 * and permission handling.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface NotificationOptions {
  /** Whether to show browser notifications */
  enabled: boolean;
  /** Whether to play sound on new message */
  soundEnabled: boolean;
  /** Sound volume (0-1) */
  soundVolume: number;
  /** Whether to show notifications only when tab is not focused */
  onlyWhenUnfocused: boolean;
}

export interface UseNotificationsReturn {
  /** Current notification permission */
  permission: NotificationPermission;
  /** Whether notifications are supported */
  isSupported: boolean;
  /** Current notification options */
  options: NotificationOptions;
  /** Request notification permission */
  requestPermission: () => Promise<boolean>;
  /** Show a notification */
  notify: (title: string, body: string, options?: NotificationInit) => void;
  /** Play notification sound */
  playSound: () => void;
  /** Update notification options */
  updateOptions: (updates: Partial<NotificationOptions>) => void;
  /** Check if notifications can be shown */
  canNotify: boolean;
}

interface NotificationInit {
  icon?: string;
  badge?: string;
  tag?: string;
  data?: unknown;
  onClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'skillancer_notification_settings';
const DEFAULT_OPTIONS: NotificationOptions = {
  enabled: true,
  soundEnabled: true,
  soundVolume: 0.5,
  onlyWhenUnfocused: true,
};

// Notification sound as base64 data URL (short chime sound)
const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [options, setOptions] = useState<NotificationOptions>(DEFAULT_OPTIONS);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isTabFocused = useRef(true);

  // Check if notifications are supported
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  // Load saved options from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<NotificationOptions>;
        setOptions((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore parse errors
    }

    // Get current permission
    if (isSupported) {
      setPermission(Notification.permission as NotificationPermission);
    }

    // Create audio element for notification sound
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = options.soundVolume;

    // Track tab focus
    const handleFocus = () => {
      isTabFocused.current = true;
    };
    const handleBlur = () => {
      isTabFocused.current = false;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    isTabFocused.current = document.hasFocus();

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isSupported, options.soundVolume]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result === 'granted';
    } catch {
      return false;
    }
  }, [isSupported]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (!options.soundEnabled || !audioRef.current) return;

    audioRef.current.currentTime = 0;
    audioRef.current.volume = options.soundVolume;
    audioRef.current.play().catch(() => {
      // Ignore autoplay errors
    });
  }, [options.soundEnabled, options.soundVolume]);

  // Show a notification
  const notify = useCallback(
    (title: string, body: string, notificationOptions?: NotificationInit) => {
      // Check if we should show notification
      if (!options.enabled) return;
      if (!isSupported) return;
      if (permission !== 'granted') return;
      if (options.onlyWhenUnfocused && isTabFocused.current) return;

      // Create and show notification
      const notification = new Notification(title, {
        body,
        icon: notificationOptions?.icon || '/icons/skillancer-icon.png',
        badge: notificationOptions?.badge || '/icons/skillancer-badge.png',
        tag: notificationOptions?.tag,
        data: notificationOptions?.data,
        silent: !options.soundEnabled, // Browser handles sound if not silent
      });

      // Handle click
      if (notificationOptions?.onClick) {
        notification.onclick = () => {
          notificationOptions.onClick?.();
          notification.close();
          window.focus();
        };
      }

      // Play sound if enabled
      if (options.soundEnabled) {
        playSound();
      }

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    },
    [options, isSupported, permission, playSound]
  );

  // Update options
  const updateOptions = useCallback((updates: Partial<NotificationOptions>) => {
    setOptions((prev) => {
      const newOptions = { ...prev, ...updates };

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newOptions));
      } catch {
        // Ignore storage errors
      }

      return newOptions;
    });
  }, []);

  // Can we currently show notifications?
  const canNotify = isSupported && permission === 'granted' && options.enabled;

  return {
    permission,
    isSupported,
    options,
    requestPermission,
    notify,
    playSound,
    updateOptions,
    canNotify,
  };
}

// ============================================================================
// Utility: Message Notification Helper
// ============================================================================

export interface MessageNotificationData {
  conversationId: string;
  messageId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
}

/**
 * Create a notification for a new message
 */
export function createMessageNotification(
  notify: UseNotificationsReturn['notify'],
  data: MessageNotificationData,
  onNavigate: (conversationId: string) => void
) {
  const truncatedContent =
    data.content.length > 100 ? `${data.content.slice(0, 100)}...` : data.content;

  notify(`New message from ${data.senderName}`, truncatedContent, {
    icon: data.senderAvatar,
    tag: `message-${data.conversationId}`, // Replace existing notification for same conversation
    data: { conversationId: data.conversationId, messageId: data.messageId },
    onClick: () => {
      onNavigate(data.conversationId);
    },
  });
}
