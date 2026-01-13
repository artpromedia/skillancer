/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, react-hooks/exhaustive-deps, no-console */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

import {
  type ContractType,
  type ProposalDraft,
  type ProposalSubmission,
  type QualityScore,
  getProposalDraft,
  previewQualityScore,
  saveProposalDraft,
  submitProposal,
} from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

export interface ProposalFormStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  fields: string[];
}

export interface ProposalFormData {
  coverLetter: string;
  contractType: ContractType;
  bidAmount: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays: number;
  milestones: MilestoneData[];
  attachmentIds: string[];
  portfolioItemIds: string[];
  templateId?: string;
  acceptedTerms: boolean;
}

export interface MilestoneData {
  id: string;
  title: string;
  description: string;
  amount: number;
  durationDays: number;
}

export interface ProposalFormErrors {
  [key: string]: string | undefined;
}

export interface UseProposalFormOptions {
  jobId: string;
  initialContractType?: ContractType;
  minBudget?: number;
  maxBudget?: number;
  suggestedBidAmount?: number;
  onSubmitSuccess?: (proposalId: string) => void;
  onSubmitError?: (error: Error) => void;
}

export interface UseProposalFormReturn {
  // Form state
  formData: ProposalFormData;
  errors: ProposalFormErrors;
  currentStep: number;
  steps: ProposalFormStep[];
  isSubmitting: boolean;
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: Date | null;

  // Quality score
  qualityScore: QualityScore | null;
  isLoadingQualityScore: boolean;

  // Actions
  setField: <K extends keyof ProposalFormData>(field: K, value: ProposalFormData[K]) => void;
  setFields: (fields: Partial<ProposalFormData>) => void;
  validateStep: (step: number) => boolean;
  nextStep: () => boolean;
  prevStep: () => void;
  goToStep: (step: number) => void;
  addMilestone: (milestone: Omit<MilestoneData, 'id'>) => void;
  updateMilestone: (id: string, data: Partial<MilestoneData>) => void;
  removeMilestone: (id: string) => void;
  reorderMilestones: (startIndex: number, endIndex: number) => void;
  addAttachment: (attachmentId: string) => void;
  removeAttachment: (attachmentId: string) => void;
  addPortfolioItem: (itemId: string) => void;
  removePortfolioItem: (itemId: string) => void;
  loadTemplate: (templateId: string, coverLetter: string) => void;
  saveDraft: () => Promise<void>;
  submit: () => Promise<string | null>;
  reset: () => void;

  // Computed
  totalMilestoneAmount: number;
  milestoneAmountDiff: number;
  estimatedEarnings: number;
  canSubmit: boolean;
  completionPercentage: number;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const coverLetterSchema = z.object({
  coverLetter: z
    .string()
    .min(200, 'Cover letter must be at least 200 characters')
    .max(5000, 'Cover letter must not exceed 5000 characters'),
});

const pricingSchema = z.object({
  contractType: z.enum(['FIXED', 'HOURLY']),
  bidAmount: z.number().positive('Bid amount must be positive'),
  hourlyRate: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  deliveryDays: z.number().int().positive('Delivery time must be at least 1 day'),
});

const milestoneSchema = z.object({
  title: z.string().min(1, 'Milestone title is required'),
  description: z.string().min(1, 'Milestone description is required'),
  amount: z.number().positive('Amount must be positive'),
  durationDays: z.number().int().positive('Duration must be at least 1 day'),
});

const termsSchema = z.object({
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
});

// ============================================================================
// Constants
// ============================================================================

const STEP_DEFINITIONS: Omit<ProposalFormStep, 'isComplete' | 'isActive'>[] = [
  {
    id: 'cover-letter',
    title: 'Cover Letter',
    description: 'Write a compelling proposal',
    fields: ['coverLetter'],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    description: 'Set your rate and timeline',
    fields: ['contractType', 'bidAmount', 'hourlyRate', 'estimatedHours', 'deliveryDays'],
  },
  {
    id: 'milestones',
    title: 'Milestones',
    description: 'Break down the project',
    fields: ['milestones'],
  },
  {
    id: 'attachments',
    title: 'Attachments',
    description: 'Add supporting files',
    fields: ['attachmentIds', 'portfolioItemIds'],
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review and submit',
    fields: ['acceptedTerms'],
  },
];

const INITIAL_FORM_DATA: ProposalFormData = {
  coverLetter: '',
  contractType: 'FIXED',
  bidAmount: 0,
  hourlyRate: undefined,
  estimatedHours: undefined,
  deliveryDays: 7,
  milestones: [],
  attachmentIds: [],
  portfolioItemIds: [],
  templateId: undefined,
  acceptedTerms: false,
};

const AUTO_SAVE_DELAY = 30000; // 30 seconds
const QUALITY_SCORE_DEBOUNCE = 2000; // 2 seconds

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProposalForm(options: UseProposalFormOptions): UseProposalFormReturn {
  const { jobId, initialContractType, minBudget, maxBudget, onSubmitSuccess, onSubmitError } =
    options;

  // State
  const [formData, setFormData] = useState<ProposalFormData>({
    ...INITIAL_FORM_DATA,
    contractType: initialContractType ?? 'FIXED',
  });
  const [errors, setErrors] = useState<ProposalFormErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [isLoadingQualityScore, setIsLoadingQualityScore] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Refs
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualityScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyticsRef = useRef<{ stepEntryTime: Record<number, number> }>({
    stepEntryTime: { 0: Date.now() },
  });

  // ============================================================================
  // Load Draft on Mount
  // ============================================================================

  useEffect(() => {
    async function loadDraft() {
      try {
        const draft = await getProposalDraft(jobId);
        if (draft) {
          setFormData({
            coverLetter: draft.coverLetter ?? '',
            contractType: draft.contractType ?? initialContractType ?? 'FIXED',
            bidAmount: draft.bidAmount ?? 0,
            hourlyRate: draft.hourlyRate,
            estimatedHours: draft.estimatedHours,
            deliveryDays: draft.deliveryDays ?? 7,
            milestones: (draft.milestones ?? []).map((m, i) => ({
              id: `milestone-${i}`,
              ...m,
            })),
            attachmentIds: draft.attachmentIds ?? [],
            portfolioItemIds: draft.portfolioItemIds ?? [],
            templateId: undefined,
            acceptedTerms: false,
          });
          setCurrentStep(draft.currentStep);
          setLastSavedAt(new Date(draft.lastSavedAt));
        }
      } catch {
        // No draft found, continue with fresh form
      } finally {
        setDraftLoaded(true);
      }
    }

    void loadDraft();
  }, [jobId, initialContractType]);

  // ============================================================================
  // Auto-Save
  // ============================================================================

  useEffect(() => {
    if (!draftLoaded || !isDirty) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void saveDraft();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, isDirty, draftLoaded]);

  // ============================================================================
  // Quality Score Preview
  // ============================================================================

  useEffect(() => {
    if (!draftLoaded || currentStep < 4) return; // Only on review step

    if (qualityScoreTimerRef.current) {
      clearTimeout(qualityScoreTimerRef.current);
    }

    qualityScoreTimerRef.current = setTimeout(() => {
      void fetchQualityScore();
    }, QUALITY_SCORE_DEBOUNCE);

    return () => {
      if (qualityScoreTimerRef.current) {
        clearTimeout(qualityScoreTimerRef.current);
      }
    };
  }, [formData, currentStep, draftLoaded]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalMilestoneAmount = useMemo(
    () => formData.milestones.reduce((sum, m) => sum + m.amount, 0),
    [formData.milestones]
  );

  const milestoneAmountDiff = useMemo(
    () => formData.bidAmount - totalMilestoneAmount,
    [formData.bidAmount, totalMilestoneAmount]
  );

  const estimatedEarnings = useMemo(() => {
    const amount =
      formData.contractType === 'HOURLY'
        ? (formData.hourlyRate ?? 0) * (formData.estimatedHours ?? 0)
        : formData.bidAmount;

    // Simple fee calculation (10% for now)
    return Math.round(amount * 0.9 * 100) / 100;
  }, [formData.contractType, formData.bidAmount, formData.hourlyRate, formData.estimatedHours]);

  const steps: ProposalFormStep[] = useMemo(() => {
    return STEP_DEFINITIONS.map((step, index) => ({
      ...step,
      isActive: index === currentStep,
      isComplete: isStepComplete(index),
    }));
  }, [currentStep, formData]);

  const completionPercentage = useMemo(() => {
    const completedSteps = steps.filter((s) => s.isComplete).length;
    return Math.round((completedSteps / steps.length) * 100);
  }, [steps]);

  const canSubmit = useMemo(() => {
    return (
      formData.acceptedTerms &&
      formData.coverLetter.length >= 200 &&
      formData.bidAmount > 0 &&
      formData.deliveryDays > 0 &&
      (formData.milestones.length === 0 || milestoneAmountDiff === 0)
    );
  }, [formData, milestoneAmountDiff]);

  // ============================================================================
  // Validation
  // ============================================================================

  function isStepComplete(step: number): boolean {
    switch (step) {
      case 0: // Cover Letter
        return formData.coverLetter.length >= 200;
      case 1: // Pricing
        return formData.bidAmount > 0 && formData.deliveryDays > 0;
      case 2: // Milestones (optional)
        return true;
      case 3: // Attachments (optional)
        return true;
      case 4: // Review
        return formData.acceptedTerms;
      default:
        return false;
    }
  }

  function validateStep(step: number): boolean {
    const newErrors: ProposalFormErrors = {};

    switch (step) {
      case 0: {
        const result = coverLetterSchema.safeParse(formData);
        if (!result.success) {
          result.error.errors.forEach((e) => {
            newErrors[e.path[0] as string] = e.message;
          });
        }
        break;
      }
      case 1: {
        const result = pricingSchema.safeParse(formData);
        if (!result.success) {
          result.error.errors.forEach((e) => {
            newErrors[e.path[0] as string] = e.message;
          });
        }

        // Additional budget validation
        if (minBudget && formData.bidAmount < minBudget) {
          newErrors.bidAmount = `Bid must be at least $${minBudget}`;
        }
        if (maxBudget && formData.bidAmount > maxBudget) {
          newErrors.bidAmount = `Bid must not exceed $${maxBudget}`;
        }

        // Hourly validation
        if (formData.contractType === 'HOURLY') {
          if (!formData.hourlyRate || formData.hourlyRate <= 0) {
            newErrors.hourlyRate = 'Hourly rate is required';
          }
          if (!formData.estimatedHours || formData.estimatedHours <= 0) {
            newErrors.estimatedHours = 'Estimated hours is required';
          }
        }
        break;
      }
      case 2: {
        // Validate milestones if any exist
        if (formData.milestones.length > 0) {
          formData.milestones.forEach((m, index) => {
            const result = milestoneSchema.safeParse(m);
            if (!result.success) {
              result.error.errors.forEach((e) => {
                newErrors[`milestones.${index}.${e.path[0]}`] = e.message;
              });
            }
          });

          // Validate total matches bid amount
          if (milestoneAmountDiff !== 0) {
            newErrors.milestones = `Milestone total must equal bid amount (${milestoneAmountDiff > 0 ? `$${milestoneAmountDiff} remaining` : `$${Math.abs(milestoneAmountDiff)} over`})`;
          }
        }
        break;
      }
      case 4: {
        const result = termsSchema.safeParse(formData);
        if (!result.success) {
          result.error.errors.forEach((e) => {
            newErrors[e.path[0] as string] = e.message;
          });
        }
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  const setField = useCallback(
    <K extends keyof ProposalFormData>(field: K, value: ProposalFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      // Clear error for this field
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const setFields = useCallback((fields: Partial<ProposalFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    setIsDirty(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!validateStep(currentStep)) return false;

    // Track time spent on step
    const entryTime = analyticsRef.current.stepEntryTime[currentStep];
    if (entryTime) {
      const timeSpent = Date.now() - entryTime;
      // Could send analytics here
      console.debug(`Step ${currentStep} completed in ${timeSpent}ms`);
    }

    if (currentStep < STEP_DEFINITIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      analyticsRef.current.stepEntryTime[currentStep + 1] = Date.now();
      return true;
    }
    return false;
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      // Only allow going to completed steps or the next step
      if (step <= currentStep || step === currentStep + 1) {
        if (step > currentStep && !validateStep(currentStep)) return;
        setCurrentStep(step);
      }
    },
    [currentStep]
  );

  const addMilestone = useCallback((milestone: Omit<MilestoneData, 'id'>) => {
    const newMilestone: MilestoneData = {
      ...milestone,
      id: `milestone-${Date.now()}`,
    };
    setFormData((prev) => ({
      ...prev,
      milestones: [...prev.milestones, newMilestone],
    }));
    setIsDirty(true);
  }, []);

  const updateMilestone = useCallback((id: string, data: Partial<MilestoneData>) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
    setIsDirty(true);
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
    setIsDirty(true);
  }, []);

  const reorderMilestones = useCallback((startIndex: number, endIndex: number) => {
    setFormData((prev) => {
      const milestones = [...prev.milestones];
      const [removed] = milestones.splice(startIndex, 1);
      milestones.splice(endIndex, 0, removed);
      return { ...prev, milestones };
    });
    setIsDirty(true);
  }, []);

  const addAttachment = useCallback((attachmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      attachmentIds: [...prev.attachmentIds, attachmentId],
    }));
    setIsDirty(true);
  }, []);

  const removeAttachment = useCallback((attachmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      attachmentIds: prev.attachmentIds.filter((id) => id !== attachmentId),
    }));
    setIsDirty(true);
  }, []);

  const addPortfolioItem = useCallback((itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      portfolioItemIds: [...prev.portfolioItemIds, itemId],
    }));
    setIsDirty(true);
  }, []);

  const removePortfolioItem = useCallback((itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      portfolioItemIds: prev.portfolioItemIds.filter((id) => id !== itemId),
    }));
    setIsDirty(true);
  }, []);

  const loadTemplate = useCallback((templateId: string, coverLetter: string) => {
    setFormData((prev) => ({
      ...prev,
      templateId,
      coverLetter,
    }));
    setIsDirty(true);
  }, []);

  const saveDraft = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const draftData: Partial<ProposalDraft> = {
        coverLetter: formData.coverLetter,
        contractType: formData.contractType,
        bidAmount: formData.bidAmount,
        hourlyRate: formData.hourlyRate,
        estimatedHours: formData.estimatedHours,
        deliveryDays: formData.deliveryDays,
        milestones: formData.milestones.map(({ id: _id, ...m }, index) => ({ ...m, order: index })),
        attachmentIds: formData.attachmentIds,
        portfolioItemIds: formData.portfolioItemIds,
        currentStep,
      };

      await saveProposalDraft(jobId, draftData);
      setLastSavedAt(new Date());
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formData, currentStep, jobId, isSaving]);

  const fetchQualityScore = useCallback(async () => {
    setIsLoadingQualityScore(true);
    try {
      const submissionData: Partial<ProposalSubmission> = {
        jobId,
        coverLetter: formData.coverLetter,
        contractType: formData.contractType,
        bidAmount: formData.bidAmount,
        hourlyRate: formData.hourlyRate,
        estimatedHours: formData.estimatedHours,
        deliveryDays: formData.deliveryDays,
        milestones: formData.milestones.map(({ id: _id, ...m }, index) => ({ ...m, order: index })),
        attachments: formData.attachmentIds,
        portfolioItems: formData.portfolioItemIds,
      };

      const score = await previewQualityScore(submissionData);
      setQualityScore(score);
    } catch (error) {
      console.error('Failed to fetch quality score:', error);
    } finally {
      setIsLoadingQualityScore(false);
    }
  }, [formData, jobId]);

  const submit = useCallback(async (): Promise<string | null> => {
    // Validate all steps
    for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return null;
      }
    }

    setIsSubmitting(true);
    try {
      const submissionData: ProposalSubmission = {
        jobId,
        coverLetter: formData.coverLetter,
        contractType: formData.contractType,
        bidAmount: formData.bidAmount,
        hourlyRate: formData.hourlyRate,
        estimatedHours: formData.estimatedHours,
        deliveryDays: formData.deliveryDays,
        milestones:
          formData.milestones.length > 0
            ? formData.milestones.map(({ id: _id, ...m }, index) => ({ ...m, order: index }))
            : undefined,
        attachments: formData.attachmentIds.length > 0 ? formData.attachmentIds : undefined,
        portfolioItems:
          formData.portfolioItemIds.length > 0 ? formData.portfolioItemIds : undefined,
        templateId: formData.templateId,
      };

      const proposal = await submitProposal(submissionData);
      onSubmitSuccess?.(proposal.id);
      return proposal.id;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Submission failed');
      onSubmitError?.(err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, jobId, onSubmitSuccess, onSubmitError]);

  const reset = useCallback(() => {
    setFormData({
      ...INITIAL_FORM_DATA,
      contractType: initialContractType ?? 'FIXED',
    });
    setErrors({});
    setCurrentStep(0);
    setIsDirty(false);
    setLastSavedAt(null);
    setQualityScore(null);
  }, [initialContractType]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    formData,
    errors,
    currentStep,
    steps,
    isSubmitting,
    isSaving,
    isDirty,
    lastSavedAt,
    qualityScore,
    isLoadingQualityScore,
    setField,
    setFields,
    validateStep,
    nextStep,
    prevStep,
    goToStep,
    addMilestone,
    updateMilestone,
    removeMilestone,
    reorderMilestones,
    addAttachment,
    removeAttachment,
    addPortfolioItem,
    removePortfolioItem,
    loadTemplate,
    saveDraft,
    submit,
    reset,
    totalMilestoneAmount,
    milestoneAmountDiff,
    estimatedEarnings,
    canSubmit,
    completionPercentage,
  };
}
