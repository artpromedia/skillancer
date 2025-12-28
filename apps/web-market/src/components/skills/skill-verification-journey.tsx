'use client';

import { cn } from '@skillancer/ui';
import {
  CheckCircle,
  Circle,
  Users,
  Award,
  FileCheck,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type VerificationStep =
  | 'add-skill'
  | 'get-endorsed'
  | 'pass-assessment'
  | 'earn-certification';

export interface SkillVerificationProgress {
  skillId: string;
  skillName: string;
  currentStep: VerificationStep;
  endorsementsReceived: number;
  endorsementsRequired: number;
  assessmentPassed: boolean;
  assessmentScore?: number;
  certificationEarned: boolean;
  certificationName?: string;
}

export interface SkillVerificationJourneyProps {
  progress: SkillVerificationProgress;
  onTakeAssessment?: () => void;
  onRequestEndorsement?: () => void;
  onViewCertifications?: () => void;
  compact?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const JOURNEY_STEPS = [
  {
    id: 'add-skill' as const,
    label: 'Add Skill',
    description: 'Added to your profile',
    icon: CheckCircle,
    benefit: 'Appear in skill searches',
  },
  {
    id: 'get-endorsed' as const,
    label: 'Get Endorsed',
    description: 'Receive endorsements from peers',
    icon: Users,
    benefit: '20% more profile views',
  },
  {
    id: 'pass-assessment' as const,
    label: 'Pass Assessment',
    description: 'Prove your expertise',
    icon: FileCheck,
    benefit: '40% higher hiring rate',
  },
  {
    id: 'earn-certification' as const,
    label: 'Earn Certification',
    description: 'Industry-recognized credential',
    icon: Award,
    benefit: 'Premium rate eligibility',
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStepIndex(step: VerificationStep): number {
  return JOURNEY_STEPS.findIndex((s) => s.id === step);
}

function isStepCompleted(currentStep: VerificationStep, checkStep: VerificationStep): boolean {
  return getStepIndex(currentStep) > getStepIndex(checkStep);
}

function isStepCurrent(currentStep: VerificationStep, checkStep: VerificationStep): boolean {
  return currentStep === checkStep;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StepIndicatorProps {
  step: (typeof JOURNEY_STEPS)[number];
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
  progress?: { current: number; required: number };
  compact?: boolean;
}

function StepIndicator({
  step,
  isCompleted,
  isCurrent,
  isLast,
  progress,
  compact,
}: StepIndicatorProps) {
  const Icon = step.icon;

  return (
    <div className={cn('flex items-start gap-3', compact ? 'gap-2' : 'gap-3')}>
      {/* Step Circle */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex items-center justify-center rounded-full transition-colors',
            compact ? 'h-8 w-8' : 'h-10 w-10',
            isCompleted && 'bg-green-100 text-green-600',
            isCurrent && 'bg-primary text-primary-foreground',
            !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
          )}
        >
          {isCompleted ? (
            <CheckCircle className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          ) : (
            <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          )}
        </div>
        {/* Connector Line */}
        {!isLast && (
          <div
            className={cn(
              'w-0.5 flex-1',
              compact ? 'my-1 min-h-[16px]' : 'my-2 min-h-[24px]',
              isCompleted ? 'bg-green-200' : 'bg-muted'
            )}
          />
        )}
      </div>

      {/* Step Content */}
      <div className={cn('flex-1 pb-4', compact && 'pb-2')}>
        <div className="flex items-center gap-2">
          <h4
            className={cn(
              'font-medium',
              compact ? 'text-sm' : 'text-base',
              isCompleted && 'text-green-600',
              isCurrent && 'text-foreground',
              !isCompleted && !isCurrent && 'text-muted-foreground'
            )}
          >
            {step.label}
            {isCompleted && ' ✓'}
          </h4>
          {progress && isCurrent && (
            <span className="text-muted-foreground text-xs">
              ({progress.current}/{progress.required})
            </span>
          )}
        </div>
        {!compact && (
          <>
            <p className="text-muted-foreground text-sm">{step.description}</p>
            {isCurrent && (
              <div className="text-primary mt-2 flex items-center gap-1 text-xs">
                <Sparkles className="h-3 w-3" />
                <span>{step.benefit}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  progress: SkillVerificationProgress;
  onTakeAssessment?: () => void;
  onRequestEndorsement?: () => void;
  onViewCertifications?: () => void;
}

function ActionButton({
  progress,
  onTakeAssessment,
  onRequestEndorsement,
  onViewCertifications,
}: ActionButtonProps) {
  const { currentStep, endorsementsReceived, endorsementsRequired } = progress;

  if (currentStep === 'get-endorsed') {
    const remaining = endorsementsRequired - endorsementsReceived;
    return (
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium"
        onClick={onRequestEndorsement}
      >
        <span>Request Endorsement ({remaining} more needed)</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  if (currentStep === 'pass-assessment') {
    return (
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium"
        onClick={onTakeAssessment}
      >
        <span>Take Skill Assessment</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  if (currentStep === 'earn-certification') {
    return (
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium"
        onClick={onViewCertifications}
      >
        <span>Explore Certifications</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SkillVerificationJourney({
  progress,
  onTakeAssessment,
  onRequestEndorsement,
  onViewCertifications,
  compact = false,
}: SkillVerificationJourneyProps) {
  const { currentStep, endorsementsReceived, endorsementsRequired } = progress;

  // Calculate overall progress percentage
  const currentStepIndex = getStepIndex(currentStep);
  const progressPercent = Math.round((currentStepIndex / JOURNEY_STEPS.length) * 100);

  return (
    <div className={cn('bg-card rounded-lg border', compact ? 'p-4' : 'p-6')}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
            {progress.skillName} Verification
          </h3>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <TrendingUp className="h-3 w-3" />
            <span>{progressPercent}% complete</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-muted mb-6 h-2 overflow-hidden rounded-full">
        <div
          className="from-primary h-full bg-gradient-to-r to-green-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Journey Steps */}
      <div className="space-y-0">
        {JOURNEY_STEPS.map((step, index) => (
          <StepIndicator
            key={step.id}
            compact={compact}
            isCompleted={isStepCompleted(currentStep, step.id)}
            isCurrent={isStepCurrent(currentStep, step.id)}
            isLast={index === JOURNEY_STEPS.length - 1}
            progress={
              step.id === 'get-endorsed'
                ? { current: endorsementsReceived, required: endorsementsRequired }
                : undefined
            }
            step={step}
          />
        ))}
      </div>

      {/* Action Button */}
      {!compact && (
        <div className="mt-4 border-t pt-4">
          <ActionButton
            progress={progress}
            onRequestEndorsement={onRequestEndorsement}
            onTakeAssessment={onTakeAssessment}
            onViewCertifications={onViewCertifications}
          />
        </div>
      )}

      {/* Benefits Summary */}
      {!compact && progress.certificationEarned && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-center">
          <Award className="mx-auto h-8 w-8 text-green-600" />
          <p className="mt-2 font-medium text-green-800">Fully Verified!</p>
          <p className="text-sm text-green-600">This skill is certified and trusted by clients</p>
        </div>
      )}
    </div>
  );
}

export default SkillVerificationJourney;
