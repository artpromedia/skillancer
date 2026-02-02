'use client';

/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Bell, BellOff, BellRing, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerDeviceToken,
  unregisterDeviceToken,
} from '@/lib/firebase';

import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type PermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushPermissionProps {
  /** Called when permission status changes */
  readonly onPermissionChange?: (status: PermissionStatus) => void;
  /** Whether to show as a banner (true) or inline button (false) */
  readonly variant?: 'banner' | 'button' | 'card';
  /** Additional CSS classes */
  readonly className?: string;
  /** Whether the component can be dismissed */
  readonly dismissible?: boolean;
  /** Key for localStorage to remember dismissal */
  readonly dismissKey?: string;
}

// Using PushPermissionProps directly for variants
type _PushPermissionBannerProps = PushPermissionProps & { variant: 'banner' };
type _PushPermissionButtonProps = PushPermissionProps & { variant: 'button' };
type _PushPermissionCardProps = PushPermissionProps & { variant: 'card' };

// =============================================================================
// Component
// =============================================================================

export function PushPermission({
  onPermissionChange,
  variant = 'banner',
  className,
  dismissible = true,
  dismissKey = 'push-permission-dismissed',
}: PushPermissionProps) {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check initial state
  useEffect(() => {
    const checkSupport = () => {
      const supported = isPushSupported();
      setIsSupported(supported);

      if (!supported) {
        setPermissionStatus('unsupported');
        return;
      }

      const permission = getNotificationPermission();
      setPermissionStatus(permission);
    };

    // Check if previously dismissed
    if (dismissible && dismissKey) {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }

    checkSupport();
  }, [dismissible, dismissKey]);

  // Notify parent of permission changes
  useEffect(() => {
    onPermissionChange?.(permissionStatus);
  }, [permissionStatus, onPermissionChange]);

  const handleRequestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const granted = await requestNotificationPermission();

      if (granted) {
        setPermissionStatus('granted');
        setShowSuccess(true);

        // Register the device token
        await registerDeviceToken();

        // Hide success message after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        setPermissionStatus('denied');
        setError('Permission was denied. You can enable notifications in your browser settings.');
      }
    } catch (err) {
      setError('Failed to enable notifications. Please try again.');
      console.error('Push permission error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDisable = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await unregisterDeviceToken();
      // Note: We can't revoke browser permission, but we can unregister the token
      setShowSuccess(false);
    } catch (err) {
      setError('Failed to disable notifications. Please try again.');
      console.error('Push disable error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (dismissKey) {
      localStorage.setItem(dismissKey, 'true');
    }
  }, [dismissKey]);

  // Don't render if dismissed, already granted, or unsupported
  if (isDismissed && permissionStatus !== 'granted') {
    return null;
  }

  if (!isSupported) {
    return null;
  }

  if (permissionStatus === 'granted' && !showSuccess) {
    return null;
  }

  // Render based on variant
  switch (variant) {
    case 'banner':
      return (
        <PushPermissionBannerComponent
          className={className}
          dismissible={dismissible}
          error={error}
          isLoading={isLoading}
          permissionStatus={permissionStatus}
          showSuccess={showSuccess}
          onDisable={handleDisable}
          onDismiss={handleDismiss}
          onRequest={handleRequestPermission}
        />
      );
    case 'button':
      return (
        <PushPermissionButtonComponent
          className={className}
          error={error}
          isLoading={isLoading}
          permissionStatus={permissionStatus}
          showSuccess={showSuccess}
          onDisable={handleDisable}
          onRequest={handleRequestPermission}
        />
      );
    case 'card':
      return (
        <PushPermissionCardComponent
          className={className}
          dismissible={dismissible}
          error={error}
          isLoading={isLoading}
          permissionStatus={permissionStatus}
          showSuccess={showSuccess}
          onDisable={handleDisable}
          onDismiss={handleDismiss}
          onRequest={handleRequestPermission}
        />
      );
    default:
      return null;
  }
}

// =============================================================================
// Sub-components
// =============================================================================

interface PushPermissionComponentProps {
  readonly permissionStatus: PermissionStatus;
  readonly isLoading: boolean;
  readonly showSuccess: boolean;
  readonly error: string | null;
  readonly dismissible?: boolean;
  readonly className?: string;
  readonly onRequest: () => void;
  readonly onDisable: () => void;
  readonly onDismiss?: () => void;
}

function PushPermissionBannerComponent({
  permissionStatus,
  isLoading,
  showSuccess,
  error,
  dismissible: _dismissible,
  className,
  onRequest,
  onDismiss: _onDismiss,
}: Readonly<PushPermissionComponentProps>) {
  // Success state
  if (showSuccess) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-green-200 bg-green-50 px-4 py-3',
          'dark:border-green-800 dark:bg-green-900/20',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Push notifications enabled! You&apos;ll now receive updates in real-time.
          </span>
        </div>
      </div>
    );
  }

  // Denied state
  if (permissionStatus === 'denied') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3',
          'dark:border-amber-800 dark:bg-amber-900/20',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Notifications are blocked
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Enable them in your browser settings to receive updates
            </span>
          </div>
        </div>
        {dismissible && (
          <button
            aria-label="Dismiss"
            className="rounded-full p-1 transition-colors hover:bg-amber-200 dark:hover:bg-amber-800"
            onClick={onDismiss}
          >
            <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </button>
        )}
      </div>
    );
  }

  // Default state (request permission)
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-blue-200 bg-blue-50 px-4 py-3',
        'dark:border-blue-800 dark:bg-blue-900/20',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Stay updated with push notifications
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Get instant alerts for messages, proposals, and payments
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors'
          )}
          disabled={isLoading}
          onClick={onRequest}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enabling...</span>
            </>
          ) : (
            <>
              <Bell className="h-4 w-4" />
              <span>Enable</span>
            </>
          )}
        </button>
        {dismissible && (
          <button
            aria-label="Dismiss"
            className="rounded-lg p-2 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
            onClick={onDismiss}
          >
            <X className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </button>
        )}
      </div>
      {error && (
        <div className="absolute left-0 right-0 top-full bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function PushPermissionButtonComponent({
  permissionStatus,
  isLoading,
  showSuccess,
  error: _error,
  className,
  onRequest,
  onDisable,
}: Readonly<PushPermissionComponentProps>) {
  // If granted, show a toggle-off button
  if (permissionStatus === 'granted' && !showSuccess) {
    return (
      <button
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'bg-gray-100 text-gray-700 hover:bg-gray-200',
          'dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          className
        )}
        disabled={isLoading}
        title="Disable push notifications"
        onClick={onDisable}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
        <span>Disable Notifications</span>
      </button>
    );
  }

  // Success state
  if (showSuccess) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'bg-green-100 text-green-700',
          'dark:bg-green-900/30 dark:text-green-300',
          className
        )}
      >
        <CheckCircle className="h-4 w-4" />
        <span>Notifications Enabled!</span>
      </div>
    );
  }

  // Denied state
  if (permissionStatus === 'denied') {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'cursor-not-allowed bg-amber-100 text-amber-700',
          'dark:bg-amber-900/30 dark:text-amber-300',
          className
        )}
        title="Notifications blocked - enable in browser settings"
      >
        <BellOff className="h-4 w-4" />
        <span>Notifications Blocked</span>
      </button>
    );
  }

  // Default state
  return (
    <div className="flex flex-col gap-1">
      <button
        className={cn(
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
          'bg-blue-600 text-white hover:bg-blue-700',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
          className
        )}
        disabled={isLoading}
        onClick={onRequest}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Enabling...</span>
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            <span>Enable Notifications</span>
          </>
        )}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

function PushPermissionCardComponent({
  permissionStatus,
  isLoading,
  showSuccess,
  error,
  dismissible,
  className,
  onRequest,
  onDisable: _onDisable,
  onDismiss,
}: Readonly<PushPermissionComponentProps>) {
  // Success state
  if (showSuccess) {
    return (
      <div
        className={cn(
          'relative rounded-xl border-2 border-green-200 bg-green-50 p-6',
          'dark:border-green-800 dark:bg-green-900/20',
          className
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-green-100 p-3 dark:bg-green-800">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
              Notifications Enabled!
            </h3>
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              You&apos;ll now receive real-time updates for messages, proposals, payments, and more.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Denied state
  if (permissionStatus === 'denied') {
    return (
      <div
        className={cn(
          'relative rounded-xl border-2 border-amber-200 bg-amber-50 p-6',
          'dark:border-amber-800 dark:bg-amber-900/20',
          className
        )}
      >
        {dismissible && (
          <button
            aria-label="Dismiss"
            className="absolute right-4 top-4 rounded-full p-1 transition-colors hover:bg-amber-200 dark:hover:bg-amber-800"
            onClick={onDismiss}
          >
            <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </button>
        )}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-amber-100 p-3 dark:bg-amber-800">
            <BellOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
              Notifications Blocked
            </h3>
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
              Push notifications are blocked by your browser. To enable them:
            </p>
            <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-amber-700 dark:text-amber-300">
              <li>Click the lock/info icon in your browser&apos;s address bar</li>
              <li>Find &quot;Notifications&quot; in the permissions</li>
              <li>Change it to &quot;Allow&quot;</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Default state
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-blue-200 bg-blue-50 p-6',
        'dark:border-blue-800 dark:bg-blue-900/20',
        className
      )}
    >
      {dismissible && (
        <button
          aria-label="Dismiss"
          className="absolute right-4 top-4 rounded-full p-1 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
          onClick={onDismiss}
        >
          <X className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </button>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-full bg-blue-100 p-3 dark:bg-blue-800">
          <BellRing className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
            Enable Push Notifications
          </h3>
          <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
            Get instant alerts when you receive messages, proposals, payments, and important
            updates.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span>New messages from clients and freelancers</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span>Proposal updates and contract changes</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span>Payment confirmations and milestones</span>
              </li>
            </ul>
            <button
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors'
              )}
              disabled={isLoading}
              onClick={onRequest}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enabling Notifications...</span>
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  <span>Enable Push Notifications</span>
                </>
              )}
            </button>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Hook for checking push permission status
// =============================================================================

export function usePushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);

    if (supported) {
      setStatus(getNotificationPermission());

      // Listen for permission changes (some browsers support this)
      if ('permissions' in navigator) {
        navigator.permissions
          .query({ name: 'notifications' as PermissionName })
          .then((result) => {
            result.onchange = () => {
              setStatus(getNotificationPermission());
            };
          })
          .catch(() => {
            // Permissions API not fully supported, ignore
          });
      }
    } else {
      setStatus('unsupported');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setStatus('granted');
      await registerDeviceToken();
    } else {
      setStatus('denied');
    }
    return granted;
  }, []);

  return {
    status,
    isSupported,
    isGranted: status === 'granted',
    isDenied: status === 'denied',
    isDefault: status === 'default',
    requestPermission,
  };
}

export default PushPermission;
