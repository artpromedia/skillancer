'use client';

/**
 * ReadReceipts Component
 *
 * Displays read receipt status for messages with detailed viewer information.
 */

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@skillancer/ui';
import { Check, CheckCheck, Clock, X } from 'lucide-react';

import type { MessageStatus } from '@/lib/api/messages';

// ============================================================================
// Types
// ============================================================================

export interface ReadReceiptUser {
  userId: string;
  userName: string;
  avatar?: string;
  readAt: string;
}

export interface ReadReceiptsProps {
  /** Message status */
  readonly status: MessageStatus;
  /** Users who have read the message (for detailed view) */
  readonly readers?: ReadReceiptUser[];
  /** Whether this is the current user's message */
  readonly isOwn?: boolean;
  /** Custom class name */
  readonly className?: string;
  /** Variant style */
  readonly variant?: 'icon' | 'detailed' | 'avatars';
  /** Show timestamp */
  readonly showTimestamp?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: MessageStatus): string {
  switch (status) {
    case 'SENDING':
      return 'text-muted-foreground';
    case 'SENT':
      return 'text-muted-foreground';
    case 'DELIVERED':
      return 'text-muted-foreground';
    case 'READ':
      return 'text-blue-500';
    case 'FAILED':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

function getStatusLabel(status: MessageStatus): string {
  switch (status) {
    case 'SENDING':
      return 'Sending...';
    case 'SENT':
      return 'Sent';
    case 'DELIVERED':
      return 'Delivered';
    case 'READ':
      return 'Read';
    case 'FAILED':
      return 'Failed to send';
    default:
      return '';
  }
}

function formatReadTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Format as date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================================================
// Status Icon Component
// ============================================================================

interface StatusIconProps {
  readonly status: MessageStatus;
  readonly className?: string;
}

export function StatusIcon({ status, className }: StatusIconProps) {
  const colorClass = getStatusColor(status);

  switch (status) {
    case 'SENDING':
      return <Clock className={cn('h-3 w-3 animate-pulse', colorClass, className)} />;
    case 'SENT':
      return <Check className={cn('h-3 w-3', colorClass, className)} />;
    case 'DELIVERED':
      return <CheckCheck className={cn('h-3 w-3', colorClass, className)} />;
    case 'READ':
      return <CheckCheck className={cn('h-3 w-3', colorClass, className)} />;
    case 'FAILED':
      return <X className={cn('h-3 w-3', colorClass, className)} />;
    default:
      return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ReadReceipts({
  status,
  readers = [],
  isOwn = true,
  className,
  variant = 'icon',
  showTimestamp = false,
}: ReadReceiptsProps) {
  // Only show receipts for own messages
  if (!isOwn) return null;

  const label = getStatusLabel(status);
  const colorClass = getStatusColor(status);

  // Icon only variant
  if (variant === 'icon') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center', className)}>
            <StatusIcon status={status} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <span>{label}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Detailed variant with text
  if (variant === 'detailed') {
    return (
      <div className={cn('flex items-center gap-1 text-xs', colorClass, className)}>
        <StatusIcon status={status} />
        <span>{label}</span>
        {showTimestamp && readers.length > 0 && status === 'READ' && (
          <span className="text-muted-foreground">
            · {formatReadTime(readers[0]?.readAt || '')}
          </span>
        )}
      </div>
    );
  }

  // Avatars variant (for group chats showing who read)
  if (variant === 'avatars' && readers.length > 0) {
    const displayReaders = readers.slice(0, 5);
    const remaining = readers.length - 5;

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <StatusIcon className="mr-1" status={status} />
        <div className="flex -space-x-2">
          {displayReaders.map((reader) => (
            <Tooltip key={reader.userId}>
              <TooltipTrigger asChild>
                <Avatar className="h-4 w-4 border-2 border-white dark:border-gray-900">
                  <AvatarImage alt={reader.userName} src={reader.avatar} />
                  <AvatarFallback className="text-[8px]">
                    {reader.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <span>Read by {reader.userName}</span>
                <br />
                <span className="text-muted-foreground text-xs">
                  {formatReadTime(reader.readAt)}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
          {remaining > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[8px] font-medium dark:border-gray-900 dark:bg-gray-700">
                  +{remaining}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <span>And {remaining} more</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  // Fallback to icon
  return (
    <span className={cn('inline-flex items-center', className)}>
      <StatusIcon status={status} />
    </span>
  );
}

// ============================================================================
// Compact Read Receipt (for message list)
// ============================================================================

export interface CompactReadReceiptProps {
  readonly status: MessageStatus;
  readonly className?: string;
}

export function CompactReadReceipt({ status, className }: CompactReadReceiptProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <StatusIcon status={status} />
    </span>
  );
}
