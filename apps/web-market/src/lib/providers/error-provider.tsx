/**
 * Error Provider
 *
 * Provides error boundary and global error handling for the app.
 *
 * @module lib/providers/error-provider
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, type ReactNode, Component, type ErrorInfo } from 'react';

import { ErrorPage } from '@/components/errors/ErrorPage';
import { showApiErrorToast, showNetworkErrorToast } from '@/components/errors/ErrorToast';

// ============================================================================
// Types
// ============================================================================

export interface ErrorProviderProps {
  children: ReactNode;
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

// Import error tracking dynamically to avoid SSR issues
let errorTracking: typeof import('@skillancer/error-tracking/react') | null = null;

async function loadErrorTracking() {
  if (typeof window !== 'undefined' && !errorTracking) {
    try {
      errorTracking = await import('@skillancer/error-tracking/react');

      // Initialize Sentry
      errorTracking.initErrorTracking({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_VERSION,
        appName: 'web-market',
        sampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.1,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
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
  error: Error;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <ErrorPage
      showHomeButton
      error={error}
      message="An unexpected error occurred. We've been notified and are working on a fix."
      title="Something went wrong"
      type="error"
      onRetry={resetError}
    />
  );
}

// ============================================================================
// Custom Error Boundary (fallback when Sentry not available)
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class FallbackErrorBoundary extends Component<
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
// Error Provider Component
// ============================================================================

/**
 * ErrorProvider wraps the app with error boundary and global error handling
 *
 * @example
 * ```tsx
 * <ErrorProvider>
 *   <App />
 * </ErrorProvider>
 * ```
 */
export function ErrorProvider({ children }: ErrorProviderProps) {
  const router = useRouter();

  // Handle global API errors
  const handleApiError = useCallback(
    (event: Event) => {
      const apiEvent = event as ApiErrorEvent;
      const { code, status, message } = apiEvent.detail;

      // Handle authentication errors
      if (status === 401 || code === 'AUTH_SESSION_EXPIRED' || code === 'AUTH_UNAUTHORIZED') {
        // Clear any stored auth state
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_token');
          window.sessionStorage.removeItem('auth_token');
        }

        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
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
        showApiErrorToast({
          code: 'RATE_LIMIT_EXCEEDED',
          status,
        });
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
    [router]
  );

  // Set up global error listeners
  useEffect(() => {
    // Initialize error tracking
    loadErrorTracking().then((tracking) => {
      if (tracking) {
        console.log('[ErrorProvider] Error tracking initialized');
      }
    });

    // Listen for API errors dispatched via custom events
    window.addEventListener('api-error', handleApiError);

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

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('api-error', handleApiError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleApiError]);

  // Handle errors in the error boundary
  const handleBoundaryError = useCallback((error: Error) => {
    console.error('[ErrorProvider] Error boundary caught:', error);

    loadErrorTracking().then((tracking) => {
      tracking?.captureError(error, {
        component: 'ErrorBoundary',
        action: 'render-error',
      });
    });
  }, []);

  return <FallbackErrorBoundary onError={handleBoundaryError}>{children}</FallbackErrorBoundary>;
}

// ============================================================================
// Utility: Dispatch API Error Event
// ============================================================================

/**
 * Dispatch an API error event to trigger global error handling
 *
 * @example
 * ```typescript
 * // In API client or fetch wrapper
 * dispatchApiError({
 *   code: 'AUTH_SESSION_EXPIRED',
 *   status: 401,
 *   message: 'Your session has expired',
 * });
 * ```
 */
export function dispatchApiError(detail: {
  code?: string;
  status?: number;
  message?: string;
}): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-error', { detail }));
  }
}

export default ErrorProvider;
