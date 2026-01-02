'use client';

/**
 * Shared Data Hooks
 * Hooks for sharing data between widgets to prevent duplicate fetches
 */

import { useCallback, useEffect, useState } from 'react';

import { useWorkspaceDataStore } from '../lib/data/workspace-data-store';

interface UseSharedDataOptions {
  ttl?: number;
  staleWhileRevalidate?: boolean;
}

/**
 * Generic hook for cached widget data
 */
export function useCachedWidgetData<T>(
  integrationId: string,
  widgetId: string,
  fetcher: () => Promise<T>,
  options: UseSharedDataOptions = {}
) {
  const { ttl = 5 * 60 * 1000, staleWhileRevalidate = true } = options;
  const { getWidgetData, setWidgetData, setLoading, loading } = useWorkspaceDataStore();

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = `${integrationId}:${widgetId}`;
  const isLoading = loading[cacheKey] || false;

  const fetchData = useCallback(
    async (force = false) => {
      const cached = getWidgetData(integrationId, widgetId);

      if (cached && !force) {
        setData(cached.data as T);
        if (!cached.isStale) return;
        if (!staleWhileRevalidate) return;
      }

      setLoading(cacheKey, true);
      setError(null);

      try {
        const result = await fetcher();
        setWidgetData(integrationId, widgetId, result, ttl);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(cacheKey, false);
      }
    },
    [
      integrationId,
      widgetId,
      fetcher,
      ttl,
      staleWhileRevalidate,
      cacheKey,
      getWidgetData,
      setWidgetData,
      setLoading,
    ]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch: () => fetchData(true) };
}

/**
 * GitHub repos shared across widgets
 */
export function useGitHubRepos(integrationId: string) {
  return useCachedWidgetData(
    integrationId,
    'github-repos',
    async () => {
      const res = await fetch(`/api/integrations/${integrationId}/github/repos`);
      if (!res.ok) throw new Error('Failed to fetch repos');
      return res.json();
    },
    { ttl: 10 * 60 * 1000 }
  );
}

/**
 * QuickBooks accounts shared across CFO widgets
 */
export function useQuickBooksAccounts(integrationId: string) {
  return useCachedWidgetData(
    integrationId,
    'quickbooks-accounts',
    async () => {
      const res = await fetch(`/api/integrations/${integrationId}/quickbooks/accounts`);
      if (!res.ok) throw new Error('Failed to fetch accounts');
      return res.json();
    },
    { ttl: 15 * 60 * 1000 }
  );
}

/**
 * Stripe subscriptions for CFO widgets
 */
export function useStripeSubscriptions(integrationId: string) {
  return useCachedWidgetData(
    integrationId,
    'stripe-subscriptions',
    async () => {
      const res = await fetch(`/api/integrations/${integrationId}/stripe/subscriptions`);
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      return res.json();
    },
    { ttl: 10 * 60 * 1000 }
  );
}

/**
 * AWS cost data for CTO widgets
 */
export function useAWSCosts(integrationId: string, period: string = 'monthly') {
  return useCachedWidgetData(
    integrationId,
    `aws-costs-${period}`,
    async () => {
      const res = await fetch(`/api/integrations/${integrationId}/aws/costs?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch costs');
      return res.json();
    },
    { ttl: 60 * 60 * 1000 }
  );
}

export default useCachedWidgetData;
