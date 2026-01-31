'use client';

/**
 * useVerification Hooks
 *
 * TanStack Query hooks for identity, email, and phone verification.
 * Provides loading, error, and mutation capabilities.
 * Uses cookie-based authentication.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getVerificationStatus,
  sendEmailVerificationCode,
  sendPhoneVerificationCode,
  startVerification,
  verifyEmailCode,
  verifyPhoneCode,
  type VerificationStatus,
} from '@/lib/api/freelancers';

// ============================================================================
// Query Keys
// ============================================================================

export const verificationQueryKeys = {
  all: ['verification'] as const,
  status: () => [...verificationQueryKeys.all, 'status'] as const,
};

// ============================================================================
// Types
// ============================================================================

export type VerificationType = 'email' | 'phone';
export type VerificationTier = 'BASIC' | 'ENHANCED' | 'PREMIUM';

export interface UseVerificationStatusOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Refetch interval for pending verifications */
  refetchInterval?: number | false;
}

export interface UseVerificationStatusReturn {
  /** Verification status data */
  status: VerificationStatus | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Fetching state (including background refetches) */
  isFetching: boolean;
  /** Error object if request failed */
  error: Error | null;
  /** Whether the query has successfully fetched at least once */
  isSuccess: boolean;
  /** Refetch the verification status */
  refetch: () => Promise<void>;
  /** Invalidate and refetch */
  invalidate: () => Promise<void>;
}

export interface UseSendVerificationCodeReturn {
  /** Send verification code mutation */
  sendCode: (data: { type: VerificationType; destination?: string }) => void;
  /** Whether the mutation is pending */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Code expiration timestamp */
  expiresAt: string | undefined;
  /** Reset mutation state */
  reset: () => void;
}

export interface UseVerifyCodeReturn {
  /** Verify code mutation */
  verifyCode: (data: { type: VerificationType; code: string }) => void;
  /** Whether the mutation is pending */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Reset mutation state */
  reset: () => void;
}

export interface UseStartIdentityVerificationReturn {
  /** Start identity verification mutation */
  startVerification: (tier: VerificationTier) => void;
  /** Whether the mutation is pending */
  isPending: boolean;
  /** Whether the mutation was successful */
  isSuccess: boolean;
  /** Error object if mutation failed */
  error: Error | null;
  /** Inquiry data returned from Persona */
  inquiryData:
    | {
        inquiryId: string;
        sessionToken: string;
        templateId: string;
      }
    | undefined;
  /** Reset mutation state */
  reset: () => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch current verification status
 *
 * @param options - Configuration options
 * @returns Verification status with loading and error states
 *
 * @example
 * ```tsx
 * const { status, isLoading } = useVerificationStatus({
 *   refetchInterval: status?.pendingVerification ? 5000 : false,
 * });
 * ```
 */
export function useVerificationStatus(
  options: UseVerificationStatusOptions = {}
): UseVerificationStatusReturn {
  const { enabled = true, staleTime = 30_000, refetchInterval = false } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: verificationQueryKeys.status(),
    queryFn: getVerificationStatus,
    enabled,
    staleTime,
    refetchInterval,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: verificationQueryKeys.status(),
    });
  }, [queryClient]);

  return {
    status: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isSuccess: query.isSuccess,
    refetch,
    invalidate,
  };
}

/**
 * Hook to send verification code (email or phone)
 *
 * @returns Mutation for sending verification codes
 *
 * @example
 * ```tsx
 * const { sendCode, isPending } = useSendVerificationCode();
 *
 * // Send email verification
 * sendCode({ type: 'email' });
 *
 * // Send phone verification
 * sendCode({ type: 'phone', destination: '+1234567890' });
 * ```
 */
export function useSendVerificationCode(): UseSendVerificationCodeReturn {
  const mutation = useMutation({
    mutationFn: async ({
      type,
      destination,
    }: {
      type: VerificationType;
      destination?: string;
    }): Promise<{ success: boolean; expiresAt: string }> => {
      if (type === 'email') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await sendEmailVerificationCode(destination);
      } else {
        if (!destination) throw new Error('Phone number is required');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await sendPhoneVerificationCode(destination);
      }
    },
  });

  return {
    sendCode: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    expiresAt: mutation.data?.expiresAt,
    reset: mutation.reset,
  };
}

/**
 * Hook to verify code (email or phone)
 *
 * @returns Mutation for verifying codes
 *
 * @example
 * ```tsx
 * const { verifyCode, isPending, isSuccess } = useVerifyCode();
 *
 * // Verify email code
 * verifyCode({ type: 'email', code: '123456' });
 *
 * // Verify phone code
 * verifyCode({ type: 'phone', code: '123456' });
 * ```
 */
export function useVerifyCode(): UseVerifyCodeReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      type,
      code,
    }: {
      type: VerificationType;
      code: string;
    }): Promise<{ success: boolean; verifiedAt: string }> => {
      if (type === 'email') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await verifyEmailCode(code);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await verifyPhoneCode(code);
      }
    },
    onSuccess: () => {
      // Invalidate verification status to refresh
      void queryClient.invalidateQueries({
        queryKey: verificationQueryKeys.status(),
      });
    },
  });

  return {
    verifyCode: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook to start identity verification flow (Persona)
 *
 * @returns Mutation for starting identity verification
 *
 * @example
 * ```tsx
 * const { startVerification, inquiryData, isPending } = useStartIdentityVerification();
 *
 * // Start basic verification
 * startVerification('BASIC');
 *
 * // Use inquiryData to initialize Persona SDK
 * if (inquiryData) {
 *   initPersona(inquiryData.inquiryId, inquiryData.sessionToken);
 * }
 * ```
 */
export function useStartIdentityVerification(): UseStartIdentityVerificationReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (tier: VerificationTier) => {
      return startVerification(tier);
    },
    onSuccess: () => {
      // Invalidate verification status to show pending
      void queryClient.invalidateQueries({
        queryKey: verificationQueryKeys.status(),
      });
    },
  });

  return {
    startVerification: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    inquiryData: mutation.data,
    reset: mutation.reset,
  };
}
