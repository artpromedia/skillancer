import * as React from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button, type ButtonProps } from './button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Icon to display (defaults to Inbox)
   */
  icon?: React.ReactNode;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Primary action button text
   */
  actionLabel?: string;
  /**
   * Primary action click handler
   */
  onAction?: () => void;
  /**
   * Primary action button props
   */
  actionProps?: ButtonProps;
  /**
   * Secondary action element
   */
  secondaryAction?: React.ReactNode;
}

/**
 * Empty state placeholder with icon, title, description, and optional action
 * 
 * @example
 * <EmptyState
 *   icon={<FileX className="h-12 w-12" />}
 *   title="No projects found"
 *   description="Get started by creating your first project."
 *   actionLabel="Create Project"
 *   onAction={() => router.push('/new')}
 * />
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      title,
      description,
      actionLabel,
      onAction,
      actionProps,
      secondaryAction,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center py-12 px-4 text-center',
          className
        )}
        {...props}
      >
        <div className="mb-4 text-muted-foreground">
          {icon || <Inbox className="h-12 w-12" />}
        </div>
        <h3 className="mb-1 text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {actionLabel && onAction && (
          <Button onClick={onAction} {...actionProps}>
            {actionLabel}
          </Button>
        )}
        {secondaryAction && (
          <div className="mt-2">{secondaryAction}</div>
        )}
      </div>
    );
  }
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
