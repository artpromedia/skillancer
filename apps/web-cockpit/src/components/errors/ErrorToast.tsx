/**
 * ErrorToast Component
 *
 * Toast notifications for API errors and user feedback.
 * Uses native toast implementation for Cockpit dashboard.
 *
 * @module components/errors/ErrorToast
 */

'use client';

import { AlertTriangle, Info, CheckCircle2, XCircle, X } from 'lucide-react';
import { useState, createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ShowToastOptions {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export interface ApiErrorToastOptions {
  code?: string;
  status?: number;
  message?: string;
  onRetry?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const TOAST_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const TOAST_STYLES = {
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    title: 'text-red-800 dark:text-red-200',
    message: 'text-red-600 dark:text-red-300',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    title: 'text-amber-800 dark:text-amber-200',
    message: 'text-amber-600 dark:text-amber-300',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-200',
    message: 'text-blue-600 dark:text-blue-300',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-200',
    message: 'text-green-600 dark:text-green-300',
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  AUTH_UNAUTHORIZED: "You're not authorized to perform this action.",
  AUTH_FORBIDDEN: "You don't have permission to access this resource.",
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  RATE_LIMIT_EXCEEDED: "You've made too many requests. Please wait a moment.",
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

// ============================================================================
// Toast Context
// ============================================================================

interface ToastContextValue {
  toasts: Toast[];
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

// Helper to filter out a toast by id
function filterOutToast(toasts: Toast[], id: string): Toast[] {
  return toasts.filter((t) => t.id !== id);
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// Toast Provider
// ============================================================================

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((options: ShowToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const toast: Toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? 5000,
      dismissible: options.dismissible ?? true,
      action: options.action,
    };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => filterOutToast(prev, id));
      }, toast.duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => filterOutToast(prev, id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue = useMemo(
    () => ({ toasts, showToast, dismissToast, dismissAll }),
    [toasts, showToast, dismissToast, dismissAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Toast Container
// ============================================================================

function ToastContainer({
  toasts,
  onDismiss,
}: Readonly<{
  toasts: Toast[];
  onDismiss: (id: string) => void;
}>) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

// ============================================================================
// Toast Item
// ============================================================================

function ToastItem({ toast, onDismiss }: Readonly<{ toast: Toast; onDismiss: () => void }>) {
  const Icon = TOAST_ICONS[toast.type];
  const styles = TOAST_STYLES[toast.type];

  return (
    <div
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg transition-all ${styles.bg} ${styles.border}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${styles.icon}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${styles.title}`}>{toast.title}</p>
        {toast.message && <p className={`mt-1 text-sm ${styles.message}`}>{toast.message}</p>}
        {toast.action && (
          <button
            className={`mt-2 text-sm font-medium underline ${styles.title}`}
            onClick={toast.action.onClick}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.dismissible && (
        <button
          aria-label="Dismiss"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions (for use outside components)
// ============================================================================

let globalShowToast: ((options: ShowToastOptions) => string) | null = null;

export function setGlobalToast(showFn: (options: ShowToastOptions) => string): void {
  globalShowToast = showFn;
}

export function showToast(options: ShowToastOptions): string {
  if (!globalShowToast) {
    console.warn('[Toast] ToastProvider not initialized');
    return '';
  }
  return globalShowToast(options);
}

export function showApiErrorToast(options: ApiErrorToastOptions): string {
  const message =
    options.code && ERROR_MESSAGES[options.code]
      ? ERROR_MESSAGES[options.code]
      : options.message || ERROR_MESSAGES.UNKNOWN_ERROR;

  const type: ToastType = options.status && options.status >= 500 ? 'error' : 'warning';

  return showToast({
    title: type === 'error' ? 'Error' : 'Warning',
    message,
    type,
    action: options.onRetry ? { label: 'Retry', onClick: options.onRetry } : undefined,
  });
}

export function showNetworkErrorToast(onRetry?: () => void): string {
  return showApiErrorToast({ code: 'NETWORK_ERROR', onRetry });
}

export function showSuccessToast(title: string, message?: string): string {
  return showToast({ title, message, type: 'success' });
}

export default ToastProvider;
