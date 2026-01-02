'use client';

import { cn } from '@skillancer/ui';
import Image from 'next/image';
import Link from 'next/link';

export interface LogoProps {
  /** White version for dark backgrounds */
  variant?: 'default' | 'white';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Show clickable link to home */
  asLink?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
};

/**
 * Skillancer Logo Component
 *
 * @example
 * <Logo />                           // Light background
 * <Logo variant="white" />           // Dark background
 * <Logo size="lg" asLink />          // Large, clickable
 */
export function Logo({ variant = 'default', size = 'md', asLink = true, className }: LogoProps) {
  const src =
    variant === 'white'
      ? '/assets/logo/svg/skillancer-logo-white.svg'
      : '/assets/logo/svg/skillancer-logo-paths.svg';

  const logo = (
    <Image
      priority
      alt="Skillancer"
      className={cn(sizeClasses[size], 'w-auto', className)}
      height={48}
      src={src}
      width={205}
    />
  );

  if (asLink) {
    return (
      <Link aria-label="Skillancer Home" className="flex items-center" href="/">
        {logo}
      </Link>
    );
  }

  return logo;
}

/**
 * Skillancer Icon Component (just the checkmark)
 */
export function LogoIcon({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <Image
      alt="Skillancer"
      className={cn(iconSizes[size], className)}
      height={48}
      src="/assets/logo/svg/skillancer-icon-checkmark.svg"
      width={48}
    />
  );
}
