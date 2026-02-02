/**
 * Users API Hooks
 *
 * React Query hooks for user/profile-related operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  usersService,
  type UserProfile,
  type FreelancerProfile,
  type ClientProfile,
  type UpdateProfileInput,
  type UpdateFreelancerProfileInput,
  type UpdateClientProfileInput,
  type FreelancerSearchParams,
  type UserReview,
  type UserSkill,
  type PortfolioItem,
  type WorkExperience,
  type Education,
  type Certification,
} from '@/lib/api/services';

// =============================================================================
// Query Keys
// =============================================================================

export const userKeys = {
  all: ['users'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  profile: (id: string) => [...userKeys.all, 'profile', id] as const,
  freelancer: (id: string) => [...userKeys.all, 'freelancer', id] as const,
  client: (id: string) => [...userKeys.all, 'client', id] as const,
  freelancers: (params: FreelancerSearchParams) =>
    [...userKeys.all, 'freelancers', params] as const,
  reviews: (userId: string) => [...userKeys.all, 'reviews', userId] as const,
  skills: (userId: string) => [...userKeys.all, 'skills', userId] as const,
  portfolio: (userId: string) => [...userKeys.all, 'portfolio', userId] as const,
  experience: (userId: string) => [...userKeys.all, 'experience', userId] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Get current user's profile
 */
export function useCurrentUser(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => usersService.getCurrentUser(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get freelancer profile by ID
 */
export function useFreelancerProfile(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.freelancer(userId ?? ''),
    queryFn: () => usersService.getFreelancer(userId),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get my freelancer profile
 */
export function useMyFreelancerProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...userKeys.me(), 'freelancer'],
    queryFn: () => usersService.getMyFreelancerProfile(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get my client profile
 */
export function useMyClientProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...userKeys.me(), 'client'],
    queryFn: () => usersService.getMyClientProfile(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Search freelancers
 */
export function useFreelancerSearch(
  params: FreelancerSearchParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userKeys.freelancers(params),
    queryFn: () => usersService.searchFreelancers(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get user reviews
 */
export function useUserReviews(userId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.reviews(userId ?? ''),
    queryFn: () => usersService.getReviews(userId),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Update current user's profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) => usersService.updateProfile(data),
    onSuccess: (result) => {
      // Update current user in cache
      queryClient.setQueryData(userKeys.me(), result);

      // Also update the profile cache if we have the user ID
      if (result.data?.id) {
        queryClient.setQueryData(userKeys.profile(result.data.id), result);
      }
    },
  });
}

/**
 * Update freelancer profile
 */
export function useUpdateFreelancerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateFreelancerProfileInput) => usersService.updateFreelancerProfile(data),
    onSuccess: (result) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.me() });

      if (result.data?.id) {
        queryClient.setQueryData(userKeys.freelancer(result.data.id), result);
      }
    },
  });
}

/**
 * Update client profile
 */
export function useUpdateClientProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateClientProfileInput) => usersService.updateClientProfile(data),
    onSuccess: (result) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userKeys.me() });

      if (result.data?.id) {
        queryClient.setQueryData(userKeys.client(result.data.id), result);
      }
    },
  });
}

/**
 * Update avatar
 */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => usersService.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Delete avatar
 */
export function useDeleteAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => usersService.deleteAvatar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Skill Mutation Hooks
// =============================================================================

/**
 * Add a skill
 */
export function useAddSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      skillId: string;
      proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
      yearsOfExperience: number;
      isPrimary?: boolean;
    }) => usersService.addSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Update a skill
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      skillId,
      data,
    }: {
      skillId: string;
      data: Partial<{
        proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
        yearsOfExperience: number;
        isPrimary: boolean;
      }>;
    }) => usersService.updateSkill(skillId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Remove a skill
 */
export function useRemoveSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (skillId: string) => usersService.removeSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Portfolio Mutation Hooks
// =============================================================================

/**
 * Add a portfolio item
 */
export function useAddPortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<PortfolioItem, 'id' | 'viewCount' | 'createdAt'>) =>
      usersService.addPortfolioItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Update a portfolio item
 */
export function useUpdatePortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      data,
    }: {
      itemId: string;
      data: Partial<Omit<PortfolioItem, 'id' | 'viewCount' | 'createdAt'>>;
    }) => usersService.updatePortfolioItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Delete a portfolio item
 */
export function useDeletePortfolioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => usersService.deletePortfolioItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Reorder portfolio items
 */
export function useReorderPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => usersService.reorderPortfolio(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Experience Mutation Hooks
// =============================================================================

/**
 * Add work experience
 */
export function useAddWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<WorkExperience, 'id'>) => usersService.addWorkExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Update work experience
 */
export function useUpdateWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ expId, data }: { expId: string; data: Partial<Omit<WorkExperience, 'id'>> }) =>
      usersService.updateWorkExperience(expId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Delete work experience
 */
export function useDeleteWorkExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (expId: string) => usersService.deleteWorkExperience(expId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Education Mutation Hooks
// =============================================================================

/**
 * Add education
 */
export function useAddEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Education, 'id'>) => usersService.addEducation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Update education
 */
export function useUpdateEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eduId, data }: { eduId: string; data: Partial<Omit<Education, 'id'>> }) =>
      usersService.updateEducation(eduId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Delete education
 */
export function useDeleteEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eduId: string) => usersService.deleteEducation(eduId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Certification Mutation Hooks
// =============================================================================

/**
 * Add certification
 */
export function useAddCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Certification, 'id' | 'isVerified'>) =>
      usersService.addCertification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Update certification
 */
export function useUpdateCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      certId,
      data,
    }: {
      certId: string;
      data: Partial<Omit<Certification, 'id' | 'isVerified'>>;
    }) => usersService.updateCertification(certId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

/**
 * Delete certification
 */
export function useDeleteCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (certId: string) => usersService.deleteCertification(certId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}

// =============================================================================
// Helper Types
// =============================================================================

export type {
  UserProfile,
  FreelancerProfile,
  ClientProfile,
  UpdateProfileInput,
  UpdateFreelancerProfileInput,
  UpdateClientProfileInput,
  FreelancerSearchParams,
  UserReview,
  UserSkill,
  PortfolioItem,
  WorkExperience,
  Education,
  Certification,
};
