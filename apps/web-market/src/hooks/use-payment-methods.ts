'use client';

/**
 * usePaymentMethods Hook
 *
 * TanStack Query hooks for payment method management.
 * Handles listing, adding, removing, and setting default payment methods.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getPaymentMethods,
  getPaymentMethod as _getPaymentMethod,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createSetupIntent,
  createCharge,
  confirmPayment,
  getPaymentStatus,
  previewFees,
  type PaymentMethod,
  type PaymentMethodType,
  type SetupIntentResponse,
  type ChargeRequest,
  type ChargeResult,
  type FeePreview,
} from '@/lib/api/payments';

// ============================================================================
// Query Keys
// ============================================================================

export const paymentMethodQueryKeys = {
  all: ['payment-methods'] as const,
  list: (type?: string) => [...paymentMethodQueryKeys.all, 'list', type] as const,
  detail: (id: string) => [...paymentMethodQueryKeys.all, 'detail', id] as const,
  feePreview: (amount: number) => [...paymentMethodQueryKeys.all, 'fee-preview', amount] as const,
};

export const chargeQueryKeys = {
  all: ['charges'] as const,
  status: (id: string) => [...chargeQueryKeys.all, 'status', id] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UsePaymentMethodsOptions {
  type?: 'card' | 'bank_account' | 'all';
  enabled?: boolean;
}

export interface UsePaymentMethodsReturn {
  // Data
  paymentMethods: PaymentMethod[];
  defaultPaymentMethod: PaymentMethod | undefined;
  isLoading: boolean;
  error: Error | null;

  // Add payment method
  addMethod: (paymentMethodId: string, setAsDefault?: boolean) => Promise<PaymentMethod>;
  isAdding: boolean;

  // Set default
  setDefault: (paymentMethodId: string) => Promise<PaymentMethod>;
  isSettingDefault: boolean;

  // Remove
  removeMethod: (paymentMethodId: string) => Promise<void>;
  isRemoving: boolean;

  // Setup intent
  getSetupIntent: (
    type?: PaymentMethodType,
    metadata?: Record<string, string>
  ) => Promise<SetupIntentResponse>;
  isCreatingSetupIntent: boolean;

  // Utilities
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  hasPaymentMethod: boolean;
}

// ============================================================================
// Payment Methods Hook
// ============================================================================

export function usePaymentMethods(options: UsePaymentMethodsOptions = {}): UsePaymentMethodsReturn {
  const { type = 'all', enabled = true } = options;
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Query: List Payment Methods
  // ---------------------------------------------------------------------------

  const {
    data: paymentMethods = [],
    isLoading,
    error,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: paymentMethodQueryKeys.list(type),
    queryFn: () => getPaymentMethods(type),
    enabled,
  });

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.isDefault);
  const hasPaymentMethod = paymentMethods.length > 0;

  // ---------------------------------------------------------------------------
  // Mutation: Add Payment Method
  // ---------------------------------------------------------------------------

  const addMutation = useMutation({
    mutationFn: ({
      paymentMethodId,
      setAsDefault,
    }: {
      paymentMethodId: string;
      setAsDefault?: boolean;
    }) => addPaymentMethod(paymentMethodId, setAsDefault),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });

  const addMethod = useCallback(
    async (paymentMethodId: string, setAsDefault = false): Promise<PaymentMethod> => {
      return addMutation.mutateAsync({ paymentMethodId, setAsDefault });
    },
    [addMutation]
  );

  // ---------------------------------------------------------------------------
  // Mutation: Set Default Payment Method
  // ---------------------------------------------------------------------------

  const setDefaultMutation = useMutation({
    mutationFn: (paymentMethodId: string) => setDefaultPaymentMethod(paymentMethodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });

  const setDefault = useCallback(
    async (paymentMethodId: string): Promise<PaymentMethod> => {
      return setDefaultMutation.mutateAsync(paymentMethodId);
    },
    [setDefaultMutation]
  );

  // ---------------------------------------------------------------------------
  // Mutation: Remove Payment Method
  // ---------------------------------------------------------------------------

  const removeMutation = useMutation({
    mutationFn: (paymentMethodId: string) => removePaymentMethod(paymentMethodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
    },
  });

  const removeMethod = useCallback(
    async (paymentMethodId: string): Promise<void> => {
      return removeMutation.mutateAsync(paymentMethodId);
    },
    [removeMutation]
  );

  // ---------------------------------------------------------------------------
  // Mutation: Create Setup Intent
  // ---------------------------------------------------------------------------

  const setupIntentMutation = useMutation({
    mutationFn: ({
      type,
      metadata,
    }: {
      type?: PaymentMethodType;
      metadata?: Record<string, string>;
    }) => createSetupIntent(type, metadata),
  });

  const getSetupIntent = useCallback(
    async (
      pmType?: PaymentMethodType,
      metadata?: Record<string, string>
    ): Promise<SetupIntentResponse> => {
      return setupIntentMutation.mutateAsync({ type: pmType, metadata });
    },
    [setupIntentMutation]
  );

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  const refetch = useCallback(async () => {
    await refetchQuery();
  }, [refetchQuery]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.all });
  }, [queryClient]);

  return {
    paymentMethods,
    defaultPaymentMethod,
    isLoading,
    error: error,

    addMethod,
    isAdding: addMutation.isPending,

    setDefault,
    isSettingDefault: setDefaultMutation.isPending,

    removeMethod,
    isRemoving: removeMutation.isPending,

    getSetupIntent,
    isCreatingSetupIntent: setupIntentMutation.isPending,

    refetch,
    invalidate,
    hasPaymentMethod,
  };
}

// ============================================================================
// Charges Hook
// ============================================================================

export interface UseChargesReturn {
  // Create charge
  charge: (params: ChargeRequest) => Promise<ChargeResult>;
  isCharging: boolean;

  // Confirm payment
  confirm: (
    paymentIntentId: string,
    paymentMethodId?: string,
    returnUrl?: string
  ) => Promise<ChargeResult>;
  isConfirming: boolean;

  // Get status
  getStatus: (paymentIntentId: string) => Promise<ChargeResult>;

  // Preview fees
  preview: (amount: number, applicationFeePercent?: number) => Promise<FeePreview>;
  isPreviewing: boolean;
}

export function useCharges(): UseChargesReturn {
  // ---------------------------------------------------------------------------
  // Mutation: Create Charge
  // ---------------------------------------------------------------------------

  const chargeMutation = useMutation({
    mutationFn: (params: ChargeRequest) => createCharge(params),
  });

  const charge = useCallback(
    async (params: ChargeRequest): Promise<ChargeResult> => {
      return chargeMutation.mutateAsync(params);
    },
    [chargeMutation]
  );

  // ---------------------------------------------------------------------------
  // Mutation: Confirm Payment
  // ---------------------------------------------------------------------------

  const confirmMutation = useMutation({
    mutationFn: ({
      paymentIntentId,
      paymentMethodId,
      returnUrl,
    }: {
      paymentIntentId: string;
      paymentMethodId?: string;
      returnUrl?: string;
    }) => confirmPayment(paymentIntentId, paymentMethodId, returnUrl),
  });

  const confirm = useCallback(
    async (
      paymentIntentId: string,
      paymentMethodId?: string,
      returnUrl?: string
    ): Promise<ChargeResult> => {
      return confirmMutation.mutateAsync({ paymentIntentId, paymentMethodId, returnUrl });
    },
    [confirmMutation]
  );

  // ---------------------------------------------------------------------------
  // Query: Get Status
  // ---------------------------------------------------------------------------

  const getStatus = useCallback(async (paymentIntentId: string): Promise<ChargeResult> => {
    return getPaymentStatus(paymentIntentId);
  }, []);

  // ---------------------------------------------------------------------------
  // Mutation: Preview Fees
  // ---------------------------------------------------------------------------

  const previewMutation = useMutation({
    mutationFn: ({
      amount,
      applicationFeePercent,
    }: {
      amount: number;
      applicationFeePercent?: number;
    }) => previewFees(amount, applicationFeePercent),
  });

  const preview = useCallback(
    async (amount: number, applicationFeePercent?: number): Promise<FeePreview> => {
      return previewMutation.mutateAsync({ amount, applicationFeePercent });
    },
    [previewMutation]
  );

  return {
    charge,
    isCharging: chargeMutation.isPending,

    confirm,
    isConfirming: confirmMutation.isPending,

    getStatus,

    preview,
    isPreviewing: previewMutation.isPending,
  };
}

// ============================================================================
// Fee Preview Hook (with auto-refresh)
// ============================================================================

export function useFeePreview(amount: number, applicationFeePercent?: number) {
  return useQuery({
    queryKey: paymentMethodQueryKeys.feePreview(amount),
    queryFn: () => previewFees(amount, applicationFeePercent),
    enabled: amount > 0,
    staleTime: 60000, // 1 minute
  });
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  PaymentMethod,
  PaymentMethodType,
  PaymentMethodCard,
  PaymentMethodBankAccount,
  SetupIntentResponse,
  ChargeRequest,
  ChargeResult,
  FeePreview,
} from '@/lib/api/payments';
