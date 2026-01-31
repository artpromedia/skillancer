/**
 * ErrorPage Component
 *
 * Full-page error display for unrecoverable errors, 404s, and server errors.
 *
 * @module components/errors/ErrorPage
 */

'use client';

import { AlertTriangle, FileQuestion, ShieldX, ServerCrash, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

export interface ErrorPageProps {
  /** Error type to display */
  type?: 'error' | '404' | '403' | '500' | 'offline';
  /** Error code (e.g., 404, 500) */
  code?: number;
  /** Main error title */
  title?: string;
  /** Detailed error message */
  message?: string;
  /** The actual error object (for development) */
  error?: Error;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Whether to show the back button */
  showBackButton?: boolean;
  /** Whether to show the home button */
  showHomeButton?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ERROR_CONTENT = {
  error: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    message: "We're sorry, but something unexpected happened. Please try again.",
    iconColor: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
  },
  '404': {
    icon: FileQuestion,
    title: 'Page not found',
    message: "The page you're looking for doesn't exist or has been moved.",
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
  },
  '403': {
    icon: ShieldX,
    title: 'Access denied',
    message: "You don't have permission to access this page.",
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20',
  },
  '500': {
    icon: ServerCrash,
    title: 'Server error',
    message: "We're experiencing technical difficulties. Please try again later.",
    iconColor: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
  },
  offline: {
    icon: AlertTriangle,
    title: 'You appear to be offline',
    message: 'Please check your internet connection and try again.',
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
  },
};

// ============================================================================
// Component
// ============================================================================

export function ErrorPage({
  type = 'error',
  code,
  title,
  message,
  error,
  onRetry,
  showBackButton = true,
  showHomeButton = true,
}: ErrorPageProps) {
  const router = useRouter();
  const content = ERROR_CONTENT[type] || ERROR_CONTENT.error;
  const Icon = content.icon;

  const displayTitle = title || content.title;
  const displayMessage = message || content.message;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div
          className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${content.bgColor}`}
        >
          <Icon className={`h-10 w-10 ${content.iconColor}`} />
        </div>

        {/* Error Code */}
        {code && <p className="text-muted-foreground mb-2 text-sm font-medium">Error {code}</p>}

        {/* Title */}
        <h1 className="mb-3 text-2xl font-bold tracking-tight">{displayTitle}</h1>

        {/* Message */}
        <p className="text-muted-foreground mb-8">{displayMessage}</p>

        {/* Development Error Details */}
        {error && process.env.NODE_ENV === 'development' && (
          <div className="bg-muted mb-8 rounded-lg p-4 text-left">
            <p className="mb-2 text-sm font-medium text-red-500">
              {error.name}: {error.message}
            </p>
            <pre className="text-muted-foreground overflow-x-auto text-xs">{error.stack}</pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onRetry && (
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          )}

          {showBackButton && (
            <button
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
              onClick={() => router.back()}
            >
              Go back
            </button>
          )}

          {showHomeButton && (
            <Link
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
              href="/"
            >
              <Home className="h-4 w-4" />
              Go home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorPage;
