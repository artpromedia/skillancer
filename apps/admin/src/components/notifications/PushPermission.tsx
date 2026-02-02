'use client';

import { Bell, BellOff, BellRing, X, CheckCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerDeviceToken,
  unregisterDeviceToken,
} from '@/lib/firebase';

import { cn } from '@/lib/utils';

type PermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushPermissionProps {
  onPermissionChange?: (status: PermissionStatus) => void;
  variant?: 'banner' | 'button' | 'card';
  className?: string;
  dismissible?: boolean;
  dismissKey?: string;
}

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

  useEffect(() => {
    const checkSupport = async () => {
      const supported = isPushSupported();
      setIsSupported(supported);
      if (!supported) {
        setPermissionStatus('unsupported');
        return;
      }
      const permission = getNotificationPermission();
      setPermissionStatus(permission);
    };

    if (dismissible && dismissKey) {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed === 'true') setIsDismissed(true);
    }

    checkSupport();
  }, [dismissible, dismissKey]);

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
        await registerDeviceToken();
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setPermissionStatus('denied');
        setError('Permission denied.');
      }
    } catch (err) {
      setError('Failed to enable notifications.');
      console.error('Push permission error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (dismissKey) localStorage.setItem(dismissKey, 'true');
  }, [dismissKey]);

  if (isDismissed && permissionStatus !== 'granted') return null;
  if (!isSupported) return null;
  if (permissionStatus === 'granted' && !showSuccess) return null;

  if (variant === 'button') {
    if (showSuccess) {
      return (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700',
            className
          )}
        >
          <CheckCircle className="h-4 w-4" />
          Enabled!
        </div>
      );
    }
    if (permissionStatus === 'denied') {
      return (
        <button
          disabled
          className={cn(
            'flex cursor-not-allowed items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700',
            className
          )}
        >
          <BellOff className="h-4 w-4" />
          Blocked
        </button>
      );
    }
    return (
      <button
        className={cn(
          'flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50',
          className
        )}
        disabled={isLoading}
        onClick={handleRequestPermission}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Enable Notifications
      </button>
    );
  }

  // Banner variant
  if (showSuccess) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-green-200 bg-green-50 px-4 py-3',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">Push notifications enabled!</span>
        </div>
      </div>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">Notifications blocked</span>
        </div>
        {dismissible && (
          <button className="rounded-full p-1 hover:bg-amber-200" onClick={handleDismiss}>
            <X className="h-4 w-4 text-amber-600" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-blue-200 bg-blue-50 px-4 py-3',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <BellRing className="h-5 w-5 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          Enable push notifications for admin alerts
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading}
          onClick={handleRequestPermission}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Enable
        </button>
        {dismissible && (
          <button className="rounded-lg p-2 hover:bg-blue-200" onClick={handleDismiss}>
            <X className="h-4 w-4 text-blue-600" />
          </button>
        )}
      </div>
    </div>
  );
}

export function usePushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('default');
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    if (supported) setStatus(getNotificationPermission());
    else setStatus('unsupported');
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
