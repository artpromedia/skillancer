/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react/no-unescaped-entities */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@skillancer/ui';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  Paperclip,
  Scale,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type { Contract, Dispute } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

type DisputeReason =
  | 'QUALITY'
  | 'INCOMPLETE'
  | 'NON_PAYMENT'
  | 'COMMUNICATION'
  | 'SCOPE_CREEP'
  | 'MISSED_DEADLINE'
  | 'OTHER';

type Resolution = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_PAYMENT' | 'MEDIATION';

interface DisputeCenterProps {
  contract: Contract;
  dispute?: Dispute | null;
  isClient: boolean;
  onOpenDispute: (data: DisputeRequest) => Promise<void>;
  onResolve?: (resolution: Resolution) => Promise<void>;
  onEscalate?: () => Promise<void>;
}

interface DisputeRequest {
  reason: DisputeReason;
  description: string;
  evidenceUrls: string[];
  desiredResolution: Resolution;
}

// ============================================================================
// Config
// ============================================================================

const disputeReasons: Record<DisputeReason, { label: string; description: string }> = {
  QUALITY: { label: 'Quality Issues', description: 'Work does not meet agreed standards' },
  INCOMPLETE: { label: 'Incomplete Work', description: 'Deliverables are missing or unfinished' },
  NON_PAYMENT: { label: 'Non-Payment', description: 'Payment has not been released as agreed' },
  COMMUNICATION: {
    label: 'Communication Problems',
    description: 'Unresponsive or unprofessional behavior',
  },
  SCOPE_CREEP: {
    label: 'Scope Creep',
    description: 'Requirements changed beyond original agreement',
  },
  MISSED_DEADLINE: { label: 'Missed Deadline', description: 'Work was not delivered on time' },
  OTHER: { label: 'Other', description: 'Another issue not listed above' },
};

const resolutionOptions: Record<Resolution, { label: string; description: string }> = {
  FULL_REFUND: { label: 'Full Refund', description: 'Return all funds to client' },
  PARTIAL_REFUND: { label: 'Partial Refund', description: 'Split funds based on work completed' },
  RELEASE_PAYMENT: { label: 'Release Payment', description: 'Release full payment to freelancer' },
  MEDIATION: {
    label: 'Professional Mediation',
    description: 'Have a Skillancer mediator help resolve',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function renderSubmitButtonContent({
  isSubmitting,
  step,
}: {
  isSubmitting: boolean;
  step: 'reason' | 'details' | 'evidence' | 'resolution';
}) {
  if (isSubmitting) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Submitting...
      </>
    );
  }

  if (step === 'resolution') {
    return 'Submit Dispute';
  }

  return (
    <>
      Continue
      <ArrowRight className="ml-2 h-4 w-4" />
    </>
  );
}

function createRemoveEvidenceHandler(
  url: string,
  setEvidenceUrls: React.Dispatch<React.SetStateAction<string[]>>
) {
  return () => {
    setEvidenceUrls((prev) => prev.filter((item) => item !== url));
  };
}

// ============================================================================
// Open Dispute Modal
// ============================================================================

interface OpenDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DisputeRequest) => Promise<void>;
}

function OpenDisputeModal({ open, onOpenChange, onSubmit }: Readonly<OpenDisputeModalProps>) {
  const [step, setStep] = useState<'reason' | 'details' | 'evidence' | 'resolution'>('reason');
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [desiredResolution, setDesiredResolution] = useState<Resolution | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setStep('reason');
    setReason(null);
    setDescription('');
    setEvidenceUrls([]);
    setDesiredResolution(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!reason || !desiredResolution) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ reason, description, evidenceUrls, desiredResolution });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = () => {
    // Mock file upload - would integrate with actual upload
    setEvidenceUrls((prev) => [...prev, `evidence-${Date.now()}.pdf`]);
  };

  const steps = ['reason', 'details', 'evidence', 'resolution'] as const;
  const currentStepIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Open a Dispute
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-1 border-b pb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  i <= currentStepIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < currentStepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1',
                    i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Reason */}
        {step === 'reason' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              What is the primary reason for this dispute?
            </p>
            <div className="grid gap-2">
              {(
                Object.entries(disputeReasons) as [DisputeReason, typeof disputeReasons.QUALITY][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3 text-left transition-colors',
                    reason === key
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  )}
                  type="button"
                  onClick={() => setReason(key)}
                >
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-muted-foreground text-sm">{config.description}</p>
                  </div>
                  {reason === key && <Check className="text-primary h-5 w-5" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the Issue in Detail *</Label>
              <Textarea
                placeholder="Provide a detailed explanation of what happened, including dates and specific issues..."
                rows={6}
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDescription(e.target.value)
                }
              />
              <p className="text-muted-foreground text-xs">
                Be specific and factual. Include relevant dates, communications, and deliverables.
              </p>
            </div>
          </div>
        )}

        {/* Step: Evidence */}
        {step === 'evidence' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload any evidence that supports your case (optional but recommended).
            </p>

            <div
              className="hover:border-primary flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
              onClick={handleFileUpload}
            >
              <Upload className="text-muted-foreground mb-2 h-8 w-8" />
              <p className="font-medium">Click to upload files</p>
              <p className="text-muted-foreground text-sm">Screenshots, documents, chat logs</p>
            </div>

            {evidenceUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Evidence</p>
                {evidenceUrls.map((url) => (
                  <div key={url} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm">{url}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={createRemoveEvidenceHandler(url, setEvidenceUrls)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Resolution */}
        {step === 'resolution' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">What resolution are you seeking?</p>
            <div className="grid gap-2">
              {(
                Object.entries(resolutionOptions) as [
                  Resolution,
                  typeof resolutionOptions.FULL_REFUND,
                ][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3 text-left transition-colors',
                    desiredResolution === key
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/50'
                  )}
                  type="button"
                  onClick={() => setDesiredResolution(key)}
                >
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-muted-foreground text-sm">{config.description}</p>
                  </div>
                  {desiredResolution === key && <Check className="text-primary h-5 w-5" />}
                </button>
              ))}
            </div>

            {/* Warning */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Before submitting</p>
                  <p className="text-muted-foreground">
                    Opening a dispute will pause all work and payments on this contract. We
                    recommend trying to resolve issues directly with the other party first.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={
              step === 'reason'
                ? handleClose
                : () => {
                    const prevStep = steps[currentStepIndex - 1];
                    if (prevStep) setStep(prevStep);
                  }
            }
          >
            {step === 'reason' ? 'Cancel' : 'Back'}
          </Button>

          <Button
            disabled={
              isSubmitting ||
              (step === 'reason' && !reason) ||
              (step === 'details' && !description) ||
              (step === 'resolution' && !desiredResolution)
            }
            onClick={
              step === 'resolution'
                ? handleSubmit
                : () => {
                    const nextStep = steps[currentStepIndex + 1];
                    if (nextStep) setStep(nextStep);
                  }
            }
          >
            {renderSubmitButtonContent({ isSubmitting, step })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Dispute Status Card
// ============================================================================

interface DisputeStatusCardProps {
  dispute: Dispute;
  isClient: boolean;
  onResolve?: ((resolution: Resolution) => Promise<void>) | undefined;
  onEscalate?: (() => Promise<void>) | undefined;
}

function DisputeStatusCard({
  dispute,
  isClient,
  onResolve,
  onEscalate,
}: Readonly<DisputeStatusCardProps>) {
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-amber-500';
      case 'UNDER_REVIEW':
        return 'bg-blue-500';
      case 'RESOLVED':
        return 'bg-green-500';
      case 'ESCALATED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Active Dispute</h3>
          </div>
          <Badge className={cn(getStatusColor(dispute.status), 'text-white')}>
            {dispute.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-sm">Reason</p>
          <p className="font-medium">
            {disputeReasons[dispute.reason as DisputeReason]?.label || dispute.reason}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm">Description</p>
          <p className="text-sm">{dispute.description}</p>
        </div>

        <div>
          <p className="text-muted-foreground text-sm">Opened</p>
          <p className="text-sm">{new Date(dispute.openedAt).toLocaleDateString()}</p>
        </div>

        {dispute.status === 'OPEN' && (
          <div className="flex gap-2 pt-2">
            <Button
              disabled={isProcessing}
              size="sm"
              variant="outline"
              onClick={() => {
                setIsProcessing(true);
                onEscalate?.().finally(() => setIsProcessing(false));
              }}
            >
              <Scale className="mr-1 h-4 w-4" />
              Escalate to Mediation
            </Button>
            <Button asChild size="sm">
              <a href="#messages">
                <MessageSquare className="mr-1 h-4 w-4" />
                Message Other Party
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Dispute Center Component
// ============================================================================

export function DisputeCenter({
  contract,
  dispute,
  isClient,
  onOpenDispute,
  onResolve,
  onEscalate,
}: Readonly<DisputeCenterProps>) {
  const [showOpenModal, setShowOpenModal] = useState(false);

  // If there's an active dispute, show the status
  if (dispute) {
    return (
      <div className="space-y-4">
        <DisputeStatusCard
          dispute={dispute}
          isClient={isClient}
          onEscalate={onEscalate}
          onResolve={onResolve}
        />

        {/* Resolution Options (if applicable) */}
        {dispute.status === 'UNDER_REVIEW' && onResolve && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Proposed Resolution</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                The mediator has reviewed your case. Please select one of the following options:
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onResolve('PARTIAL_REFUND')}>
                  Accept Partial Refund
                </Button>
                <Button onClick={() => onResolve('MEDIATION')}>Continue Mediation</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // No dispute - show option to open one
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Shield className="text-muted-foreground h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Dispute Resolution Center</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                If you're experiencing issues with this contract that you cannot resolve directly
                with the other party, you can open a formal dispute.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setShowOpenModal(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Open a Dispute
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-2">
          <h4 className="text-sm font-medium">Before Opening a Dispute</h4>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4" />
              Try messaging the other party to resolve the issue directly
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4" />
              Review your contract terms and milestones
            </li>
            <li className="flex items-start gap-2">
              <Paperclip className="mt-0.5 h-4 w-4" />
              Gather any evidence (screenshots, files, messages)
            </li>
          </ul>
        </CardContent>
      </Card>

      <OpenDisputeModal
        open={showOpenModal}
        onOpenChange={setShowOpenModal}
        onSubmit={onOpenDispute}
      />
    </div>
  );
}
