/**
 * ErrorToast Component
 *
 * Toast notifications for API errors and user feedback.
 * Integrates with sonner toast library from @skillancer/ui.
 *
 * @module components/errors/ErrorToast
 */

'use client';

import { toast } from '@skillancer/ui';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ShowToastOptions {
  /** Toast title */
  title: string;
  /** Toast message/description */
  message?: string;
  /** Toast type */
  type?: ToastType;
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Whether the toast can be dismissed */
  dismissible?: boolean;
}

export interface ApiErrorToastOptions {
  /** Error code from API */
  code?: string;
  /** HTTP status code */
  status?: number;
  /** Error message */
  message?: string;
  /** Action to retry */
  onRetry?: () => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const TOAST_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

// ============================================================================
// Error Messages by Code
// ============================================================================

const ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_UNAUTHORIZED: "You're not authorized to perform this action.",
  AUTH_FORBIDDEN: "You don't have permission to access this resource.",

  // Validation
  VALIDATION_ERROR: 'Please check your input and try again.',
  VALIDATION_REQUIRED: 'Please fill in all required fields.',

  // Network
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: "You've made too many requests. Please wait a moment.",

  // Server errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',

  // Generic
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user-friendly message for error code
 */
function getErrorMessage(code?: string, message?: string): string {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return message || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Get toast type based on HTTP status
 */
function getToastTypeFromStatus(status?: number): ToastType {
  if (!status) return 'error';
  if (status >= 500) return 'error';
  if (status === 429) return 'warning';
  if (status >= 400) return 'warning';
  return 'error';
}

// ============================================================================
// Toast Functions
// ============================================================================

/**
 * Show a toast notification
 *
 * @example
 * ```typescript
 * showToast({
 *   title: 'Profile updated',
 *   message: 'Your changes have been saved.',
 *   type: 'success',
 * });
 * ```
 */
export function showToast({
  title,
  message,
  type = 'info',
  duration = 5000,
  action,
  dismissible = true,
}: ShowToastOptions): string | number {
  const toastFn = {
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
    success: toast.success,
  }[type];

  return toastFn(title, {
    description: message,
    duration,
    dismissible,
    action: action
      ? {
          label: action.label,
          onClick: action.onClick,
        }
      : undefined,
  });
}

/**
 * Show an API error toast
 *
 * @example
 * ```typescript
 * showApiErrorToast({
 *   code: 'AUTH_SESSION_EXPIRED',
 *   status: 401,
 *   onRetry: () => refetch(),
 * });
 * ```
 */
export function showApiErrorToast({
  code,
  status,
  message,
  onRetry,
}: ApiErrorToastOptions): string | number {
  const displayMessage = getErrorMessage(code, message);
  const type = getToastTypeFromStatus(status);

  return showToast({
    title: type === 'error' ? 'Error' : 'Warning',
    message: displayMessage,
    type,
    action: onRetry
      ? {
          label: 'Retry',
          onClick: onRetry,
        }
      : undefined,
  });
}

/**
 * Show a network error toast
 */
export function showNetworkErrorToast(onRetry?: () => void): string | number {
  return showApiErrorToast({
    code: 'NETWORK_ERROR',
    onRetry,
  });
}

/**
 * Show a validation error toast
 */
export function showValidationErrorToast(message?: string): string | number {
  return showToast({
    title: 'Validation Error',
    message: message || ERROR_MESSAGES.VALIDATION_ERROR,
    type: 'warning',
  });
}

/**
 * Show a success toast
 */
export function showSuccessToast(title: string, message?: string): string | number {
  return showToast({
    title,
    message,
    type: 'success',
  });
}

/**
 * Dismiss a specific toast
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  toast.dismiss();
}

// ============================================================================
// Export ErrorToast component for manual rendering
// ============================================================================

export interface ErrorToastProps {
  readonly type: ToastType;
  readonly title: string;
  readonly message?: string;
  readonly onDismiss?: () => void;
}

/**
 * ErrorToast component for manual rendering
 */
export function ErrorToast({ type, title, message, onDismiss }: ErrorToastProps) {
  const Icon = TOAST_ICONS[type];
  const iconColors = {
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    success: 'text-green-500',
  };

  return (
    <div className="flex items-start gap-3">
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconColors[type]}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        {message && <p className="text-muted-foreground mt-1 text-sm">{message}</p>}
      </div>
      {onDismiss && (
        <button
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground -mt-1"
          onClick={onDismiss}
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default ErrorToast;
