'use client';

import { useEffect } from 'react';

import { ErrorPage } from '@/components/errors/ErrorPage';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

/**
 * Global error boundary page for Next.js App Router
 * Catches errors in the route segment and displays a user-friendly error page
 */
export default function ErrorBoundaryPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in development
    console.error('[Error Page] Application error:', error);

    // Report to error tracking service (logged to console for now)
    if (globalThis.window) {
      console.error('[Error Tracking]', {
        component: 'ErrorPage',
        action: 'render',
        message: error.message,
        digest: error.digest,
      });
    }
  }, [error]);

  return (
    <ErrorPage
      showBackButton
      showHomeButton
      error={error}
      message="We apologize for the inconvenience. An unexpected error has occurred."
      title="Something went wrong"
      type="error"
      onRetry={reset}
    />
  );
}
