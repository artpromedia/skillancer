/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-redundant-type-constituents */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
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
