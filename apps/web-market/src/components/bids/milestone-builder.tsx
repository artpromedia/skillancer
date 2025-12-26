/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import { Button, Card, CardContent, cn, Input, Textarea } from '@skillancer/ui';
import { Calendar, DollarSign, GripVertical, Plus, Trash2, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { MilestoneData } from '@/hooks/use-proposal-form';
import type { SuggestedMilestone } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface MilestoneBuilderProps {
  milestones: MilestoneData[];
  totalBudget: number;
  onAdd: (milestone: Omit<MilestoneData, 'id'>) => void;
  onUpdate: (id: string, data: Partial<MilestoneData>) => void;
  onRemove: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  suggestions?: SuggestedMilestone[];
  currency?: string;
  error?: string;
  className?: string;
}

interface MilestoneFormData {
  title: string;
  description: string;
  amount: string;
  durationDays: string;
}

// ============================================================================
// Milestone Card
// ============================================================================

interface MilestoneCardProps {
  milestone: MilestoneData;
  index: number;
  total: number;
  onUpdate: (data: Partial<MilestoneData>) => void;
  onRemove: () => void;
  currency: string;
}

function MilestoneCard({
  milestone,
  index,
  total,
  onUpdate,
  onRemove,
  currency,
}: MilestoneCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-white p-4 transition-shadow hover:shadow-md',
        isEditing && 'ring-primary ring-2'
      )}
    >
      {/* Drag handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="ml-6">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold">
              {index + 1}
            </span>
            {isEditing ? (
              <Input
                className="h-8 w-48 text-sm font-semibold"
                value={milestone.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
              />
            ) : (
              <h4 className="font-semibold">{milestone.title}</h4>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              size="icon"
              variant="ghost"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              className="text-destructive hover:text-destructive h-7 w-7 opacity-0 group-hover:opacity-100"
              size="icon"
              variant="ghost"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {isEditing ? (
          <Textarea
            className="mb-3 min-h-[60px] text-sm"
            placeholder="Describe what will be delivered..."
            value={milestone.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        ) : (
          <p className="text-muted-foreground mb-3 text-sm">{milestone.description}</p>
        )}

        {/* Amount and Duration */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <DollarSign className="text-muted-foreground h-4 w-4" />
            {isEditing ? (
              <Input
                className="h-7 w-24 text-sm"
                min={1}
                type="number"
                value={milestone.amount}
                onChange={(e) => onUpdate({ amount: parseInt(e.target.value, 10) || 0 })}
              />
            ) : (
              <span className="font-medium">
                {currency}
                {milestone.amount.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="text-muted-foreground h-4 w-4" />
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  className="h-7 w-16 text-sm"
                  min={1}
                  type="number"
                  value={milestone.durationDays}
                  onChange={(e) => onUpdate({ durationDays: parseInt(e.target.value, 10) || 1 })}
                />
                <span className="text-sm">days</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">
                {milestone.durationDays} {milestone.durationDays === 1 ? 'day' : 'days'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline connector */}
      {index < total - 1 && (
        <div className="from-primary/30 absolute -bottom-4 left-[22px] h-4 w-px bg-gradient-to-b to-transparent" />
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MilestoneBuilder({
  milestones,
  totalBudget,
  onAdd,
  onUpdate,
  onRemove,
  onReorder: _onReorder,
  suggestions = [],
  currency = '$',
  error,
  className,
}: MilestoneBuilderProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<MilestoneFormData>({
    title: '',
    description: '',
    amount: '',
    durationDays: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<MilestoneFormData>>({});

  // Calculate totals
  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const totalDuration = milestones.reduce((sum, m) => sum + m.durationDays, 0);
  const remaining = totalBudget - totalAmount;

  // Auto-fill remaining amount for new milestone
  useEffect(() => {
    if (showForm && !formData.amount && remaining > 0) {
      setFormData((prev) => ({ ...prev, amount: String(remaining) }));
    }
  }, [showForm, remaining, formData.amount]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Partial<MilestoneFormData> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!formData.amount || parseInt(formData.amount, 10) <= 0) {
      errors.amount = 'Amount must be positive';
    }
    if (!formData.durationDays || parseInt(formData.durationDays, 10) <= 0) {
      errors.durationDays = 'Duration must be at least 1 day';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle add
  const handleAdd = useCallback(() => {
    if (!validateForm()) return;

    onAdd({
      title: formData.title.trim(),
      description: formData.description.trim(),
      amount: parseInt(formData.amount, 10),
      durationDays: parseInt(formData.durationDays, 10),
    });

    setFormData({ title: '', description: '', amount: '', durationDays: '' });
    setShowForm(false);
  }, [formData, validateForm, onAdd]);

  // Apply suggestion
  const applySuggestion = useCallback(
    (suggestion: SuggestedMilestone) => {
      const amount = Math.round((totalBudget * suggestion.percentageOfTotal) / 100);

      setFormData({
        title: suggestion.title,
        description: suggestion.description,
        amount: String(amount),
        durationDays: String(suggestion.typicalDurationDays),
      });
      setShowForm(true);
    },
    [totalBudget]
  );

  // Auto-split into equal milestones
  const handleAutoSplit = useCallback(
    (count: number) => {
      const amountPerMilestone = Math.floor(totalBudget / count);
      const daysPerMilestone = 7;
      const remainder = totalBudget - amountPerMilestone * count;

      for (let i = 0; i < count; i++) {
        onAdd({
          title: `Milestone ${i + 1}`,
          description: `Deliverable ${i + 1} of ${count}`,
          amount: i === count - 1 ? amountPerMilestone + remainder : amountPerMilestone,
          durationDays: daysPerMilestone,
        });
      }
    },
    [totalBudget, onAdd]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">Project Milestones</h3>
          <p className="text-muted-foreground text-sm">
            Break down your project into manageable deliverables
          </p>
        </div>

        {milestones.length === 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleAutoSplit(2)}>
              2 Milestones
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAutoSplit(3)}>
              3 Milestones
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAutoSplit(4)}>
              4 Milestones
            </Button>
          </div>
        )}
      </div>

      {/* Milestone list */}
      {milestones.length > 0 && (
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <MilestoneCard
              key={milestone.id}
              currency={currency}
              index={index}
              milestone={milestone}
              total={milestones.length}
              onRemove={() => onRemove(milestone.id)}
              onUpdate={(data) => onUpdate(milestone.id, data)}
            />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {milestones.length > 0 && (
        <Card
          className={cn(
            remaining !== 0 && 'border-yellow-300 bg-yellow-50',
            remaining === 0 && 'border-green-300 bg-green-50'
          )}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="font-semibold">
                  {currency}
                  {totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-semibold">{totalDuration} days</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Milestones</p>
                <p className="font-semibold">{milestones.length}</p>
              </div>
            </div>

            <div
              className={cn(
                'text-sm font-medium',
                remaining > 0 && 'text-yellow-700',
                remaining < 0 && 'text-red-600',
                remaining === 0 && 'text-green-700'
              )}
            >
              {remaining > 0 && (
                <>
                  {currency}
                  {remaining.toLocaleString()} remaining
                </>
              )}
              {remaining < 0 && (
                <>
                  {currency}
                  {Math.abs(remaining).toLocaleString()} over budget
                </>
              )}
              {remaining === 0 && <>✓ Budget fully allocated</>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Add milestone form */}
      {showForm ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <h4 className="font-medium">Add Milestone</h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="milestone-title">
                  Title
                </label>
                <Input
                  id="milestone-title"
                  placeholder="e.g., Initial Design"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                />
                {formErrors.title && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="milestone-amount">
                    Amount ({currency})
                  </label>
                  <Input
                    id="milestone-amount"
                    min={1}
                    placeholder="500"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.amount}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="milestone-duration">
                    Duration (days)
                  </label>
                  <Input
                    id="milestone-duration"
                    min={1}
                    placeholder="7"
                    type="number"
                    value={formData.durationDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, durationDays: e.target.value }))
                    }
                  />
                  {formErrors.durationDays && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.durationDays}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="milestone-description">
                Description
              </label>
              <Textarea
                id="milestone-description"
                placeholder="Describe what will be delivered..."
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
              {formErrors.description && (
                <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAdd}>
                Add Milestone
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Milestone
        </Button>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && milestones.length === 0 && (
        <div className="rounded-lg border bg-blue-50 p-4">
          <h4 className="mb-2 font-medium text-blue-900">Suggested Milestones</h4>
          <p className="text-muted-foreground mb-3 text-sm">
            Based on similar projects, we recommend these milestones:
          </p>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="flex w-full items-center justify-between rounded-lg border bg-white p-3 text-left transition-colors hover:bg-blue-50"
                type="button"
                onClick={() => applySuggestion(suggestion)}
              >
                <div>
                  <p className="font-medium">{suggestion.title}</p>
                  <p className="text-muted-foreground text-sm">{suggestion.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{suggestion.percentageOfTotal}%</p>
                  <p className="text-muted-foreground text-xs">
                    ~{suggestion.typicalDurationDays} days
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline visualization */}
      {milestones.length > 0 && (
        <div className="rounded-lg border bg-slate-50 p-4">
          <h4 className="mb-3 text-sm font-medium">Project Timeline</h4>
          <div className="relative h-8">
            <div className="absolute inset-y-0 left-0 right-0 overflow-hidden rounded-full bg-slate-200">
              {milestones.map((milestone, index) => {
                const startPercent =
                  milestones.slice(0, index).reduce((sum, m) => sum + m.durationDays, 0) /
                  totalDuration;
                const widthPercent = milestone.durationDays / totalDuration;

                return (
                  <div
                    key={milestone.id}
                    className="absolute inset-y-0 flex items-center justify-center overflow-hidden text-xs font-medium text-white"
                    style={{
                      left: `${startPercent * 100}%`,
                      width: `${widthPercent * 100}%`,
                      backgroundColor: `hsl(${210 + index * 30}, 70%, 50%)`,
                    }}
                    title={`${milestone.title}: ${milestone.durationDays} days`}
                  >
                    {widthPercent > 0.15 && <span className="truncate px-1">{index + 1}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>Start</span>
            <span>{totalDuration} days</span>
          </div>
        </div>
      )}
    </div>
  );
}
