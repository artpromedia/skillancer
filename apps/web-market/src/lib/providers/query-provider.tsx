/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-redundant-type-constituents */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { dispatchApiError } from './error-provider';

/**
 * Extract error details from various error types
 */
function extractErrorDetails(error: unknown): { code?: string; status?: number; message?: string } {
  if (!error) return {};

  // Handle ApiError from @skillancer/error-handling
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      code: (err.code as string) || undefined,
      status: (err.status as number) || (err.statusCode as number) || undefined,
      message: (err.message as string) || undefined,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: String(error) };
}

/**
 * Handle query/mutation errors globally
 */
function handleGlobalError(error: unknown): void {
  const details = extractErrorDetails(error);

  // Dispatch to global error handler
  dispatchApiError(details);
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          // Don't retry on auth errors
          const details = extractErrorDetails(error);
          if (details.status === 401 || details.status === 403) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        retry: (failureCount, error) => {
          // Don't retry on auth or validation errors
          const details = extractErrorDetails(error);
          if (details.status === 401 || details.status === 403 || details.status === 422) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof globalThis.window === 'undefined') {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
