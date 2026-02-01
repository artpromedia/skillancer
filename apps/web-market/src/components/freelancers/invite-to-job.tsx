/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * Invite to Job Components
 *
 * Quick invite button and dialog for inviting freelancers to jobs.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  Textarea,
  cn,
} from '@skillancer/ui';
import { Briefcase, Check, ChevronDown, Loader2, Send } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useInviteToJob, type ClientJob } from '@/hooks/use-freelancer-search';

// ============================================================================
// Types
// ============================================================================

interface InviteToJobButtonProps {
  freelancerId: string;
  freelancerName: string;
  /** Client's active jobs to show in dropdown */
  activeJobs?: ClientJob[];
  /** Loading state for jobs */
  isLoadingJobs?: boolean;
  /** Variant of the button */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Size of the button */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional class names */
  className?: string;
  /** Callback when invite is sent */
  onInviteSent?: (jobId: string) => void;
}

interface InviteDialogProps {
  freelancerId: string;
  freelancerName: string;
  job: ClientJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Invite Dialog
// ============================================================================

function InviteDialog({
  freelancerId,
  freelancerName,
  job,
  open,
  onOpenChange,
  onSuccess,
}: Readonly<InviteDialogProps>) {
  const [message, setMessage] = useState('');
  const { invite, isLoading, isSuccess, error, reset } = useInviteToJob();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      invite(
        {
          freelancerId,
          jobId: job.id,
          message: message || undefined,
        },
        {
          onSuccess: () => {
            toast.success(`Invite sent to ${freelancerName}`);
            onSuccess?.();
            onOpenChange(false);
            setMessage('');
            reset();
          },
          onError: (err) => {
            toast.error(err.message || 'Failed to send invite');
          },
        }
      );
    },
    [freelancerId, job.id, message, freelancerName, invite, onSuccess, onOpenChange, reset]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setMessage('');
    reset();
  }, [onOpenChange, reset]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Job</DialogTitle>
          <DialogDescription>
            Send an invite to <strong>{freelancerName}</strong> for your job posting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Job Info */}
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{job.title}</p>
              <p className="text-muted-foreground text-xs">
                {job.proposalCount} proposal{job.proposalCount === 1 ? '' : 's'} received
              </p>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="invite-message">
                Personal message <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                className="min-h-[100px] resize-none"
                disabled={isLoading}
                id="invite-message"
                placeholder={`Hi ${freelancerName}, I came across your profile and think you'd be a great fit for this project...`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Add a personal touch to increase response rates
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error.message}
              </div>
            )}

            {/* Success */}
            {isSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-600">
                <Check className="h-4 w-4" />
                Invite sent successfully!
              </div>
            )}
          </div>

          <DialogFooter>
            <Button disabled={isLoading} type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button disabled={isLoading || isSuccess} type="submit">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Quick Invite Button
// ============================================================================

export function InviteToJobButton({
  freelancerId,
  freelancerName,
  activeJobs = [],
  isLoadingJobs = false,
  variant = 'outline',
  size = 'sm',
  className,
  onInviteSent,
}: Readonly<InviteToJobButtonProps>) {
  const [selectedJob, setSelectedJob] = useState<ClientJob | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleJobSelect = useCallback((job: ClientJob) => {
    setSelectedJob(job);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    if (selectedJob) {
      onInviteSent?.(selectedJob.id);
    }
    setSelectedJob(null);
  }, [selectedJob, onInviteSent]);

  // If no active jobs, show disabled button
  if (!isLoadingJobs && activeJobs.length === 0) {
    return (
      <Button
        disabled
        className={cn('gap-1.5', className)}
        size={size}
        title="Post a job first to invite freelancers"
        variant={variant}
      >
        <Briefcase className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Invite</span>
      </Button>
    );
  }

  // Single job - direct action
  if (activeJobs.length === 1) {
    return (
      <>
        <Button
          className={cn('gap-1.5', className)}
          disabled={isLoadingJobs}
          size={size}
          variant={variant}
          onClick={() => handleJobSelect(activeJobs[0])}
        >
          {isLoadingJobs ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Briefcase className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Invite</span>
        </Button>

        {selectedJob && (
          <InviteDialog
            freelancerId={freelancerId}
            freelancerName={freelancerName}
            job={selectedJob}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSuccess={handleSuccess}
          />
        )}
      </>
    );
  }

  // Multiple jobs - dropdown
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn('gap-1.5', className)}
            disabled={isLoadingJobs}
            size={size}
            variant={variant}
          >
            {isLoadingJobs ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Briefcase className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Invite</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            Select a job to invite to
          </div>
          {activeJobs.map((job) => (
            <DropdownMenuItem
              key={job.id}
              className="flex flex-col items-start gap-0.5"
              onClick={() => handleJobSelect(job)}
            >
              <span className="line-clamp-1 font-medium">{job.title}</span>
              <span className="text-muted-foreground text-xs">
                {job.proposalCount} proposal{job.proposalCount === 1 ? '' : 's'}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedJob && (
        <InviteDialog
          freelancerId={freelancerId}
          freelancerName={freelancerName}
          job={selectedJob}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

// ============================================================================
// Compact Invite Button (for cards)
// ============================================================================

export function InviteToJobIconButton({
  freelancerId,
  freelancerName,
  activeJobs = [],
  isLoadingJobs = false,
  className,
  onInviteSent,
}: Readonly<Omit<InviteToJobButtonProps, 'variant' | 'size'>>) {
  return (
    <InviteToJobButton
      activeJobs={activeJobs}
      className={className}
      freelancerId={freelancerId}
      freelancerName={freelancerName}
      isLoadingJobs={isLoadingJobs}
      size="icon"
      variant="ghost"
      onInviteSent={onInviteSent}
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export type { InviteToJobButtonProps };
export type { ClientJob } from '@/hooks/use-freelancer-search';
