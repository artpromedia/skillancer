/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises, react/no-unescaped-entities */
'use client';

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
} from '@skillancer/ui';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Milestone } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface MilestoneSubmissionModalProps {
  readonly milestone: Milestone | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (milestoneId: string, data: SubmissionData) => Promise<void>;
}

interface SubmissionData {
  message: string;
  deliverables: DeliverableCheck[];
  attachments: AttachmentFile[];
  links: ExternalLink[];
}

interface DeliverableCheck {
  id: string;
  title: string;
  completed: boolean;
}

interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface ExternalLink {
  id: string;
  title: string;
  url: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStepIndicatorClass(stepIndex: number, currentStepIndex: number): string {
  if (stepIndex === currentStepIndex) {
    return 'bg-primary text-primary-foreground';
  }
  if (stepIndex < currentStepIndex) {
    return 'bg-green-500 text-white';
  }
  return 'bg-muted text-muted-foreground';
}

// ============================================================================
// Component
// ============================================================================

export function MilestoneSubmissionModal({
  milestone,
  open,
  onOpenChange,
  onSubmit,
}: MilestoneSubmissionModalProps) {
  const [step, setStep] = useState<'checklist' | 'attachments' | 'preview'>('checklist');
  const [message, setMessage] = useState('');
  const [deliverables, setDeliverables] = useState<DeliverableCheck[]>([]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize deliverables from milestone
  const initializeDeliverables = useCallback(() => {
    if (milestone?.deliverables) {
      setDeliverables(
        milestone.deliverables.map((d, i) => ({
          id: `del-${i}`,
          title: d,
          completed: false,
        }))
      );
    } else {
      // Default deliverables based on milestone title
      setDeliverables([
        { id: 'del-1', title: 'All required features implemented', completed: false },
        { id: 'del-2', title: 'Code reviewed and tested', completed: false },
        { id: 'del-3', title: 'Documentation updated', completed: false },
      ]);
    }
  }, [milestone]);

  // Reset state when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      initializeDeliverables();
      setStep('checklist');
      setMessage('');
      setAttachments([]);
      setLinks([]);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // Toggle deliverable
  const toggleDeliverable = (id: string) => {
    setDeliverables((prev) =>
      prev.map((d) => (d.id === id ? { ...d, completed: !d.completed } : d))
    );
  };

  // Add link
  const addLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    setLinks((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        title: newLinkTitle.trim(),
        url: newLinkUrl.trim(),
      },
    ]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  // Remove link
  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = Array.from(files).map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Check if all deliverables are completed
  const allDeliverablesCompleted = deliverables.every((d) => d.completed);
  const completedCount = deliverables.filter((d) => d.completed).length;

  // Submit milestone
  const handleSubmit = async () => {
    if (!milestone) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(milestone.id, {
        message,
        deliverables,
        attachments,
        links,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit milestone');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Milestone Work
          </DialogTitle>
        </DialogHeader>

        {/* Milestone Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{milestone.title}</h3>
              {milestone.description && (
                <p className="text-muted-foreground mt-1 text-sm">{milestone.description}</p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 font-semibold text-green-600">
                <DollarSign className="h-4 w-4" />
                {milestone.amount.toLocaleString()}
              </div>
              {milestone.dueDate && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(milestone.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {(['checklist', 'attachments', 'preview'] as const).map((s, i) => {
            const currentStepIndex = ['checklist', 'attachments', 'preview'].indexOf(step);
            return (
              <div key={s} className="flex items-center">
                <button
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    getStepIndicatorClass(i, currentStepIndex)
                  )}
                  onClick={() => setStep(s)}
                >
                  {i < currentStepIndex ? <Check className="h-4 w-4" /> : i + 1}
                </button>
                {i < 2 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-12',
                      i < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Step Content */}
        <div className="min-h-[300px]">
          {/* Step 1: Checklist */}
          {step === 'checklist' && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-3 font-medium">Deliverables Checklist</h4>
                <p className="text-muted-foreground mb-4 text-sm">
                  Confirm that you've completed all deliverables before submitting.
                </p>
              </div>

              <div className="space-y-2">
                {deliverables.map((deliverable) => (
                  <button
                    key={deliverable.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      deliverable.completed ? 'border-green-200 bg-green-50' : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleDeliverable(deliverable.id)}
                  >
                    <div
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                        deliverable.completed
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-muted-foreground'
                      )}
                    >
                      {deliverable.completed && <Check className="h-3 w-3" />}
                    </div>
                    <span className={deliverable.completed ? 'text-green-700' : ''}>
                      {deliverable.title}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-muted-foreground text-sm">
                {completedCount} of {deliverables.length} completed
              </div>

              {!allDeliverablesCompleted && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">
                    You can still submit without completing all items, but the client may request
                    revisions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Attachments */}
          {step === 'attachments' && (
            <div className="space-y-6">
              {/* Message */}
              <div>
                <Label htmlFor="message">Message to Client</Label>
                <textarea
                  className="border-input bg-background mt-2 w-full rounded-md border p-3 text-sm"
                  id="message"
                  placeholder="Describe what you've completed and any notes for the client..."
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* File Attachments */}
              <div>
                <Label>File Attachments</Label>
                <div className="mt-2">
                  <label className="hover:bg-muted flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors">
                    <input
                      multiple
                      accept="*/*"
                      className="hidden"
                      type="file"
                      onChange={handleFileUpload}
                    />
                    <Upload className="text-muted-foreground h-5 w-5" />
                    <span className="text-muted-foreground text-sm">Click to upload files</span>
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="text-muted-foreground h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeAttachment(file.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* External Links */}
              <div>
                <Label>External Links</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Link title"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                  />
                  <Input
                    className="flex-1"
                    placeholder="https://..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                  />
                  <Button
                    disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                    variant="outline"
                    onClick={addLink}
                  >
                    Add
                  </Button>
                </div>

                {links.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="text-muted-foreground h-4 w-4" />
                          <a
                            className="text-primary text-sm hover:underline"
                            href={link.url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {link.title}
                          </a>
                          <ExternalLink className="text-muted-foreground h-3 w-3" />
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeLink(link.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <h4 className="font-medium">Ready to Submit</h4>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                {/* Summary */}
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Milestone</p>
                  <p className="font-medium">{milestone.title}</p>
                </div>

                <Separator />

                {/* Deliverables */}
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    Deliverables ({completedCount}/{deliverables.length})
                  </p>
                  <div className="mt-2 space-y-1">
                    {deliverables.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 text-sm">
                        {d.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className={d.completed ? '' : 'text-muted-foreground'}>
                          {d.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {message && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs uppercase">Message</p>
                      <p className="mt-1 text-sm">{message}</p>
                    </div>
                  </>
                )}

                {(attachments.length > 0 || links.length > 0) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs uppercase">Attachments</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attachments.map((a) => (
                          <Badge key={a.id} variant="secondary">
                            <FileText className="mr-1 h-3 w-3" />
                            {a.name}
                          </Badge>
                        ))}
                        {links.map((l) => (
                          <Badge key={l.id} variant="outline">
                            <Link2 className="mr-1 h-3 w-3" />
                            {l.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Once submitted, the client will be notified and can review your work. They can
                  approve the milestone and release payment, or request revisions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            disabled={step === 'checklist'}
            variant="outline"
            onClick={() => setStep(step === 'preview' ? 'attachments' : 'checklist')}
          >
            Back
          </Button>

          {step === 'preview' ? (
            <Button disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Milestone
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => setStep(step === 'checklist' ? 'attachments' : 'preview')}>
              Continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
