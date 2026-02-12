import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { cn } from '../lib/utils';

export interface SkillancerCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Card title
   */
  title?: string;
  /**
   * Card description shown below title
   */
  description?: string;
  /**
   * Actions to show in the header (e.g., buttons, dropdown)
   */
  actions?: React.ReactNode;
  /**
   * Card content
   */
  children: React.ReactNode;
  /**
   * Remove default padding
   */
  noPadding?: boolean;
  /**
   * Add hover effect
   */
  hoverable?: boolean;
}

/**
 * Branded card component with optional header actions
 *
 * @example
 * <SkillancerCard
 *   title="Overview"
 *   description="Your account summary"
 *   actions={<Button variant="outline" size="sm">Edit</Button>}
 * >
 *   <p>Card content here</p>
 * </SkillancerCard>
 */
const SkillancerCard = React.forwardRef<HTMLDivElement, SkillancerCardProps>(
  (
    {
      title,
      description,
      actions,
      children,
      className,
      noPadding = false,
      hoverable = false,
      ...props
    },
    ref
  ) => {
    const hasHeader = title || description || actions;

    return (
      <Card
        ref={ref}
        className={cn(
          'shadow-skillancer',
          hoverable && 'hover:shadow-skillancer-lg cursor-pointer transition-shadow',
          className
        )}
        {...props}
      >
        {hasHeader && (
          <CardHeader
            className={cn(
              'flex flex-row items-start justify-between space-y-0',
              !title && !description && 'pb-0'
            )}
          >
            <div className="space-y-1.5">
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </CardHeader>
        )}
        <CardContent className={cn(noPadding && 'p-0', !hasHeader && 'pt-6')}>
          {children}
        </CardContent>
      </Card>
    );
  }
);
SkillancerCard.displayName = 'SkillancerCard';

export { SkillancerCard };
