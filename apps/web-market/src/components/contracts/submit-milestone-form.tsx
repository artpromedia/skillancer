/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * SubmitMilestoneForm Component
 *
 * Form for freelancers to submit work for a milestone.
 * Includes message, file attachments, links, and deliverable checklist.
 */

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Checkbox,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { FileText, Link as LinkIcon, Loader2, Plus, Upload, X, CheckCircle2 } from 'lucide-react';
import { useCallback, useState, useRef } from 'react';

import type { Milestone, SubmitMilestoneData } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

export interface SubmitMilestoneFormProps {
  milestone: Milestone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SubmitMilestoneData) => Promise<void>;
  isSubmitting?: boolean;
  className?: string;
}

interface AttachmentPreview {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

interface LinkItem {
  id: string;
  url: string;
  title: string;
}

interface DeliverableItem {
  id: string;
  title: string;
  completed: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SubmitMilestoneForm({
  milestone,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  className,
}: Readonly<SubmitMilestoneFormProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>(
    () =>
      milestone.deliverables?.map((d, i) => ({
        id: `deliverable-${i}`,
        title: d,
        completed: false,
      })) ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setMessage('');
    setAttachments([]);
    setLinks([]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setDeliverables(
      milestone.deliverables?.map((d, i) => ({
        id: `deliverable-${i}`,
        title: d,
        completed: false,
      })) ?? []
    );
    setErrors({});
  }, [milestone.deliverables]);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newAttachments = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addLink = useCallback(() => {
    if (!newLinkUrl.trim()) return;

    // Basic URL validation
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    setLinks((prev) => [
      ...prev,
      {
        id: `link-${Date.now()}`,
        url,
        title: newLinkTitle.trim() || url,
      },
    ]);
    setNewLinkUrl('');
    setNewLinkTitle('');
  }, [newLinkUrl, newLinkTitle]);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const toggleDeliverable = useCallback((id: string) => {
    setDeliverables((prev) =>
      prev.map((d) => (d.id === id ? { ...d, completed: !d.completed } : d))
    );
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!message.trim()) {
      newErrors.message = 'Please provide a description of your work';
    }

    if (deliverables.length > 0) {
      const completedCount = deliverables.filter((d) => d.completed).length;
      if (completedCount === 0) {
        newErrors.deliverables = 'Please mark at least one deliverable as completed';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [message, deliverables]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    await onSubmit({
      message: message.trim(),
      attachments: attachments.map((a) => a.file),
      links: links.map((l) => l.url),
      deliverables: deliverables.map((d) => ({ id: d.id, completed: d.completed })),
    });

    handleClose();
  }, [validate, message, attachments, links, deliverables, onSubmit, handleClose]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-2xl', className)}>
        <DialogHeader>
          <DialogTitle>Submit Work for Review</DialogTitle>
          <DialogDescription>
            Submit your work for &quot;{milestone.title}&quot;. The client will review and approve
            to release payment.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-6 overflow-y-auto py-4">
          {/* Deliverables Checklist */}
          {deliverables.length > 0 && (
            <div className="space-y-3">
              <Label>Deliverables Checklist</Label>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {deliverables.map((deliverable) => (
                      <div key={deliverable.id} className="flex items-start gap-3">
                        <Checkbox
                          checked={deliverable.completed}
                          id={deliverable.id}
                          onCheckedChange={() => toggleDeliverable(deliverable.id)}
                        />
                        <label
                          className={cn(
                            'cursor-pointer text-sm',
                            deliverable.completed && 'text-muted-foreground line-through'
                          )}
                          htmlFor={deliverable.id}
                        >
                          {deliverable.title}
                        </label>
                      </div>
                    ))}
                  </div>
                  {errors.deliverables && (
                    <p className="mt-2 text-sm text-red-500">{errors.deliverables}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              Work Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Describe the work you've completed, any notes for the client, and next steps if applicable..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
              <input
                ref={fileInputRef}
                multiple
                accept="*/*"
                className="hidden"
                type="file"
                onChange={handleFileSelect}
              />
            </div>

            {attachments.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="bg-muted/50 flex items-center justify-between rounded-lg p-2"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="text-muted-foreground h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">{attachment.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatFileSize(attachment.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Links */}
          <div className="space-y-3">
            <Label>External Links</Label>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="URL (e.g., figma.com/file/...)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
              />
              <Input
                className="w-32"
                placeholder="Title (optional)"
                value={newLinkTitle}
                onChange={(e) => setNewLinkTitle(e.target.value)}
              />
              <Button
                disabled={!newLinkUrl.trim()}
                type="button"
                variant="outline"
                onClick={addLink}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {links.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className="bg-muted/50 flex items-center justify-between rounded-lg p-2"
                      >
                        <div className="flex items-center gap-2">
                          <LinkIcon className="text-muted-foreground h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">{link.title}</p>
                            <p className="text-muted-foreground truncate text-xs">{link.url}</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => removeLink(link.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isSubmitting} type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SubmitMilestoneForm;
