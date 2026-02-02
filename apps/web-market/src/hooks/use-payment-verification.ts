'use client';

/**
 * usePaymentVerification Hooks
 *
 * TanStack Query hooks for payment verification.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getPaymentVerificationStatus,
  createPaymentSetupIntent,
  confirmPaymentVerification,
  getVerifiedPaymentMethods,
  removePaymentMethod,
  type PaymentVerificationStatus,
  type PaymentSetupIntent,
  type PaymentMethod,
} from '@/lib/api/freelancers';

// ============================================================================
// Query Keys
// ============================================================================

export const paymentVerificationQueryKeys = {
  all: ['payment-verification'] as const,
  status: () => [...paymentVerificationQueryKeys.all, 'status'] as const,
  methods: () => [...paymentVerificationQueryKeys.all, 'methods'] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UsePaymentVerificationOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UsePaymentVerificationReturn {
  status: PaymentVerificationStatus | undefined;
  methods: { paymentMethods: PaymentMethod[] } | undefined;
  isLoading: boolean;
  isLoadingMethods: boolean;
  error: Error | null;
  createSetupIntent: (type: 'card' | 'bank_account') => Promise<PaymentSetupIntent>;
  isCreating: boolean;
  confirmVerification: (data: { setupIntentId: string; paymentMethodId: string }) => Promise<void>;
  isConfirming: boolean;
  removeMethod: (methodId: string) => Promise<void>;
  isRemoving: boolean;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePaymentVerification(
  options: UsePaymentVerificationOptions = {}
): UsePaymentVerificationReturn {
  const { enabled = true, staleTime = 30_000 } = options;
  const queryClient = useQueryClient();

  // Fetch verification status
  const statusQuery = useQuery({
    queryKey: paymentVerificationQueryKeys.status(),
    queryFn: getPaymentVerificationStatus,
    enabled,
    staleTime,
  });

  // Fetch payment methods
  const methodsQuery = useQuery({
    queryKey: paymentVerificationQueryKeys.methods(),
    queryFn: getVerifiedPaymentMethods,
    enabled,
    staleTime,
  });

  // Create setup intent mutation
  const setupIntentMutation = useMutation({
    mutationFn: createPaymentSetupIntent,
  });

  // Confirm verification mutation
  const confirmMutation = useMutation({
    mutationFn: confirmPaymentVerification,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: paymentVerificationQueryKeys.all,
      });
    },
  });

  // Remove payment method mutation
  const removeMutation = useMutation({
    mutationFn: removePaymentMethod,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: paymentVerificationQueryKeys.all,
      });
    },
  });

  const refetch = useCallback(async () => {
    await Promise.all([statusQuery.refetch(), methodsQuery.refetch()]);
  }, [statusQuery, methodsQuery]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: paymentVerificationQueryKeys.all,
    });
  }, [queryClient]);

  return {
    status: statusQuery.data,
    methods: methodsQuery.data,
    isLoading: statusQuery.isLoading,
    isLoadingMethods: methodsQuery.isLoading,
    error: statusQuery.error,
    createSetupIntent: async (type) => {
      return setupIntentMutation.mutateAsync(type);
    },
    isCreating: setupIntentMutation.isPending,
    confirmVerification: async (data) => {
      await confirmMutation.mutateAsync(data);
    },
    isConfirming: confirmMutation.isPending,
    removeMethod: async (methodId) => {
      await removeMutation.mutateAsync(methodId);
    },
    isRemoving: removeMutation.isPending,
    refetch,
    invalidate,
  };
}
