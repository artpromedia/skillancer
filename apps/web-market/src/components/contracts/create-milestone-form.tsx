/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * CreateMilestoneForm Component
 *
 * Form for clients to add new milestones to a contract.
 * Includes title, description, amount, due date, and deliverables.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { Calendar, DollarSign, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { CreateMilestoneData } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

export interface CreateMilestoneFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateMilestoneData) => Promise<void>;
  isSubmitting?: boolean;
  contractTitle?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CreateMilestoneForm({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  contractTitle,
  className,
}: Readonly<CreateMilestoneFormProps>) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setAmount('');
    setDueDate('');
    setDeliverables(['']);
    setErrors({});
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const addDeliverable = useCallback(() => {
    setDeliverables((prev) => [...prev, '']);
  }, []);

  const updateDeliverable = useCallback((index: number, value: string) => {
    setDeliverables((prev) => prev.map((d, i) => (i === index ? value : d)));
  }, []);

  const removeDeliverable = useCallback((index: number) => {
    setDeliverables((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    const amountNum = Number.parseFloat(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < new Date()) {
        newErrors.dueDate = 'Due date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, amount, dueDate]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    const filteredDeliverables = deliverables.filter((d) => d.trim());

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      amount: Number.parseFloat(amount),
      dueDate: dueDate || undefined,
      deliverables: filteredDeliverables.length > 0 ? filteredDeliverables : undefined,
    });

    handleClose();
  }, [validate, deliverables, title, description, amount, dueDate, onSubmit, handleClose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>Add New Milestone</DialogTitle>
          <DialogDescription>
            {contractTitle
              ? `Create a milestone for "${contractTitle}"`
              : 'Define the milestone details including deliverables and payment amount.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Design Phase Completion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this milestone includes..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Amount and Due Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  id="amount"
                  placeholder="0.00"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <div className="relative">
                <Calendar className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              {errors.dueDate && <p className="text-sm text-red-500">{errors.dueDate}</p>}
            </div>
          </div>

          {/* Deliverables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Deliverables</Label>
              <Button size="sm" type="button" variant="ghost" onClick={addDeliverable}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {deliverables.map((deliverable, index) => (
                <div
                  key={`deliverable-${index}-${deliverable.slice(0, 10)}`}
                  className="flex gap-2"
                >
                  <Input
                    placeholder={`Deliverable ${index + 1}`}
                    value={deliverable}
                    onChange={(e) => updateDeliverable(index, e.target.value)}
                  />
                  {deliverables.length > 1 && (
                    <Button
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => removeDeliverable(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Optional: List specific items to be delivered for this milestone
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isSubmitting} type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateMilestoneForm;
