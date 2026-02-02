'use client';

/**
 * useSkillsVerification Hooks
 *
 * TanStack Query hooks for skills verification, assessments, and endorsements.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getSkillsVerificationStatus,
  getAvailableAssessments,
  startSkillAssessment,
  submitSkillAssessment,
  requestEndorsement,
  getSkillVerificationDetails,
  type SkillVerificationStatus,
  type SkillAssessment,
  type SkillAssessmentSession,
  type SkillAssessmentResult,
} from '@/lib/api/freelancers';

// ============================================================================
// Query Keys
// ============================================================================

export const skillsVerificationQueryKeys = {
  all: ['skills-verification'] as const,
  status: () => [...skillsVerificationQueryKeys.all, 'status'] as const,
  assessments: (params?: { skillId?: string; category?: string }) =>
    [...skillsVerificationQueryKeys.all, 'assessments', params] as const,
  skillDetails: (skillId: string) =>
    [...skillsVerificationQueryKeys.all, 'skill', skillId] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseSkillsVerificationOptions {
  enabled?: boolean;
  staleTime?: number;
}

export interface UseSkillsVerificationReturn {
  status: SkillVerificationStatus | undefined;
  assessments: { assessments: SkillAssessment[]; categories: string[] } | undefined;
  isLoading: boolean;
  isLoadingAssessments: boolean;
  error: Error | null;
  startAssessment: (data: {
    skillId: string;
    assessmentType?: 'QUICK' | 'STANDARD' | 'COMPREHENSIVE';
    proctored?: boolean;
  }) => Promise<SkillAssessmentSession>;
  isStarting: boolean;
  submitAssessment: (data: {
    assessmentId: string;
    answers: Array<{
      questionId: string;
      answer: string | number | string[];
      timeSpent: number;
    }>;
  }) => Promise<SkillAssessmentResult>;
  isSubmitting: boolean;
  requestEndorsement: (data: {
    skillId: string;
    endorserEmail: string;
    message?: string;
    relationshipType: 'COLLEAGUE' | 'MANAGER' | 'CLIENT' | 'MENTOR' | 'OTHER';
  }) => Promise<void>;
  isRequesting: boolean;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useSkillsVerification(options: UseSkillsVerificationOptions = {}) {
  const { enabled = true, staleTime = 30_000 } = options;
  const queryClient = useQueryClient();

  // Fetch verification status
  const statusQuery = useQuery<SkillVerificationStatus, Error>({
    queryKey: skillsVerificationQueryKeys.status(),
    queryFn: getSkillsVerificationStatus,
    enabled,
    staleTime,
  });

  // Fetch available assessments
  const assessmentsQuery = useQuery<
    { assessments: SkillAssessment[]; categories: string[] },
    Error
  >({
    queryKey: skillsVerificationQueryKeys.assessments(),
    queryFn: () => getAvailableAssessments(),
    enabled,
    staleTime,
  });

  // Start assessment mutation
  const startMutation = useMutation({
    mutationFn: startSkillAssessment,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: skillsVerificationQueryKeys.status(),
      });
    },
  });

  // Submit assessment mutation
  const submitMutation = useMutation({
    mutationFn: submitSkillAssessment,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: skillsVerificationQueryKeys.all,
      });
    },
  });

  // Request endorsement mutation
  const endorsementMutation = useMutation({
    mutationFn: requestEndorsement,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: skillsVerificationQueryKeys.status(),
      });
    },
  });

  const refetch = useCallback(async () => {
    await Promise.all([statusQuery.refetch(), assessmentsQuery.refetch()]);
  }, [statusQuery, assessmentsQuery]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: skillsVerificationQueryKeys.all,
    });
  }, [queryClient]);

  return {
    status: statusQuery.data,
    assessments: assessmentsQuery.data,
    isLoading: statusQuery.isLoading,
    isLoadingAssessments: assessmentsQuery.isLoading,
    error: statusQuery.error,
    startAssessment: async (data) => {
      return startMutation.mutateAsync(data);
    },
    isStarting: startMutation.isPending,
    submitAssessment: async (data) => {
      return submitMutation.mutateAsync(data);
    },
    isSubmitting: submitMutation.isPending,
    requestEndorsement: async (data) => {
      await endorsementMutation.mutateAsync(data);
    },
    isRequesting: endorsementMutation.isPending,
    refetch,
    invalidate,
  };
}

// ============================================================================
// Skill Details Hook
// ============================================================================

export function useSkillVerificationDetails(skillId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: skillsVerificationQueryKeys.skillDetails(skillId),
    queryFn: () => getSkillVerificationDetails(skillId),
    enabled: enabled && Boolean(skillId),
  });
}
