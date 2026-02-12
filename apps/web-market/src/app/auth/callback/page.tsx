'use client';

/**
 * OAuth Callback Page
 *
 * Handles the redirect from OAuth providers after successful authentication.
 * Reads tokens from URL query parameters, stores them, and redirects to the dashboard.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresIn = searchParams.get('expires_in');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(searchParams.get('error_description') || 'Authentication failed');
      return;
    }

    if (!accessToken || !refreshToken) {
      setError('Missing authentication tokens');
      return;
    }

    try {
      // Store tokens in localStorage (matching the key names used by WebMarketTokenStorage)
      localStorage.setItem('skillancer_access_token', accessToken);
      localStorage.setItem('skillancer_refresh_token', refreshToken);

      if (expiresIn) {
        localStorage.setItem(
          'skillancer_token_expires_at',
          String(Date.now() + Number(expiresIn) * 1000)
        );
      }

      // Dispatch token event for cross-tab sync
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'skillancer_access_token',
          newValue: accessToken,
        })
      );

      // Redirect to dashboard
      router.replace('/dashboard');
    } catch {
      setError('Failed to store authentication tokens');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 rounded-lg bg-red-50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-800">Authentication Failed</h2>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <a className="text-primary text-sm hover:underline" href="/login">
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="text-center">
        <div className="border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
