'use client';

import { Button, Card, CardContent, CardHeader, Dialog, DialogContent } from '@skillancer/ui';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Play, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import type { PortfolioItem } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface PortfolioGalleryProps {
  items: PortfolioItem[];
  username: string;
  isOwnProfile?: boolean;
  showViewAll?: boolean;
  maxItems?: number;
  className?: string;
}

interface PortfolioCardProps {
  item: PortfolioItem;
  username: string;
  onClick: () => void;
}

// ============================================================================
// Portfolio Card
// ============================================================================

function PortfolioCard({ item, username: _username, onClick }: PortfolioCardProps) {
  const isVideo = item.mediaType === 'VIDEO';

  return (
    <button
      className="bg-muted focus:ring-primary group relative aspect-[4/3] w-full overflow-hidden rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-offset-2"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <Image
        fill
        alt={item.title}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        src={item.thumbnailUrl || '/placeholder-portfolio.jpg'}
      />

      {/* Video play icon */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Featured badge */}
      {item.isFeatured && (
        <span className="bg-primary text-primary-foreground absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium">
          Featured
        </span>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
        <h4 className="line-clamp-2 font-medium text-white">{item.title}</h4>
        {item.skills.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.skills.slice(0, 3).map((skill) => (
              <span key={skill} className="rounded bg-white/20 px-1.5 py-0.5 text-xs text-white">
                {skill}
              </span>
            ))}
            {item.skills.length > 3 && (
              <span className="text-xs text-white/80">+{item.skills.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* View count */}
      {item.viewCount > 0 && (
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Eye className="h-3 w-3" />
          {item.viewCount}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Lightbox Component
// ============================================================================

interface LightboxProps {
  items: PortfolioItem[];
  currentIndex: number;
  username: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function Lightbox({ items, currentIndex, username, onClose, onNext, onPrev }: LightboxProps) {
  const item = items[currentIndex];
  if (!item) return null;

  const hasMultiple = items.length > 1;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold">{item.title}</h3>
            {item.clientName && (
              <p className="text-muted-foreground text-sm">Client: {item.clientName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/freelancers/${username}/portfolio/${item.id}`}>
                View Details
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Media */}
        <div className="relative aspect-video bg-black">
          {item.mediaType === 'VIDEO' ? (
            <video
              controls
              className="h-full w-full"
              poster={item.thumbnailUrl}
              src={item.mediaUrls[0]}
            >
              <track kind="captions" label="English" srcLang="en" />
            </video>
          ) : (
            <Image
              fill
              alt={item.title}
              className="object-contain"
              src={item.mediaUrls[0] || item.thumbnailUrl}
            />
          )}

          {/* Navigation arrows */}
          {hasMultiple && (
            <>
              <Button
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                size="icon"
                variant="ghost"
                onClick={onPrev}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                size="icon"
                variant="ghost"
                onClick={onNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-muted-foreground line-clamp-3 text-sm">{item.description}</p>
          {item.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {item.skills.map((skill) => (
                <span key={skill} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                  {skill}
                </span>
              ))}
            </div>
          )}
          {hasMultiple && (
            <p className="text-muted-foreground mt-3 text-center text-xs">
              {currentIndex + 1} of {items.length}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PortfolioGallery({
  items,
  username,
  isOwnProfile = false,
  showViewAll = true,
  maxItems = 6,
  className,
}: PortfolioGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visibleItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const nextItem = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % items.length : 0));
  }, [items.length]);

  const prevItem = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev - 1 + items.length) % items.length : 0));
  }, [items.length]);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-xl font-semibold">Portfolio</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground">No portfolio items yet</p>
            {isOwnProfile && (
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link href="/dashboard/profile/portfolio">Add Portfolio Item</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <h2 className="text-xl font-semibold">Portfolio</h2>
          <p className="text-muted-foreground text-sm">{items.length} projects</p>
        </div>
        {isOwnProfile ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/profile/portfolio">Manage</Link>
          </Button>
        ) : showViewAll && hasMore ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/freelancers/${username}/portfolio`}>View All ({items.length})</Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        {/* Masonry-style grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, index) => (
            <PortfolioCard
              key={item.id}
              item={item}
              username={username}
              onClick={() => openLightbox(index)}
            />
          ))}
        </div>

        {/* View all link for mobile */}
        {hasMore && showViewAll && (
          <div className="mt-4 text-center sm:hidden">
            <Button asChild variant="outline">
              <Link href={`/freelancers/${username}/portfolio`}>
                View All {items.length} Projects
              </Link>
            </Button>
          </div>
        )}
      </CardContent>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          currentIndex={lightboxIndex}
          items={items}
          username={username}
          onClose={closeLightbox}
          onNext={nextItem}
          onPrev={prevItem}
        />
      )}
    </Card>
  );
}
