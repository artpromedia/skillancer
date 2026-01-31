'use client';

import { useEffect } from 'react';

import { ErrorPage } from '@/components/errors/ErrorPage';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary page for Next.js App Router
 * Catches errors in the route segment and displays a user-friendly error page
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in development
    console.error('[Error Page] Application error:', error);

    // Report to error tracking service
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Package may not be available at build time
      import('@skillancer/error-tracking/react')
        .then(
          (tracking: {
            captureError: (error: Error, context: Record<string, unknown>) => void;
          }) => {
            tracking.captureError(error, {
              component: 'ErrorPage',
              action: 'render',
              extra: { digest: error.digest },
            });
          }
        )
        .catch(() => {
          // Error tracking not available
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
