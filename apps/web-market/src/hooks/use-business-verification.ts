'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  confirmDocumentUpload,
  getBusinessVerificationRequirements,
  getBusinessVerificationStatus,
  getDocumentUploadUrl,
  startBusinessVerification,
  type BusinessDocumentType,
  type BusinessType,
  type BusinessVerificationRequirements,
  type BusinessVerificationStatus,
} from '@/lib/api/freelancers';

// ============================================================================
// Query Keys
// ============================================================================

export const businessVerificationKeys = {
  all: ['business-verification'] as const,
  status: () => [...businessVerificationKeys.all, 'status'] as const,
  requirements: () => [...businessVerificationKeys.all, 'requirements'] as const,
};

// ============================================================================
// Types
// ============================================================================

interface StartVerificationData {
  businessType: BusinessType;
  businessName: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  taxIdType: 'EIN' | 'SSN' | 'VAT' | 'OTHER';
  taxIdNumber: string;
  website?: string;
}

interface UploadDocumentData {
  documentType: BusinessDocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  file: File;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for managing business verification status and operations
 */
export function useBusinessVerification() {
  const queryClient = useQueryClient();

  // Fetch current status
  const {
    data: status,
    isLoading,
    error,
    refetch,
  } = useQuery<BusinessVerificationStatus, Error>({
    queryKey: businessVerificationKeys.status(),
    queryFn: getBusinessVerificationStatus,
  });

  // Fetch requirements
  const { data: requirements, isLoading: isLoadingRequirements } = useQuery<
    BusinessVerificationRequirements,
    Error
  >({
    queryKey: businessVerificationKeys.requirements(),
    queryFn: getBusinessVerificationRequirements,
  });

  // Start verification mutation
  const startMutation = useMutation({
    mutationFn: (data: StartVerificationData) => startBusinessVerification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessVerificationKeys.all });
      toast.success('Business verification started', {
        description: 'Please upload the required documents to continue',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to start verification', {
        description: error.message,
      });
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({
      documentType,
      fileName,
      fileSize,
      mimeType,
      file,
    }: UploadDocumentData) => {
      // Step 1: Get pre-signed upload URL
      const uploadUrlResponse = await getDocumentUploadUrl({
        documentType,
        fileName,
        fileSize,
        mimeType,
      });

      // Step 2: Upload file to S3
      const response = await fetch(uploadUrlResponse.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Confirm upload
      await confirmDocumentUpload(uploadUrlResponse.documentId, {
        uploadCompleted: true,
      });

      return uploadUrlResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessVerificationKeys.all });
      toast.success('Document uploaded', {
        description: 'Your document has been uploaded and is pending review',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to upload document', {
        description: error.message,
      });
    },
  });

  return {
    // Status data
    status,
    requirements,
    isLoading,
    isLoadingRequirements,
    error,
    refetch,

    // Start verification
    startVerification: startMutation.mutateAsync,
    isStarting: startMutation.isPending,

    // Upload document
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
  };
}

/**
 * Hook for checking business verification requirements for a specific type
 */
export function useBusinessVerificationRequirements() {
  return useQuery<BusinessVerificationRequirements, Error>({
    queryKey: businessVerificationKeys.requirements(),
    queryFn: getBusinessVerificationRequirements,
  });
}
