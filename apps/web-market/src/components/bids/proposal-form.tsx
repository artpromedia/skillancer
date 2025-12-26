/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  TrendingUp,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CoverLetterEditor } from './cover-letter-editor';
import { MilestoneBuilder } from './milestone-builder';

import type { MilestoneData, UseProposalFormReturn } from '@/hooks/use-proposal-form';
import type { ContractType, ProposalTemplate, QualityScore } from '@/lib/api/bids';

import {
  calculateEarningsAfterFees,
  getProposalTemplates,
  uploadProposalAttachment,
} from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface ProposalFormProps {
  jobId: string;
  jobTitle: string;
  jobBudget: {
    type: ContractType;
    minAmount?: number;
    maxAmount?: number;
    amount?: number;
  };
  jobSkills: string[];
  form: UseProposalFormReturn;
  onCancel?: () => void;
  className?: string;
}

interface AttachmentPreview {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  isUploading: boolean;
  progress: number;
}

// ============================================================================
// Step Components
// ============================================================================

function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: { id: string; title: string; isComplete: boolean; isActive: boolean }[];
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="mb-8">
      {/* Mobile view */}
      <div className="mb-4 flex items-center justify-between sm:hidden">
        <span className="text-muted-foreground text-sm">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="font-medium">{steps[currentStep]?.title}</span>
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex sm:items-center">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                step.isActive && 'bg-primary text-primary-foreground',
                step.isComplete && !step.isActive && 'cursor-pointer bg-green-100 text-green-700',
                !step.isComplete && !step.isActive && 'bg-muted text-muted-foreground'
              )}
              disabled={!step.isComplete && index > currentStep}
              type="button"
              onClick={() => onStepClick(index)}
            >
              {step.isComplete && !step.isActive ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="bg-current/20 flex h-5 w-5 items-center justify-center rounded-full text-xs">
                  {index + 1}
                </span>
              )}
              {step.title}
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn('mx-2 h-px w-8', index < currentStep ? 'bg-green-500' : 'bg-muted')}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Cover Letter Step
// ============================================================================

function CoverLetterStep({
  form,
  jobSkills,
}: {
  form: UseProposalFormReturn;
  jobSkills: string[];
}) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Load templates
  useEffect(() => {
    void getProposalTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  // Apply template
  const handleTemplateChange = useCallback(
    (templateId: string) => {
      setSelectedTemplate(templateId);
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        form.loadTemplate(templateId, template.coverLetter);
      }
    },
    [templates, form]
  );

  return (
    <div className="space-y-6">
      {/* Template selection */}
      {templates.length > 0 && (
        <div>
          <Label htmlFor="template-select">Start from a template</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="mt-1" id="template-select">
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Cover letter editor */}
      <CoverLetterEditor
        error={form.errors.coverLetter}
        jobRequirements={jobSkills}
        maxLength={5000}
        minLength={200}
        suggestions={[
          { type: 'tip', text: 'Start with a hook that shows you understand the problem' },
          { type: 'tip', text: 'Mention specific relevant experience' },
          { type: 'question', text: 'What makes you uniquely qualified for this project?' },
        ]}
        value={form.formData.coverLetter}
        onChange={(value) => form.setField('coverLetter', value)}
      />
    </div>
  );
}

// ============================================================================
// Pricing Step
// ============================================================================

function PricingStep({
  form,
  jobBudget,
}: {
  form: UseProposalFormReturn;
  jobBudget: { type: ContractType; minAmount?: number; maxAmount?: number; amount?: number };
}) {
  const { formData, setField, errors } = form;

  // Calculate earnings
  const earnings = useMemo(() => {
    const amount =
      formData.contractType === 'HOURLY'
        ? (formData.hourlyRate ?? 0) * (formData.estimatedHours ?? 0)
        : formData.bidAmount;
    return calculateEarningsAfterFees(amount);
  }, [formData.contractType, formData.bidAmount, formData.hourlyRate, formData.estimatedHours]);

  // Competitive indicator
  const competitiveIndicator = useMemo(() => {
    if (!jobBudget.minAmount && !jobBudget.maxAmount) return null;

    const avg = jobBudget.amount ?? ((jobBudget.minAmount ?? 0) + (jobBudget.maxAmount ?? 0)) / 2;
    const diff = ((formData.bidAmount - avg) / avg) * 100;

    if (diff < -20) return { text: 'Very Competitive', color: 'text-green-600', icon: TrendingUp };
    if (diff < -10) return { text: 'Competitive', color: 'text-green-500', icon: TrendingUp };
    if (diff > 20) return { text: 'Above Average', color: 'text-yellow-600', icon: AlertCircle };
    return { text: 'In Range', color: 'text-blue-600', icon: Check };
  }, [formData.bidAmount, jobBudget]);

  return (
    <div className="space-y-6">
      {/* Contract type */}
      <div>
        <Label>Contract Type</Label>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <button
            className={cn(
              'flex flex-col items-center rounded-lg border p-4 transition-colors',
              formData.contractType === 'FIXED'
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
            )}
            type="button"
            onClick={() => setField('contractType', 'FIXED')}
          >
            <DollarSign className="mb-2 h-6 w-6" />
            <span className="font-medium">Fixed Price</span>
            <span className="text-muted-foreground text-xs">Pay once on completion</span>
          </button>

          <button
            className={cn(
              'flex flex-col items-center rounded-lg border p-4 transition-colors',
              formData.contractType === 'HOURLY'
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
            )}
            type="button"
            onClick={() => setField('contractType', 'HOURLY')}
          >
            <Clock className="mb-2 h-6 w-6" />
            <span className="font-medium">Hourly Rate</span>
            <span className="text-muted-foreground text-xs">Pay for time worked</span>
          </button>
        </div>
      </div>

      {/* Fixed price input */}
      {formData.contractType === 'FIXED' && (
        <div>
          <Label htmlFor="bid-amount">Your Bid</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              className="pl-7"
              id="bid-amount"
              min={1}
              placeholder="0"
              type="number"
              value={formData.bidAmount || ''}
              onChange={(e) => setField('bidAmount', parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {errors.bidAmount && <p className="mt-1 text-sm text-red-500">{errors.bidAmount}</p>}

          {/* Job budget hint */}
          {(jobBudget.minAmount || jobBudget.maxAmount) && (
            <p className="text-muted-foreground mt-1 text-sm">
              Client budget: ${jobBudget.minAmount?.toLocaleString()} - $
              {jobBudget.maxAmount?.toLocaleString()}
            </p>
          )}

          {/* Competitive indicator */}
          {competitiveIndicator && formData.bidAmount > 0 && (
            <div className={cn('mt-2 flex items-center gap-1 text-sm', competitiveIndicator.color)}>
              <competitiveIndicator.icon className="h-4 w-4" />
              {competitiveIndicator.text}
            </div>
          )}
        </div>
      )}

      {/* Hourly rate inputs */}
      {formData.contractType === 'HOURLY' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="hourly-rate">Hourly Rate</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                className="pl-7"
                id="hourly-rate"
                min={1}
                placeholder="0"
                type="number"
                value={formData.hourlyRate || ''}
                onChange={(e) => setField('hourlyRate', parseInt(e.target.value, 10) || undefined)}
              />
              <span className="text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                /hr
              </span>
            </div>
            {errors.hourlyRate && <p className="mt-1 text-sm text-red-500">{errors.hourlyRate}</p>}
          </div>

          <div>
            <Label htmlFor="estimated-hours">Estimated Hours</Label>
            <Input
              className="mt-1"
              id="estimated-hours"
              min={1}
              placeholder="40"
              type="number"
              value={formData.estimatedHours || ''}
              onChange={(e) =>
                setField('estimatedHours', parseInt(e.target.value, 10) || undefined)
              }
            />
            {errors.estimatedHours && (
              <p className="mt-1 text-sm text-red-500">{errors.estimatedHours}</p>
            )}
          </div>
        </div>
      )}

      {/* Delivery time */}
      <div>
        <Label htmlFor="delivery-days">Delivery Time</Label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            className="w-24"
            id="delivery-days"
            min={1}
            type="number"
            value={formData.deliveryDays}
            onChange={(e) => setField('deliveryDays', parseInt(e.target.value, 10) || 1)}
          />
          <span className="text-muted-foreground">days</span>
        </div>
        {errors.deliveryDays && <p className="mt-1 text-sm text-red-500">{errors.deliveryDays}</p>}
      </div>

      {/* Earnings calculator */}
      <Card className="bg-green-50">
        <CardContent className="p-4">
          <h4 className="mb-3 font-medium text-green-900">Your Earnings</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-green-700">Gross amount</span>
              <span className="font-medium">${earnings.grossAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Platform fee</span>
              <span className="text-red-600">-${earnings.platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Processing fee</span>
              <span className="text-red-600">-${earnings.paymentProcessingFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-green-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-green-900">You&apos;ll receive</span>
                <span className="text-lg font-bold text-green-700">
                  ${earnings.netEarnings.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Milestones Step
// ============================================================================

function MilestonesStep({ form }: { form: UseProposalFormReturn }) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Optional: Break down your project into milestones for phased delivery and payments.
      </p>

      <MilestoneBuilder
        error={form.errors.milestones}
        milestones={form.formData.milestones}
        totalBudget={form.formData.bidAmount}
        onAdd={(milestone: Omit<MilestoneData, 'id'>) => form.addMilestone(milestone)}
        onRemove={form.removeMilestone}
        onReorder={form.reorderMilestones}
        onUpdate={form.updateMilestone}
      />
    </div>
  );
}

// ============================================================================
// Attachments Step
// ============================================================================

function AttachmentsStep({ form }: { form: UseProposalFormReturn }) {
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file upload
  const handleUpload = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        // Validate file
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const preview: AttachmentPreview = {
          id: tempId,
          filename: file.name,
          url: URL.createObjectURL(file),
          size: file.size,
          mimeType: file.type,
          isUploading: true,
          progress: 0,
        };

        setAttachments((prev) => [...prev, preview]);

        try {
          const uploaded = await uploadProposalAttachment(file, (progress) => {
            setAttachments((prev) => prev.map((a) => (a.id === tempId ? { ...a, progress } : a)));
          });

          setAttachments((prev) =>
            prev.map((a) =>
              a.id === tempId
                ? { ...a, id: uploaded.id, url: uploaded.url, isUploading: false, progress: 100 }
                : a
            )
          );

          form.addAttachment(uploaded.id);
        } catch {
          setAttachments((prev) => prev.filter((a) => a.id !== tempId));
          alert(`Failed to upload ${file.name}`);
        }
      }
    },
    [form]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      void handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  // Handle remove
  const handleRemove = useCallback(
    (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      form.removeAttachment(id);
    },
    [form]
  );

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Add files to support your proposal, such as portfolio samples or relevant documents.
      </p>

      {/* Drop zone */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
        )}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        <p className="mb-2 font-medium">Drop files here or click to upload</p>
        <p className="text-muted-foreground text-sm">PDF, DOC, PNG, JPG up to 10MB each</p>
        <input
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip"
          className="absolute inset-0 cursor-pointer opacity-0"
          type="file"
          onChange={(e) => e.target.files && void handleUpload(e.target.files)}
        />
      </div>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 rounded-lg border bg-white p-3"
            >
              <Paperclip className="h-5 w-5 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{attachment.filename}</p>
                <p className="text-muted-foreground text-xs">{formatSize(attachment.size)}</p>
              </div>

              {attachment.isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${attachment.progress}%` }}
                    />
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              ) : (
                <Button
                  className="h-8 w-8"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemove(attachment.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Portfolio items */}
      <div>
        <h4 className="mb-2 font-medium">Link Portfolio Items</h4>
        <p className="text-muted-foreground mb-4 text-sm">
          Select relevant portfolio items to showcase your work.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/profile/portfolio">
            <FileText className="mr-2 h-4 w-4" />
            Select from Portfolio
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Review Step
// ============================================================================

function ReviewStep({ form, jobTitle }: { form: UseProposalFormReturn; jobTitle: string }) {
  const { formData, qualityScore, isLoadingQualityScore } = form;

  return (
    <div className="space-y-6">
      {/* Quality score */}
      {isLoadingQualityScore ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyzing your proposal...
          </CardContent>
        </Card>
      ) : qualityScore ? (
        <QualityScoreCard score={qualityScore} />
      ) : null}

      {/* Proposal preview */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Proposal Preview</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Job */}
          <div>
            <p className="text-muted-foreground text-xs">Applying for</p>
            <p className="font-medium">{jobTitle}</p>
          </div>

          {/* Bid details */}
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
            <div>
              <p className="text-muted-foreground text-xs">Your Bid</p>
              <p className="text-lg font-semibold">
                ${formData.bidAmount.toLocaleString()}
                {formData.contractType === 'HOURLY' && '/hr'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Delivery</p>
              <p className="text-lg font-semibold">{formData.deliveryDays} days</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Milestones</p>
              <p className="text-lg font-semibold">{formData.milestones.length || 'None'}</p>
            </div>
          </div>

          {/* Cover letter preview */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs">Cover Letter</p>
            <div className="prose prose-sm max-h-48 overflow-y-auto rounded-lg bg-slate-50 p-4">
              <p className="whitespace-pre-wrap">{formData.coverLetter}</p>
            </div>
          </div>

          {/* Milestones preview */}
          {formData.milestones.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs">Milestones</p>
              <div className="space-y-2">
                {formData.milestones.map((milestone, index) => (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{milestone.title}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${milestone.amount.toLocaleString()}</p>
                      <p className="text-muted-foreground text-xs">{milestone.durationDays} days</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {formData.attachmentIds.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs">Attachments</p>
              <p className="text-sm">{formData.attachmentIds.length} file(s) attached</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms */}
      <div className="flex items-start gap-3 rounded-lg border p-4">
        <input
          checked={formData.acceptedTerms}
          className="mt-1 h-4 w-4 rounded border-slate-300"
          id="accept-terms"
          type="checkbox"
          onChange={(e) => form.setField('acceptedTerms', e.target.checked)}
        />
        <label className="text-sm" htmlFor="accept-terms">
          I agree to the{' '}
          <Link className="text-primary underline" href="/terms">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link className="text-primary underline" href="/freelancer-agreement">
            Freelancer Agreement
          </Link>
          . I understand that submitting a proposal does not guarantee being hired.
        </label>
      </div>
      {form.errors.acceptedTerms && (
        <p className="text-sm text-red-500">{form.errors.acceptedTerms}</p>
      )}
    </div>
  );
}

// ============================================================================
// Quality Score Card
// ============================================================================

function QualityScoreCard({ score }: { score: QualityScore }) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card
      className={cn(
        score.overall >= 80 && 'border-green-300 bg-green-50',
        score.overall >= 60 && score.overall < 80 && 'border-yellow-300 bg-yellow-50',
        score.overall < 60 && 'border-red-300 bg-red-50'
      )}
    >
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <h4 className="font-semibold">Proposal Quality Score</h4>
          </div>
          <span className={cn('text-2xl font-bold', getScoreColor(score.overall))}>
            {score.overall}%
          </span>
        </div>

        {/* Breakdown */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(score.breakdown).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className={cn('text-lg font-semibold', getScoreColor(value))}>{value}%</div>
              <div className="text-muted-foreground text-xs">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        {score.suggestions.length > 0 && (
          <div className="space-y-2">
            {score.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-2 rounded-lg p-2 text-sm',
                  suggestion.type === 'SUCCESS' && 'bg-green-100/50',
                  suggestion.type === 'IMPROVEMENT' && 'bg-blue-100/50',
                  suggestion.type === 'WARNING' && 'bg-yellow-100/50'
                )}
              >
                {suggestion.type === 'SUCCESS' && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                )}
                {suggestion.type === 'IMPROVEMENT' && (
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                )}
                {suggestion.type === 'WARNING' && (
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                )}
                <span>{suggestion.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalForm({
  jobId: _jobId,
  jobTitle,
  jobBudget,
  jobSkills,
  form,
  onCancel,
  className,
}: ProposalFormProps) {
  const { steps, currentStep, goToStep, nextStep, prevStep, isSubmitting, isSaving, lastSavedAt } =
    form;

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const proposalId = await form.submit();
    if (proposalId) {
      // Redirect handled by parent
    }
  }, [form]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submit Proposal</h1>
          <p className="text-muted-foreground">{jobTitle}</p>
        </div>
        {lastSavedAt && (
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Saved {new Date(lastSavedAt).toLocaleTimeString()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={currentStep} steps={steps} onStepClick={goToStep} />

      {/* Step content */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{steps[currentStep]?.title}</h2>
          <p className="text-muted-foreground text-sm">{steps[currentStep]?.description}</p>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && <CoverLetterStep form={form} jobSkills={jobSkills} />}
          {currentStep === 1 && <PricingStep form={form} jobBudget={jobBudget} />}
          {currentStep === 2 && <MilestonesStep form={form} />}
          {currentStep === 3 && <AttachmentsStep form={form} />}
          {currentStep === 4 && <ReviewStep form={form} jobTitle={jobTitle} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep > 0 && (
            <Button type="button" variant="outline" onClick={prevStep}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          {currentStep < steps.length - 1 ? (
            <Button type="button" onClick={() => nextStep()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              disabled={!form.canSubmit || isSubmitting}
              type="button"
              onClick={() => void handleSubmit()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Submit Proposal
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
