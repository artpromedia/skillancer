'use client';

/**
 * TypingIndicator Component
 *
 * Displays a typing indicator when other users are typing in the conversation.
 * Shows animated dots and user names.
 */

import { cn } from '@skillancer/ui';

import type { TypingUser } from '@/hooks/useRealtimeMessages';

// ============================================================================
// Types
// ============================================================================

export interface TypingIndicatorProps {
  /** Array of users currently typing */
  readonly users: TypingUser[];
  /** Custom class name */
  readonly className?: string;
  /** Variant style */
  readonly variant?: 'default' | 'compact' | 'inline';
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTypingText(users: TypingUser[]): string {
  if (users.length === 0) return '';

  const firstUser = users[0];
  if (!firstUser) return '';

  if (users.length === 1) {
    return `${firstUser.userName} is typing`;
  }

  const secondUser = users[1];
  if (users.length === 2 && secondUser) {
    return `${firstUser.userName} and ${secondUser.userName} are typing`;
  }

  return `${firstUser.userName} and ${users.length - 1} others are typing`;
}

// ============================================================================
// Animated Dots Component
// ============================================================================

interface AnimatedDotsProps {
  readonly className?: string;
  readonly dotClassName?: string;
}

function AnimatedDots({ className, dotClassName }: AnimatedDotsProps) {
  return (
    <div className={cn('flex space-x-1', className)}>
      <span
        className={cn('bg-muted-foreground h-2 w-2 animate-bounce rounded-full', dotClassName)}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={cn('bg-muted-foreground h-2 w-2 animate-bounce rounded-full', dotClassName)}
        style={{ animationDelay: '150ms' }}
      />
      <span
        className={cn('bg-muted-foreground h-2 w-2 animate-bounce rounded-full', dotClassName)}
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TypingIndicator({ users, className, variant = 'default' }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text = getTypingText(users);

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-1.5 text-sm', className)}>
        <AnimatedDots dotClassName="h-1.5 w-1.5" />
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs', className)}
      >
        <AnimatedDots dotClassName="h-1 w-1" />
        <span>{text}...</span>
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2', className)}>
      <AnimatedDots />
      <span className="text-muted-foreground text-sm">{text}...</span>
    </div>
  );
}

// ============================================================================
// Bubble Variant (for message list)
// ============================================================================

export interface TypingBubbleProps {
  /** Array of users currently typing */
  readonly users: TypingUser[];
  /** Custom class name */
  readonly className?: string;
}

export function TypingBubble({ users, className }: TypingBubbleProps) {
  if (users.length === 0) return null;

  const firstUser = users[0];

  return (
    <div className={cn('flex items-end gap-2', className)}>
      {/* Avatar placeholder */}
      <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
        {firstUser?.userName.charAt(0).toUpperCase()}
      </div>

      {/* Typing bubble */}
      <div className="bg-muted flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
        <AnimatedDots />
      </div>
    </div>
  );
}
