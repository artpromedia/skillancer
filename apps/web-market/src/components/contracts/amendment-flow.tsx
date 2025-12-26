/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises */
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Contract, Milestone, Amendment } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

type AmendmentType = 'BUDGET' | 'DEADLINE' | 'SCOPE' | 'MILESTONES';

interface AmendmentFlowProps {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amendment: AmendmentRequest) => Promise<void>;
}

interface AmendmentRequest {
  type: AmendmentType;
  reason: string;
  changes: {
    budgetChange?: number;
    newDeadline?: string;
    scopeDescription?: string;
    milestoneChanges?: MilestoneChange[];
  };
}

interface MilestoneChange {
  action: 'ADD' | 'REMOVE' | 'MODIFY';
  milestoneId?: string;
  title?: string;
  amount?: number;
  dueDate?: string;
}

// ============================================================================
// Amendment Type Config
// ============================================================================

const amendmentTypes: Record<
  AmendmentType,
  { label: string; icon: React.ElementType; description: string }
> = {
  BUDGET: {
    label: 'Budget Change',
    icon: DollarSign,
    description: 'Increase or decrease the contract value',
  },
  DEADLINE: {
    label: 'Deadline Extension',
    icon: Calendar,
    description: 'Extend the contract end date',
  },
  SCOPE: {
    label: 'Scope Modification',
    icon: FileText,
    description: 'Change the work requirements',
  },
  MILESTONES: {
    label: 'Milestone Changes',
    icon: Check,
    description: 'Add, remove, or modify milestones',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function AmendmentFlow({ contract, open, onOpenChange, onSubmit }: AmendmentFlowProps) {
  const [step, setStep] = useState<'type' | 'details' | 'review'>('type');
  const [type, setType] = useState<AmendmentType | null>(null);
  const [reason, setReason] = useState('');
  const [budgetChange, setBudgetChange] = useState(0);
  const [newDeadline, setNewDeadline] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [milestoneChanges, setMilestoneChanges] = useState<MilestoneChange[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form
  const resetForm = useCallback(() => {
    setStep('type');
    setType(null);
    setReason('');
    setBudgetChange(0);
    setNewDeadline('');
    setScopeDescription('');
    setMilestoneChanges([]);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!type) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        reason,
        changes: {
          budgetChange: type === 'BUDGET' ? budgetChange : undefined,
          newDeadline: type === 'DEADLINE' ? newDeadline : undefined,
          scopeDescription: type === 'SCOPE' ? scopeDescription : undefined,
          milestoneChanges: type === 'MILESTONES' ? milestoneChanges : undefined,
        },
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    type,
    reason,
    budgetChange,
    newDeadline,
    scopeDescription,
    milestoneChanges,
    onSubmit,
    handleClose,
  ]);

  // Add milestone change
  const addMilestoneChange = useCallback((action: 'ADD' | 'REMOVE' | 'MODIFY') => {
    setMilestoneChanges((prev) => [...prev, { action, title: '', amount: 0, dueDate: '' }]);
  }, []);

  // Remove milestone change
  const removeMilestoneChange = useCallback((index: number) => {
    setMilestoneChanges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update milestone change
  const updateMilestoneChange = useCallback((index: number, updates: Partial<MilestoneChange>) => {
    setMilestoneChanges((prev) => prev.map((mc, i) => (i === index ? { ...mc, ...updates } : mc)));
  }, []);

  // Calculate impact
  const calculateImpact = () => {
    let budgetImpact = 0;
    let daysImpact = 0;

    if (type === 'BUDGET') {
      budgetImpact = budgetChange;
    } else if (type === 'DEADLINE' && newDeadline) {
      const current = new Date(contract.endDate || Date.now());
      const newDate = new Date(newDeadline);
      daysImpact = Math.ceil((newDate.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    } else if (type === 'MILESTONES') {
      milestoneChanges.forEach((mc) => {
        if (mc.action === 'ADD') budgetImpact += mc.amount || 0;
        if (mc.action === 'REMOVE') budgetImpact -= mc.amount || 0;
      });
    }

    return { budgetImpact, daysImpact };
  };

  const impact = calculateImpact();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Contract Amendment</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b pb-4">
          {['type', 'details', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : i < ['type', 'details', 'review'].indexOf(step)
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {i < ['type', 'details', 'review'].indexOf(step) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-8',
                    i < ['type', 'details', 'review'].indexOf(step) ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Select Type */}
        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              What would you like to change about this contract?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                Object.entries(amendmentTypes) as [AmendmentType, typeof amendmentTypes.BUDGET][]
              ).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                      'hover:border-primary hover:bg-primary/5'
                    )}
                    type="button"
                    onClick={() => {
                      setType(key);
                      setStep('details');
                    }}
                  >
                    <Icon className="text-primary mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-muted-foreground text-sm">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && type && (
          <div className="space-y-4">
            {/* Budget Change */}
            {type === 'BUDGET' && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium">Current Contract Value</p>
                  <p className="text-2xl font-bold">${contract.amount?.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <Label>Change Amount (+ for increase, - for decrease)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      placeholder="0"
                      type="number"
                      value={budgetChange}
                      onChange={(e) => setBudgetChange(Number(e.target.value))}
                    />
                  </div>
                  {budgetChange !== 0 && (
                    <p className="text-sm">
                      New total:{' '}
                      <span className="font-semibold">
                        ${((contract.amount || 0) + budgetChange).toLocaleString()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Deadline Extension */}
            {type === 'DEADLINE' && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium">Current End Date</p>
                  <p className="text-lg font-semibold">
                    {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>New End Date</Label>
                  <Input
                    min={new Date().toISOString().split('T')[0]}
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Scope Modification */}
            {type === 'SCOPE' && (
              <div className="space-y-2">
                <Label>Describe the Scope Changes</Label>
                <Textarea
                  placeholder="Explain what changes need to be made to the work requirements..."
                  rows={6}
                  value={scopeDescription}
                  onChange={(e) => setScopeDescription(e.target.value)}
                />
              </div>
            )}

            {/* Milestone Changes */}
            {type === 'MILESTONES' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addMilestoneChange('ADD')}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Milestone
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addMilestoneChange('MODIFY')}>
                    Modify Existing
                  </Button>
                </div>

                {milestoneChanges.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    No milestone changes added yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {milestoneChanges.map((mc, index) => (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <Badge
                            variant={
                              mc.action === 'ADD'
                                ? 'default'
                                : mc.action === 'REMOVE'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {mc.action}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMilestoneChange(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            placeholder="Title"
                            value={mc.title}
                            onChange={(e) =>
                              updateMilestoneChange(index, { title: e.target.value })
                            }
                          />
                          <Input
                            placeholder="Amount"
                            type="number"
                            value={mc.amount || ''}
                            onChange={(e) =>
                              updateMilestoneChange(index, { amount: Number(e.target.value) })
                            }
                          />
                          <Input
                            type="date"
                            value={mc.dueDate}
                            onChange={(e) =>
                              updateMilestoneChange(index, { dueDate: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Amendment *</Label>
              <Textarea
                placeholder="Explain why this change is needed..."
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && type && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <h3 className="font-semibold">Amendment Summary</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{amendmentTypes[type].label}</span>
                </div>

                {type === 'BUDGET' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Budget Change</span>
                    <span
                      className={cn(
                        'font-medium',
                        budgetChange > 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {budgetChange > 0 ? '+' : ''}${budgetChange.toLocaleString()}
                    </span>
                  </div>
                )}

                {type === 'DEADLINE' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Deadline</span>
                    <span className="font-medium">
                      {newDeadline ? new Date(newDeadline).toLocaleDateString() : '-'}
                    </span>
                  </div>
                )}

                {type === 'MILESTONES' && (
                  <div>
                    <span className="text-muted-foreground">Milestone Changes</span>
                    <ul className="mt-1 space-y-1 text-sm">
                      {milestoneChanges.map((mc, i) => (
                        <li key={i}>
                          {mc.action}: {mc.title} (${mc.amount})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t pt-3">
                  <span className="text-muted-foreground">Reason</span>
                  <p className="mt-1 text-sm">{reason}</p>
                </div>
              </CardContent>
            </Card>

            {/* Impact Summary */}
            {(impact.budgetImpact !== 0 || impact.daysImpact !== 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">Impact Summary</p>
                    <ul className="text-muted-foreground mt-1 text-sm">
                      {impact.budgetImpact !== 0 && (
                        <li>
                          Budget: {impact.budgetImpact > 0 ? '+' : ''}$
                          {impact.budgetImpact.toLocaleString()}
                        </li>
                      )}
                      {impact.daysImpact !== 0 && <li>Timeline: +{impact.daysImpact} days</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <p className="text-muted-foreground text-sm">
              The other party will need to approve this amendment before it takes effect.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={
              step === 'type' ? handleClose : () => setStep(step === 'review' ? 'details' : 'type')
            }
          >
            {step === 'type' ? 'Cancel' : 'Back'}
          </Button>
          {step !== 'type' && (
            <Button
              disabled={isSubmitting || (step === 'details' && !reason)}
              onClick={step === 'details' ? () => setStep('review') : handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : step === 'review' ? (
                'Submit Amendment'
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Amendment History Component
// ============================================================================

interface AmendmentHistoryProps {
  amendments: Amendment[];
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
}

export function AmendmentHistory({ amendments, onApprove, onReject }: AmendmentHistoryProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      if (action === 'approve' && onApprove) await onApprove(id);
      if (action === 'reject' && onReject) await onReject(id);
    } finally {
      setProcessingId(null);
    }
  };

  if (amendments.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No amendments have been requested</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {amendments.map((amendment) => (
        <Card key={amendment.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      amendment.status === 'APPROVED'
                        ? 'default'
                        : amendment.status === 'REJECTED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {amendment.status}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {new Date(amendment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 font-medium">{amendment.type}</p>
                <p className="text-muted-foreground text-sm">{amendment.reason}</p>
              </div>

              {amendment.status === 'PENDING' && onApprove && onReject && (
                <div className="flex gap-2">
                  <Button
                    disabled={processingId === amendment.id}
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(amendment.id, 'reject')}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    disabled={processingId === amendment.id}
                    size="sm"
                    onClick={() => handleAction(amendment.id, 'approve')}
                  >
                    {processingId === amendment.id ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
