import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary - Green (Main CTAs: Post a Job, Hire Now, Get Started)
        default:
          'bg-emerald-500 text-white hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)] focus-visible:ring-emerald-500',
        // Secondary - Blue (Sign Up, Learn More, View Profile)
        secondary:
          'bg-blue-500 text-white hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)] focus-visible:ring-blue-500',
        // Outline (Log In, Cancel, View All)
        outline:
          'border border-slate-200 bg-transparent text-slate-900 hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-blue-500',
        // Ghost - Blue text (subtle actions)
        ghost: 'text-blue-500 hover:bg-blue-50 focus-visible:ring-blue-500',
        // Destructive - Red
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
        // Link style
        link: 'text-blue-500 underline-offset-4 hover:underline focus-visible:ring-blue-500',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-9 rounded-md px-4 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
