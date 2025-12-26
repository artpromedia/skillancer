/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import { cn } from '../lib/utils';

import type * as React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date?: string | Date;
  icon?: React.ReactNode;
  status?: 'complete' | 'current' | 'upcoming' | 'error';
  content?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
  variant?: 'default' | 'compact' | 'detailed';
  showConnector?: boolean;
  className?: string;
}

// ============================================================================
// Timeline Component
// ============================================================================

export function Timeline({
  items,
  orientation = 'vertical',
  variant = 'default',
  showConnector = true,
  className,
}: TimelineProps) {
  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusStyles = (status: TimelineItem['status']) => {
    switch (status) {
      case 'complete':
        return {
          dot: 'bg-green-500 border-green-200',
          line: 'bg-green-500',
          text: 'text-green-600',
        };
      case 'current':
        return {
          dot: 'bg-primary border-primary/20 ring-4 ring-primary/20',
          line: 'bg-muted',
          text: 'text-foreground',
        };
      case 'error':
        return {
          dot: 'bg-red-500 border-red-200',
          line: 'bg-red-500',
          text: 'text-red-600',
        };
      case 'upcoming':
      default:
        return {
          dot: 'bg-muted border-muted',
          line: 'bg-muted',
          text: 'text-muted-foreground',
        };
    }
  };

  // Vertical timeline
  if (orientation === 'vertical') {
    return (
      <div className={cn('relative', className)}>
        {items.map((item, index) => {
          const styles = getStatusStyles(item.status);
          const isLast = index === items.length - 1;

          return (
            <div key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Connector line */}
              {showConnector && !isLast && (
                <div
                  className={cn(
                    'absolute left-[11px] top-6 h-[calc(100%-24px)] w-0.5',
                    styles.line
                  )}
                />
              )}

              {/* Dot */}
              <div
                className={cn(
                  'relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
                  styles.dot
                )}
              >
                {item.icon && <span className="text-white">{item.icon}</span>}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('font-medium', styles.text)}>{item.title}</p>
                  {item.date && (
                    <span className="text-muted-foreground text-xs">{formatDate(item.date)}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
                )}
                {item.content && <div className="mt-2">{item.content}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal timeline
  return (
    <div className={cn('flex w-full items-start', className)}>
      {items.map((item, index) => {
        const styles = getStatusStyles(item.status);
        const isLast = index === items.length - 1;

        return (
          <div key={item.id} className="flex flex-1 flex-col items-center">
            {/* Top content */}
            <div className="mb-2 text-center">
              {item.date && (
                <p className="text-muted-foreground text-xs">{formatDate(item.date)}</p>
              )}
            </div>

            {/* Dot and connectors */}
            <div className="flex w-full items-center">
              {index > 0 && showConnector && (
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    items[index - 1].status === 'complete' ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
              <div
                className={cn(
                  'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
                  styles.dot
                )}
              >
                {item.icon && <span className="text-white">{item.icon}</span>}
              </div>
              {!isLast && showConnector && (
                <div
                  className={cn(
                    'h-0.5 flex-1',
                    item.status === 'complete' ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>

            {/* Bottom content */}
            <div className="mt-2 text-center">
              <p className={cn('text-sm font-medium', styles.text)}>{item.title}</p>
              {item.description && variant === 'detailed' && (
                <p className="text-muted-foreground mt-1 text-xs">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TimelineItem Component (for custom composition)
// ============================================================================

export interface TimelineItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  status?: 'complete' | 'current' | 'upcoming' | 'error';
  isLast?: boolean;
  className?: string;
}

export function TimelineItemComponent({
  children,
  icon,
  status = 'upcoming',
  isLast = false,
  className,
}: TimelineItemProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'complete':
        return {
          dot: 'bg-green-500 border-green-200',
          line: 'bg-green-500',
        };
      case 'current':
        return {
          dot: 'bg-primary border-primary/20 ring-4 ring-primary/20',
          line: 'bg-muted',
        };
      case 'error':
        return {
          dot: 'bg-red-500 border-red-200',
          line: 'bg-red-500',
        };
      default:
        return {
          dot: 'bg-muted border-muted',
          line: 'bg-muted',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div className={cn('relative flex gap-4 pb-8 last:pb-0', className)}>
      {!isLast && (
        <div className={cn('absolute left-[11px] top-6 h-[calc(100%-24px)] w-0.5', styles.line)} />
      )}
      <div
        className={cn(
          'relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
          styles.dot
        )}
      >
        {icon && <span className="text-white">{icon}</span>}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}
