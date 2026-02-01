'use client';

/**
 * ConversationActions Component
 *
 * Dropdown menu with conversation management actions:
 * - Archive/unarchive
 * - Block/unblock user
 * - Pin/unpin conversation
 * - Mute/unmute notifications
 * - Search within conversation
 * - Report conversation
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  Textarea,
  cn,
} from '@skillancer/ui';
import {
  Archive,
  Ban,
  Bell,
  BellOff,
  Flag,
  MoreVertical,
  Pin,
  PinOff,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Conversation, Message } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

export interface ConversationActionsProps {
  /** The conversation to manage */
  readonly conversation: Conversation;
  /** Callback when archive action is triggered */
  readonly onArchive?: () => Promise<void>;
  /** Callback when block action is triggered */
  readonly onBlock?: () => Promise<void>;
  /** Callback when pin action is triggered */
  readonly onPin?: () => Promise<void>;
  /** Callback when mute action is triggered */
  readonly onMute?: () => Promise<void>;
  /** Callback when search action is triggered */
  readonly onSearch?: () => void;
  /** Callback when report action is triggered */
  readonly onReport?: (reason: string, details: string) => Promise<void>;
  /** Callback when delete conversation is triggered */
  readonly onDelete?: () => Promise<void>;
  /** Custom trigger button */
  readonly trigger?: React.ReactNode;
  /** Custom class name */
  readonly className?: string;
}

// ============================================================================
// Report Dialog
// ============================================================================

interface ReportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (reason: string, details: string) => Promise<void>;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({ open, onOpenChange, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;

    setIsSubmitting(true);
    try {
      await onSubmit(reason, details);
      onOpenChange(false);
      setReason('');
      setDetails('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Conversation</DialogTitle>
          <DialogDescription>
            Help us understand what&apos;s wrong. Your report will be reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for report</Label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <Button
                  key={r.value}
                  className={cn(
                    'justify-start',
                    reason === r.value && 'border-primary bg-primary/5'
                  )}
                  size="sm"
                  variant="outline"
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              className="min-h-[100px]"
              id="details"
              placeholder="Please provide any additional context that might help us investigate..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isSubmitting} variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={!reason || isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConversationActions({
  conversation,
  onArchive,
  onBlock,
  onPin,
  onMute,
  onSearch,
  onReport,
  onDelete,
  trigger,
  className,
}: ConversationActionsProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = useCallback(async (action: string, fn?: () => Promise<void>) => {
    if (!fn) return;

    setIsLoading(action);
    try {
      await fn();
    } finally {
      setIsLoading(null);
    }
  }, []);

  const handleReport = useCallback(
    async (reason: string, details: string) => {
      if (onReport) {
        await onReport(reason, details);
      }
    },
    [onReport]
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || (
            <Button className={className} size="icon" variant="ghost">
              <MoreVertical className="h-5 w-5" />
              <span className="sr-only">Conversation options</span>
            </Button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* Search */}
          {onSearch && (
            <DropdownMenuItem onClick={onSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search in conversation
            </DropdownMenuItem>
          )}

          {/* Pin/Unpin */}
          {onPin && (
            <DropdownMenuItem
              disabled={isLoading === 'pin'}
              onClick={() => void handleAction('pin', onPin)}
            >
              {conversation.isPinned ? (
                <>
                  <PinOff className="mr-2 h-4 w-4" />
                  Unpin conversation
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-4 w-4" />
                  Pin conversation
                </>
              )}
            </DropdownMenuItem>
          )}

          {/* Mute/Unmute */}
          {onMute && (
            <DropdownMenuItem
              disabled={isLoading === 'mute'}
              onClick={() => void handleAction('mute', onMute)}
            >
              {conversation.isMuted ? (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Unmute notifications
                </>
              ) : (
                <>
                  <BellOff className="mr-2 h-4 w-4" />
                  Mute notifications
                </>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Archive */}
          {onArchive && (
            <DropdownMenuItem
              disabled={isLoading === 'archive'}
              onClick={() => void handleAction('archive', onArchive)}
            >
              <Archive className="mr-2 h-4 w-4" />
              {conversation.status === 'ARCHIVED' ? 'Unarchive' : 'Archive conversation'}
            </DropdownMenuItem>
          )}

          {/* Block */}
          {onBlock && (
            <DropdownMenuItem
              className="text-amber-600 focus:text-amber-600"
              onClick={() => setShowBlockConfirm(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              {conversation.status === 'BLOCKED' ? 'Unblock user' : 'Block user'}
            </DropdownMenuItem>
          )}

          {/* Report */}
          {onReport && (
            <DropdownMenuItem
              className="text-amber-600 focus:text-amber-600"
              onClick={() => setShowReportDialog(true)}
            >
              <Flag className="mr-2 h-4 w-4" />
              Report conversation
            </DropdownMenuItem>
          )}

          {/* Delete */}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete conversation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report Dialog */}
      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSubmit={handleReport}
      />

      {/* Block Confirmation */}
      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conversation.status === 'BLOCKED' ? 'Unblock User?' : 'Block User?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversation.status === 'BLOCKED'
                ? 'This user will be able to send you messages again.'
                : "This user won't be able to send you messages. You can unblock them later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(conversation.status !== 'BLOCKED' && 'bg-amber-600 hover:bg-amber-700')}
              disabled={isLoading === 'block'}
              onClick={() => void handleAction('block', onBlock)}
            >
              {conversation.status === 'BLOCKED' ? 'Unblock' : 'Block'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all messages. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isLoading === 'delete'}
              onClick={() => void handleAction('delete', onDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Message Actions Component
// ============================================================================

export interface MessageActionsProps {
  /** The message to manage */
  readonly message: Message;
  /** Whether this is the current user's message */
  readonly isOwn: boolean;
  /** Time limit for editing in minutes (default: 15) */
  readonly editTimeLimit?: number;
  /** Callback when reply action is triggered */
  readonly onReply?: () => void;
  /** Callback when edit action is triggered */
  readonly onEdit?: (content: string) => Promise<void>;
  /** Callback when delete action is triggered */
  readonly onDelete?: () => Promise<void>;
  /** Callback when report action is triggered */
  readonly onReport?: (reason: string, details: string) => Promise<void>;
  /** Callback when copy action is triggered */
  readonly onCopy?: () => void;
  /** Custom class name */
  readonly className?: string;
}

/**
 * Check if a message can still be edited based on time limit
 */
function canEditMessage(message: Message, timeLimitMinutes: number): boolean {
  const messageTime = new Date(message.createdAt).getTime();
  const now = Date.now();
  const timeLimitMs = timeLimitMinutes * 60 * 1000;
  return now - messageTime < timeLimitMs;
}

export function MessageActions({
  message,
  isOwn,
  editTimeLimit = 15,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onCopy,
  className,
}: MessageActionsProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const canEdit = isOwn && onEdit && canEditMessage(message, editTimeLimit) && !message.isDeleted;

  const handleReport = useCallback(
    async (reason: string, details: string) => {
      if (onReport) {
        await onReport(reason, details);
      }
    },
    [onReport]
  );

  return (
    <>
      <div className={cn('flex items-center gap-0.5', className)}>
        {/* Reply */}
        {onReply && !message.isDeleted && (
          <Button className="h-7 w-7" size="icon" title="Reply" variant="ghost" onClick={onReply}>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M9 17l-5-5 5-5M4 12h16" />
            </svg>
          </Button>
        )}

        {/* Copy */}
        {onCopy && !message.isDeleted && (
          <Button className="h-7 w-7" size="icon" title="Copy" variant="ghost" onClick={onCopy}>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </Button>
        )}

        {/* Edit (own messages only, within time limit) */}
        {canEdit && (
          <Button
            className="h-7 w-7"
            size="icon"
            title={`Edit (${editTimeLimit}min limit)`}
            variant="ghost"
            onClick={() => {
              // This would trigger edit mode in the parent
              // For now, we'll handle this via the dropdown in MessageBubble
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Button>
        )}

        {/* Delete (own messages only) */}
        {isOwn && onDelete && !message.isDeleted && (
          <Button
            className="text-destructive hover:text-destructive h-7 w-7"
            size="icon"
            title="Delete"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {/* Report (other's messages only) */}
        {!isOwn && onReport && !message.isDeleted && (
          <Button
            className="h-7 w-7 text-amber-600 hover:text-amber-600"
            size="icon"
            title="Report"
            variant="ghost"
            onClick={() => setShowReportDialog(true)}
          >
            <Flag className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Report Dialog */}
      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSubmit={handleReport}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be deleted for everyone in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isLoading === 'delete'}
              onClick={() => {
                setIsLoading('delete');
                void (async () => {
                  try {
                    await onDelete?.();
                  } finally {
                    setIsLoading(null);
                    setShowDeleteConfirm(false);
                  }
                })();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
