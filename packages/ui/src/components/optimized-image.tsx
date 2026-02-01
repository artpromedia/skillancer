'use client';

import * as React from 'react';
import Image, { type ImageProps } from 'next/image';
import { cn } from '../lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface OptimizedImageProps extends Omit<ImageProps, 'onLoad' | 'onError'> {
  /** Fallback image URL */
  fallback?: string;
  /** Aspect ratio (e.g., '16/9', '1/1', '4/3') */
  aspectRatio?: string;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Low quality image placeholder (LQIP) */
  lqip?: string;
  /** Lazy load the image */
  lazy?: boolean;
  /** Image fit mode */
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Border radius variant */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** On load callback */
  onLoadComplete?: () => void;
  /** On error callback */
  onErrorCapture?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_FALLBACK = '/images/placeholder.svg';

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

const fitClasses = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
} as const;

// =============================================================================
// OPTIMIZED IMAGE COMPONENT
// =============================================================================

/**
 * Optimized image component with lazy loading, fallback, and skeleton support
 *
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/hero.jpg"
 *   alt="Hero image"
 *   width={1200}
 *   height={600}
 *   priority
 * />
 *
 * // With aspect ratio
 * <OptimizedImage
 *   src="/product.jpg"
 *   alt="Product"
 *   aspectRatio="4/3"
 *   showSkeleton
 *   lazy
 * />
 * ```
 */
export const OptimizedImage = React.forwardRef<HTMLDivElement, OptimizedImageProps>(
  (
    {
      src,
      alt,
      fallback = DEFAULT_FALLBACK,
      aspectRatio,
      showSkeleton = true,
      lqip,
      lazy = true,
      fit = 'cover',
      rounded = 'md',
      className,
      onLoadComplete,
      onErrorCapture,
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Transforming deprecated priority to loading='eager'
      priority,
      ...props
    },
    ref
  ) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const [imageSrc, setImageSrc] = React.useState(src);

    // Reset state when src changes
    React.useEffect(() => {
      setImageSrc(src);
      setHasError(false);
      setIsLoading(true);
    }, [src]);

    const handleLoad = React.useCallback(() => {
      setIsLoading(false);
      onLoadComplete?.();
    }, [onLoadComplete]);

    const handleError = React.useCallback(() => {
      setHasError(true);
      setIsLoading(false);
      setImageSrc(fallback);
      onErrorCapture?.();
    }, [fallback, onErrorCapture]);

    const containerStyle: React.CSSProperties = aspectRatio ? { aspectRatio } : {};

    return (
      <div
        ref={ref}
        className={cn('bg-muted relative overflow-hidden', roundedClasses[rounded], className)}
        style={containerStyle}
      >
        {/* Loading skeleton */}
        {showSkeleton && isLoading && (
          <div className={cn('bg-muted absolute inset-0 animate-pulse', roundedClasses[rounded])} />
        )}

        {/* Low quality placeholder */}
        {lqip && isLoading && (
          <Image
            src={lqip}
            alt=""
            fill
            className={cn(
              'absolute inset-0 scale-110 blur-lg',
              fitClasses[fit],
              roundedClasses[rounded]
            )}
            aria-hidden="true"
          />
        )}

        {/* Main image */}
        <Image
          src={hasError ? fallback : imageSrc}
          alt={alt}
          className={cn(
            'transition-opacity duration-300',
            fitClasses[fit],
            roundedClasses[rounded],
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          loading={(() => {
            if (priority) return 'eager';
            if (lazy) return 'lazy';
            return undefined;
          })()}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

// =============================================================================
// AVATAR IMAGE
// =============================================================================

export interface AvatarImageProps extends Omit<OptimizedImageProps, 'aspectRatio'> {
  /** Size in pixels */
  size?: number;
  /** User name for fallback initials */
  name?: string;
}

/**
 * Optimized avatar image with fallback initials
 */
export const AvatarImage = React.forwardRef<HTMLDivElement, AvatarImageProps>(
  ({ src, alt, size = 40, name, className, ...props }, ref) => {
    const [showFallback, setShowFallback] = React.useState(!src);

    // Get initials from name
    const initials = React.useMemo(() => {
      if (!name) return '?';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        const lastPart = parts.at(-1);
        return `${parts[0][0]}${lastPart?.[0] ?? ''}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }, [name]);

    if (showFallback || !src) {
      return (
        <div
          ref={ref}
          className={cn(
            'bg-primary text-primary-foreground flex items-center justify-center rounded-full font-medium',
            className
          )}
          style={{ width: size, height: size, fontSize: size * 0.4 }}
          aria-label={alt || name}
        >
          {initials}
        </div>
      );
    }

    return (
      <OptimizedImage
        ref={ref}
        src={src}
        alt={alt || name || 'Avatar'}
        width={size}
        height={size}
        rounded="full"
        fit="cover"
        className={className}
        onErrorCapture={() => setShowFallback(true)}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = 'AvatarImage';

// =============================================================================
// BACKGROUND IMAGE
// =============================================================================

export interface BackgroundImageProps {
  /** Image source */
  readonly src: string;
  /** Alternative text */
  readonly alt?: string;
  /** Children to render over the background */
  readonly children?: React.ReactNode;
  /** Overlay color (with opacity) */
  readonly overlay?: string;
  /** Image position */
  readonly position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  /** Additional container classes */
  readonly className?: string;
  /** Parallax effect */
  readonly parallax?: boolean;
  /** Priority loading */
  readonly priority?: boolean;
}

/**
 * Background image component with overlay support
 */
export function BackgroundImage({
  src,
  alt = '',
  children,
  overlay,
  position = 'center',
  className,
  parallax = false,
  priority = false,
}: BackgroundImageProps) {
  const positionClasses = {
    center: 'object-center',
    top: 'object-top',
    bottom: 'object-bottom',
    left: 'object-left',
    right: 'object-right',
  };

  return (
    <div className={cn('relative overflow-hidden', parallax && 'bg-fixed', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        className={cn('-z-10 object-cover', positionClasses[position], parallax && 'transform-gpu')}
        priority={priority}
      />

      {/* Overlay */}
      {overlay && <div className="-z-5 absolute inset-0" style={{ backgroundColor: overlay }} />}

      {/* Content */}
      {children}
    </div>
  );
}

// =============================================================================
// IMAGE GALLERY
// =============================================================================

export interface ImageGalleryProps {
  /** Array of image sources */
  readonly images: ReadonlyArray<{
    readonly src: string;
    readonly alt: string;
    readonly width?: number;
    readonly height?: number;
  }>;
  /** Number of columns */
  readonly columns?: 2 | 3 | 4;
  /** Gap between images */
  readonly gap?: 'sm' | 'md' | 'lg';
  /** Aspect ratio for all images */
  readonly aspectRatio?: string;
  /** On image click */
  readonly onImageClick?: (index: number) => void;
  /** Additional classes */
  readonly className?: string;
}

/**
 * Responsive image gallery with lazy loading
 */
export function ImageGallery({
  images,
  columns = 3,
  gap = 'md',
  aspectRatio = '1/1',
  onImageClick,
  className,
}: ImageGalleryProps) {
  const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  };

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div className={cn('grid', columnClasses[columns], gapClasses[gap], className)}>
      {images.map((image, index) => (
        <button
          key={`${image.src}-${index}`}
          type="button"
          className={cn(
            'relative overflow-hidden rounded-lg transition-transform hover:scale-[1.02]',
            onImageClick && 'cursor-pointer'
          )}
          onClick={() => onImageClick?.(index)}
          disabled={!onImageClick}
        >
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            width={image.width || 400}
            height={image.height || 400}
            aspectRatio={aspectRatio}
            lazy
            showSkeleton
          />
        </button>
      ))}
    </div>
  );
}

export default {
  OptimizedImage,
  AvatarImage,
  BackgroundImage,
  ImageGallery,
};
