import Image, { type ImageProps } from 'next/image';
import { useState, useCallback } from 'react';

/**
 * Optimized image component with lazy loading, blur placeholder, and format optimization
 */

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  fallbackSrc?: string;
  aspectRatio?: number;
  enableBlur?: boolean;
}

// Default blur placeholder (1x1 transparent pixel)
const BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.png',
  aspectRatio,
  enableBlur = true,
  className,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    setImgSrc(fallbackSrc);
  }, [fallbackSrc]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className || ''}`}
      style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
    >
      <Image
        alt={alt}
        blurDataURL={enableBlur ? BLUR_DATA_URL : undefined}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        placeholder={enableBlur ? 'blur' : 'empty'}
        src={imgSrc}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
}

/**
 * Avatar image with automatic sizing and fallback
 */
interface AvatarImageProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function AvatarImage({ src, alt, size = 'md', className }: AvatarImageProps) {
  const pixelSize = avatarSizes[size];
  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 ${className || ''}`}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <span style={{ fontSize: pixelSize * 0.4 }}>{initials}</span>
      </div>
    );
  }

  return (
    <OptimizedImage
      alt={alt}
      className={`rounded-full ${className || ''}`}
      height={pixelSize}
      sizes={`${pixelSize}px`}
      src={src}
      width={pixelSize}
    />
  );
}

/**
 * Responsive image sizes configuration for common layouts
 */
export const responsiveSizes = {
  // Full-width hero images
  hero: '100vw',
  // Card thumbnails (3 columns on desktop, 2 on tablet, 1 on mobile)
  cardThumbnail: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  // Profile images
  profile: '(max-width: 640px) 128px, 256px',
  // Gallery images (4 columns on desktop)
  gallery: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
};

/**
 * Generate blur placeholder from image URL
 */
export async function generateBlurPlaceholder(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(`/api/images/blur?url=${encodeURIComponent(imageUrl)}`);
    if (response.ok) {
      const data = (await response.json()) as { blurDataURL: string };
      return data.blurDataURL;
    }
  } catch (error) {
    console.error('Failed to generate blur placeholder:', error);
  }
  return BLUR_DATA_URL;
}

/**
 * Image loader for external URLs (CDN, S3, etc.)
 */
export function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // For Cloudinary URLs
  if (src.includes('cloudinary.com')) {
    const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality || 'auto'}`];
    return src.replace('/upload/', `/upload/${params.join(',')}/`);
  }

  // For S3/CloudFront URLs with image optimization
  if (src.includes('amazonaws.com') || src.includes('cloudfront.net')) {
    const params = new URLSearchParams({
      width: width.toString(),
      quality: (quality || 80).toString(),
      format: 'webp',
    });
    return `${src}?${params.toString()}`;
  }

  return src;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, priority: 'high' | 'low' = 'high') {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = priority;
  document.head.appendChild(link);
}
