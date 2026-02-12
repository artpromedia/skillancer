'use client';

/**
 * OAuth Error Page
 *
 * Displays errors from failed OAuth authentication attempts.
 */

import { Button } from '@skillancer/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function OAuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'unknown_error';
  const errorDescription =
    searchParams.get('error_description') || 'An unexpected error occurred during authentication.';

  const errorMessages: Record<string, string> = {
    oauth_error: 'There was a problem with the social login provider.',
    server_error: 'Our servers encountered an error. Please try again.',
    invalid_request: 'The authentication request was invalid.',
    access_denied: 'Access was denied. Please try again.',
    unknown_error: 'An unexpected error occurred.',
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center py-12">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-red-800">
            {errorMessages[error] || errorMessages.unknown_error}
          </h2>
          <p className="text-sm text-red-600">{errorDescription}</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <a href="/login">Back to Login</a>
          </Button>
          <Button asChild>
            <a href="/signup">Create Account</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <OAuthErrorContent />
    </Suspense>
  );
}
