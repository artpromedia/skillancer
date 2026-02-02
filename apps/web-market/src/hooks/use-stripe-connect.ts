'use client';

/**
 * useStripeConnect Hook
 *
 * TanStack Query hooks for Stripe Connect onboarding and account management.
 * Handles Express account creation, onboarding flows, and status monitoring.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getConnectAccountStatus,
  createConnectAccount,
  createConnectAccountLink,
  getConnectDashboardLink,
  disconnectConnectAccount,
  type ConnectAccountInfo,
  type ConnectAccountStatus,
} from '@/lib/api/freelancers';

// ============================================================================
// Query Keys
// ============================================================================

export const stripeConnectQueryKeys = {
  all: ['stripe-connect'] as const,
  status: () => [...stripeConnectQueryKeys.all, 'status'] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseStripeConnectOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

export interface UseStripeConnectReturn {
  // Account status
  account: ConnectAccountInfo | undefined;
  isLoading: boolean;
  error: Error | null;

  // Computed states
  hasAccount: boolean;
  isOnboarding: boolean;
  isActive: boolean;
  isRestricted: boolean;
  needsAction: boolean;
  actionRequiredItems: string[];

  // Actions
  createAccount: () => Promise<string>;
  isCreating: boolean;

  startOnboarding: (returnPath?: string) => Promise<void>;
  isStartingOnboarding: boolean;

  openDashboard: () => Promise<void>;
  isOpeningDashboard: boolean;

  disconnect: () => Promise<void>;
  isDisconnecting: boolean;

  // Utilities
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useStripeConnect(options: UseStripeConnectOptions = {}): UseStripeConnectReturn {
  const { enabled = true, staleTime = 30000, refetchInterval = false } = options;

  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Query: Account Status
  // ---------------------------------------------------------------------------

  const {
    data: account,
    isLoading,
    error,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: stripeConnectQueryKeys.status(),
    queryFn: getConnectAccountStatus,
    enabled,
    staleTime,
    refetchInterval,
  });

  // ---------------------------------------------------------------------------
  // Computed States
  // ---------------------------------------------------------------------------

  const hasAccount = account?.exists ?? false;
  const status = account?.status;

  const isOnboarding = status === 'ONBOARDING' || status === 'PENDING';
  const isActive = status === 'ACTIVE';
  const isRestricted = status === 'RESTRICTED' || status === 'DISABLED';

  const actionRequiredItems: string[] = [
    ...(account?.requirements?.currentlyDue ?? []),
    ...(account?.requirements?.pastDue ?? []),
  ];
  const needsAction = actionRequiredItems.length > 0 || isOnboarding;

  // ---------------------------------------------------------------------------
  // Mutation: Create Account
  // ---------------------------------------------------------------------------

  const createAccountMutation = useMutation({
    mutationFn: createConnectAccount,
    onSuccess: (data) => {
      // Redirect to onboarding URL
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: stripeConnectQueryKeys.status(),
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Mutation: Start Onboarding (Get Account Link)
  // ---------------------------------------------------------------------------

  const startOnboardingMutation = useMutation({
    mutationFn: async (returnPath?: string) => {
      const linkType = hasAccount && !isOnboarding ? 'account_update' : 'account_onboarding';
      return createConnectAccountLink(
        linkType,
        returnPath ?? '/settings/payments',
        returnPath ?? '/settings/payments'
      );
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  // ---------------------------------------------------------------------------
  // Mutation: Open Dashboard
  // ---------------------------------------------------------------------------

  const openDashboardMutation = useMutation({
    mutationFn: getConnectDashboardLink,
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
  });

  // ---------------------------------------------------------------------------
  // Mutation: Disconnect Account
  // ---------------------------------------------------------------------------

  const disconnectMutation = useMutation({
    mutationFn: disconnectConnectAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: stripeConnectQueryKeys.status(),
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const createAccount = useCallback(async (): Promise<string> => {
    const result = await createAccountMutation.mutateAsync();
    return result.accountId;
  }, [createAccountMutation]);

  const startOnboarding = useCallback(
    async (returnPath?: string): Promise<void> => {
      await startOnboardingMutation.mutateAsync(returnPath);
    },
    [startOnboardingMutation]
  );

  const openDashboard = useCallback(async (): Promise<void> => {
    await openDashboardMutation.mutateAsync();
  }, [openDashboardMutation]);

  const disconnect = useCallback(async (): Promise<void> => {
    await disconnectMutation.mutateAsync();
  }, [disconnectMutation]);

  const refetch = useCallback(async (): Promise<void> => {
    await refetchQuery();
  }, [refetchQuery]);

  const invalidate = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: stripeConnectQueryKeys.status(),
    });
  }, [queryClient]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Account status
    account,
    isLoading,
    error: (error as unknown as Error | null) ?? null,

    // Computed states
    hasAccount,
    isOnboarding,
    isActive,
    isRestricted,
    needsAction,
    actionRequiredItems,

    // Actions
    createAccount,
    isCreating: createAccountMutation.isPending,

    startOnboarding,
    isStartingOnboarding: startOnboardingMutation.isPending,

    openDashboard,
    isOpeningDashboard: openDashboardMutation.isPending,

    disconnect,
    isDisconnecting: disconnectMutation.isPending,

    // Utilities
    refetch,
    invalidate,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: ConnectAccountStatus | undefined): string {
  switch (status) {
    case 'PENDING':
      return 'Pending Setup';
    case 'ONBOARDING':
      return 'Onboarding In Progress';
    case 'ACTIVE':
      return 'Active';
    case 'RESTRICTED':
      return 'Restricted';
    case 'DISABLED':
      return 'Disabled';
    default:
      return 'Not Connected';
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: ConnectAccountStatus | undefined): string {
  switch (status) {
    case 'ACTIVE':
      return 'text-green-600 bg-green-50';
    case 'ONBOARDING':
    case 'PENDING':
      return 'text-yellow-600 bg-yellow-50';
    case 'RESTRICTED':
      return 'text-orange-600 bg-orange-50';
    case 'DISABLED':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get requirement display name
 */
export function getRequirementDisplayName(requirement: string): string {
  const displayNames: Record<string, string> = {
    'individual.first_name': 'First Name',
    'individual.last_name': 'Last Name',
    'individual.email': 'Email',
    'individual.phone': 'Phone Number',
    'individual.dob.day': 'Date of Birth',
    'individual.dob.month': 'Date of Birth',
    'individual.dob.year': 'Date of Birth',
    'individual.address.line1': 'Address',
    'individual.address.city': 'City',
    'individual.address.state': 'State',
    'individual.address.postal_code': 'Postal Code',
    'individual.address.country': 'Country',
    'individual.ssn_last_4': 'SSN (Last 4)',
    'individual.id_number': 'ID Number',
    'individual.verification.document': 'Identity Document',
    'individual.verification.additional_document': 'Additional Document',
    external_account: 'Bank Account',
    'tos_acceptance.date': 'Terms of Service',
    'tos_acceptance.ip': 'Terms of Service',
    business_type: 'Business Type',
    business_profile: 'Business Profile',
    'business_profile.url': 'Business Website',
    'business_profile.mcc': 'Business Category',
  };

  return (
    displayNames[requirement] ??
    requirement.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
