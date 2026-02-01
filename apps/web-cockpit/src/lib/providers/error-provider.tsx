/**
 * Error Provider
 *
 * Provides error boundary and global error handling for Cockpit app.
 *
 * @module lib/providers/error-provider
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, type ReactNode, Component, type ErrorInfo } from 'react';

import { ErrorPage } from '@/components/errors/ErrorPage';
import {
  ToastProvider,
  showApiErrorToast,
  showNetworkErrorToast,
  setGlobalToast,
  useToast,
} from '@/components/errors/ErrorToast';

// ============================================================================
// Types
// ============================================================================

export interface ErrorProviderProps {
  readonly children: ReactNode;
}

interface ApiErrorEvent extends CustomEvent {
  detail: {
    code?: string;
    status?: number;
    message?: string;
  };
}

// ============================================================================
// Dynamic Import for Error Tracking
// ============================================================================

let errorTracking: typeof import('@skillancer/error-tracking/react') | null = null;

async function loadErrorTracking() {
  if (globalThis.window && !errorTracking) {
    try {
      errorTracking = await import('@skillancer/error-tracking/react');

      errorTracking.initErrorTracking({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_VERSION,
        appName: 'web-cockpit',
        sampleRate: process.env.NODE_ENV === 'production' ? 1 : 0.1,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1,
      });
    } catch (e) {
      console.warn('[ErrorProvider] Error tracking not available:', e);
    }
  }
  return errorTracking;
}

// ============================================================================
// Error Fallback Component
// ============================================================================

interface ErrorFallbackProps {
  readonly error: Error;
  readonly resetError: () => void;
}

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <ErrorPage
      showDashboardButton
      error={error}
      message="An unexpected error occurred. We've been notified and are working on a fix."
      title="Something went wrong"
      type="error"
      onRetry={resetError}
    />
  );
}

// ============================================================================
// Error Boundary Class
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<
  { children: ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  ErrorBoundaryState
> {
  constructor(props: {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return <ErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// Error Handler Component (inside Toast context)
// ============================================================================

function ErrorHandler({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();

  // Register global toast function
  useEffect(() => {
    setGlobalToast(showToast);
  }, [showToast]);

  // Handle global API errors
  const handleApiError = useCallback(
    (event: Event) => {
      const apiEvent = event as ApiErrorEvent;
      const { code, status, message } = apiEvent.detail;

      // Handle authentication errors - redirect to login
      if (status === 401 || code === 'AUTH_SESSION_EXPIRED' || code === 'AUTH_UNAUTHORIZED') {
        if (globalThis.window) {
          globalThis.localStorage.removeItem('cockpit_auth_token');
          globalThis.sessionStorage.removeItem('cockpit_auth_token');
        }

        const returnUrl = encodeURIComponent(globalThis.location.pathname + globalThis.location.search);
        router.push(`/auth/login?returnUrl=${returnUrl}&reason=session_expired`);
        return;
      }

      // Handle forbidden errors
      if (status === 403 || code === 'AUTH_FORBIDDEN') {
        showApiErrorToast({
          code: code || 'AUTH_FORBIDDEN',
          status,
          message: message || "You don't have permission to perform this action.",
        });
        return;
      }

      // Handle rate limiting
      if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
        showApiErrorToast({ code: 'RATE_LIMIT_EXCEEDED', status });
        return;
      }

      // Handle network errors
      if (code === 'NETWORK_ERROR' || message?.includes('network')) {
        showNetworkErrorToast();
        return;
      }

      // Handle other API errors
      showApiErrorToast({ code, status, message });
    },
    [router, showToast]
  );

  // Set up global error listeners
  useEffect(() => {
    // Initialize error tracking
    loadErrorTracking().then((tracking) => {
      if (tracking) {
        console.log('[ErrorProvider] Error tracking initialized');
      }
    });

    // Listen for API errors
    globalThis.addEventListener('api-error', handleApiError);

    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[ErrorProvider] Unhandled rejection:', event.reason);

      loadErrorTracking().then((tracking) => {
        tracking?.captureError(event.reason, {
          component: 'global',
          action: 'unhandled-rejection',
        });
      });
    };

    globalThis.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      globalThis.removeEventListener('api-error', handleApiError);
      globalThis.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleApiError]);

  return <>{children}</>;
}

// ============================================================================
// Main Error Provider
// ============================================================================

export function ErrorProvider({ children }: ErrorProviderProps) {
  const handleBoundaryError = useCallback((error: Error) => {
    console.error('[ErrorProvider] Error boundary caught:', error);

    loadErrorTracking().then((tracking) => {
      tracking?.captureError(error, {
        component: 'ErrorBoundary',
        action: 'render-error',
      });
    });
  }, []);

  return (
    <ErrorBoundaryClass onError={handleBoundaryError}>
      <ToastProvider>
        <ErrorHandler>{children}</ErrorHandler>
      </ToastProvider>
    </ErrorBoundaryClass>
  );
}

// ============================================================================
// Utility: Dispatch API Error Event
// ============================================================================

export function dispatchApiError(detail: {
  code?: string;
  status?: number;
  message?: string;
}): void {
  if (globalThis.window) {
    globalThis.dispatchEvent(new CustomEvent('api-error', { detail }));
  }
}

export default ErrorProvider;
