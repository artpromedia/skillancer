import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

import type * as React from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Default - Emerald green (matches primary)
        default: 'border-transparent bg-emerald-500 text-white',
        // Secondary - Blue
        secondary: 'border-transparent bg-blue-500 text-white',
        // Destructive - Red
        destructive: 'border-transparent bg-red-500 text-white',
        // Outline - Subtle border
        outline: 'border-slate-200 bg-transparent text-slate-700',
        // Success - Green with light background
        success: 'border-transparent bg-emerald-100 text-emerald-700',
        // Warning - Amber with light background
        warning: 'border-transparent bg-amber-100 text-amber-700',
        // Info - Blue with light background
        info: 'border-transparent bg-blue-100 text-blue-700',
        // Error - Red with light background
        error: 'border-transparent bg-red-100 text-red-700',
        // Skill tag style
        skill: 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
