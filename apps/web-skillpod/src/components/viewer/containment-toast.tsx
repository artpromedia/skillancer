/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
'use client';

/**
 * Containment Toast Component
 *
 * Data containment notification toasts:
 * - Shows when containment action occurs
 * - Different styles for blocks, info, success
 * - Auto-dismiss with optional action button
 * - Stacking for multiple toasts
 */

import { Button, cn } from '@skillancer/ui';
import {
  AlertTriangle,
  CheckCircle,
  Clipboard,
  FileX,
  Shield,
  X,
  Monitor,
  Usb,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ContainmentEventType =
  | 'clipboard_blocked'
  | 'clipboard_logged'
  | 'file_blocked'
  | 'file_pending'
  | 'file_approved'
  | 'screenshot_blocked'
  | 'usb_blocked'
  | 'policy_updated'
  | 'session_warning';

export type ToastVariant = 'warning' | 'info' | 'success' | 'error';

export interface ContainmentEvent {
  id: string;
  type: ContainmentEventType;
  message: string;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: Date;
  autoDismiss?: boolean;
  dismissAfter?: number;
}

interface ContainmentToastProps {
  events: ContainmentEvent[];
  onDismiss: (eventId: string) => void;
  maxVisible?: number;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EVENT_CONFIG: Record<
  ContainmentEventType,
  {
    icon: React.ComponentType<{ className?: string }>;
    variant: ToastVariant;
    defaultMessage: string;
  }
> = {
  clipboard_blocked: {
    icon: Clipboard,
    variant: 'warning',
    defaultMessage: 'Clipboard operation blocked by security policy',
  },
  clipboard_logged: {
    icon: Clipboard,
    variant: 'info',
    defaultMessage: 'Clipboard content logged for audit',
  },
  file_blocked: {
    icon: FileX,
    variant: 'error',
    defaultMessage: 'File transfer blocked by security policy',
  },
  file_pending: {
    icon: FileX,
    variant: 'info',
    defaultMessage: 'File transfer requires approval',
  },
  file_approved: {
    icon: CheckCircle,
    variant: 'success',
    defaultMessage: 'File transfer approved',
  },
  screenshot_blocked: {
    icon: Monitor,
    variant: 'warning',
    defaultMessage: 'Screenshot attempt detected and blocked',
  },
  usb_blocked: {
    icon: Usb,
    variant: 'warning',
    defaultMessage: 'USB device access denied',
  },
  policy_updated: {
    icon: Shield,
    variant: 'info',
    defaultMessage: 'Security policy updated',
  },
  session_warning: {
    icon: AlertTriangle,
    variant: 'warning',
    defaultMessage: 'Session warning',
  },
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800',
  info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800',
  success: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800',
  error: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800',
};

const VARIANT_ICON_STYLES: Record<ToastVariant, string> = {
  warning: 'text-yellow-600 dark:text-yellow-400',
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
};

const DEFAULT_DISMISS_TIME = 5000;

// ============================================================================
// SINGLE TOAST
// ============================================================================

interface SingleToastProps {
  event: ContainmentEvent;
  onDismiss: () => void;
  index: number;
}

function SingleToast({ event, onDismiss, index }: Readonly<SingleToastProps>) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss
    if (event.autoDismiss !== false) {
      const timeout = setTimeout(() => {
        handleDismiss();
      }, event.dismissAfter || DEFAULT_DISMISS_TIME);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [event.autoDismiss, event.dismissAfter]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  return (
    <div
      aria-live="polite"
      className={cn(
        'relative w-96 rounded-lg border p-4 shadow-lg',
        'transform transition-all duration-300 ease-out',
        VARIANT_STYLES[config.variant],
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
      role="alert"
      style={{
        marginBottom: '0.5rem',
      }}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn('flex-shrink-0', VARIANT_ICON_STYLES[config.variant])}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">
            {event.message || config.defaultMessage}
          </p>
          {event.details && <p className="text-muted-foreground mt-1 text-xs">{event.details}</p>}
          {event.action && (
            <Button
              className="mt-2 h-auto p-0 text-xs"
              size="sm"
              variant="link"
              onClick={event.action.onClick}
            >
              {event.action.label}
            </Button>
          )}
        </div>

        {/* Dismiss button */}
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {event.autoDismiss !== false && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg bg-black/5">
          <div
            className={cn(
              'h-full transition-all ease-linear',
              config.variant === 'warning' && 'bg-yellow-500',
              config.variant === 'info' && 'bg-blue-500',
              config.variant === 'success' && 'bg-green-500',
              config.variant === 'error' && 'bg-red-500'
            )}
            style={{
              animation: `shrink ${event.dismissAfter || DEFAULT_DISMISS_TIME}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* styled-jsx is a built-in Next.js CSS-in-JS solution */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// COLLAPSED COUNT
// ============================================================================

interface CollapsedCountProps {
  count: number;
}

function CollapsedCount({ count }: Readonly<CollapsedCountProps>) {
  return (
    <div className="bg-muted/80 w-96 rounded-lg border p-3 text-center backdrop-blur-sm">
      <span className="text-muted-foreground text-sm">
        +{count} more notification{count > 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ContainmentToast({
  events,
  onDismiss,
  maxVisible = 3,
  className,
}: Readonly<ContainmentToastProps>) {
  const visibleEvents = events.slice(0, maxVisible);
  const hiddenCount = Math.max(0, events.length - maxVisible);

  if (events.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex flex-col-reverse items-end gap-2',
        className
      )}
    >
      {hiddenCount > 0 && <CollapsedCount count={hiddenCount} />}

      {visibleEvents.map((event, index) => (
        <SingleToast
          key={event.id}
          event={event}
          index={index}
          onDismiss={() => onDismiss(event.id)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// HOOK FOR MANAGING TOASTS
// ============================================================================

export function useContainmentToasts() {
  const [events, setEvents] = useState<ContainmentEvent[]>([]);

  const addEvent = useCallback(
    (
      type: ContainmentEventType,
      options?: Partial<Omit<ContainmentEvent, 'id' | 'type' | 'timestamp'>>
    ) => {
      const newEvent: ContainmentEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        message: options?.message || EVENT_CONFIG[type].defaultMessage,
        details: options?.details,
        action: options?.action,
        timestamp: new Date(),
        autoDismiss: options?.autoDismiss,
        dismissAfter: options?.dismissAfter,
      };

      setEvents((prev) => [newEvent, ...prev]);
      return newEvent.id;
    },
    []
  );

  const dismissEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  const clearAll = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    addEvent,
    dismissEvent,
    clearAll,
  };
}
