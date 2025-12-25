'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import { ChevronDown, MessageSquare, Star, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

import type { FreelancerReview, ReviewsResponse } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface ReviewsSectionProps {
  initialData: ReviewsResponse;
  userId: string;
  onLoadMore?: (page: number) => Promise<ReviewsResponse>;
  className?: string;
}

// ============================================================================
// Rating Stars Component
// ============================================================================

function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'xs' | 'sm' | 'md' }) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : star - 0.5 <= rating
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Rating Breakdown Component
// ============================================================================

function RatingBreakdown({
  breakdown,
  avgRatings,
}: {
  breakdown: ReviewsResponse['ratingBreakdown'];
  avgRatings: ReviewsResponse['avgRatings'];
}) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Overall rating */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-4xl font-bold">{avgRatings.overall.toFixed(1)}</p>
          <RatingStars rating={avgRatings.overall} size="md" />
          <p className="text-muted-foreground mt-1 text-sm">{total} reviews</p>
        </div>

        {/* Star breakdown */}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = breakdown[stars as keyof typeof breakdown];
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-3">{stars}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <Progress className="h-2 flex-1" value={percentage} />
                <span className="text-muted-foreground w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category ratings */}
      <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3">
        {[
          { key: 'communication', label: 'Communication' },
          { key: 'quality', label: 'Quality' },
          { key: 'expertise', label: 'Expertise' },
          { key: 'professionalism', label: 'Professionalism' },
          { key: 'timeliness', label: 'Timeliness' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="font-medium">
              {avgRatings[key as keyof typeof avgRatings].toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Review Card Component
// ============================================================================

function ReviewCard({ review }: { review: FreelancerReview }) {
  const [expanded, setExpanded] = useState(false);
  const isLongContent = review.content.length > 300;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="border-b pb-6 last:border-0 last:pb-0">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage alt={review.clientName} src={review.clientAvatarUrl} />
          <AvatarFallback>{getInitials(review.clientName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{review.clientName}</p>
              <p className="text-muted-foreground text-sm">{review.projectTitle}</p>
            </div>
            <div className="text-right">
              <RatingStars rating={review.rating} size="sm" />
              <p className="text-muted-foreground mt-0.5 text-xs">{formatDate(review.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3">
        <p className={cn('text-foreground text-sm', !expanded && isLongContent && 'line-clamp-4')}>
          {review.content}
        </p>
        {isLongContent && (
          <Button
            className="h-auto p-0 text-xs"
            size="sm"
            variant="link"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        )}
      </div>

      {/* Freelancer response */}
      {review.response && (
        <div className="bg-muted/50 mt-3 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            Freelancer&apos;s Response
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{review.response.content}</p>
          <p className="text-muted-foreground/70 mt-1 text-xs">
            {formatDate(review.response.createdAt)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-4">
        <Button
          className="text-muted-foreground h-auto gap-1 p-0 text-xs"
          size="sm"
          variant="ghost"
        >
          <ThumbsUp className="h-3 w-3" />
          Helpful ({review.helpfulCount})
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReviewsSection({
  initialData,
  userId: _userId,
  onLoadMore,
  className,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState(initialData.reviews);
  const [page, setPage] = useState(initialData.page);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'helpful'>('recent');
  const [filterRating, setFilterRating] = useState<string>('all');

  const hasMore = page < initialData.totalPages;

  const handleLoadMore = async () => {
    if (!onLoadMore || loading) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const data = await onLoadMore(nextPage);
      setReviews((prev) => [...prev, ...data.reviews]);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  };

  // Filter reviews by rating
  const filteredReviews =
    filterRating === 'all'
      ? reviews
      : reviews.filter((r) => r.rating === parseInt(filterRating, 10));

  if (initialData.total === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-xl font-semibold">Reviews</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="text-muted-foreground/30 h-12 w-12" />
            <p className="text-muted-foreground mt-4">No reviews yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-xl font-semibold">Reviews</h2>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rating breakdown */}
        <RatingBreakdown
          avgRatings={initialData.avgRatings}
          breakdown={initialData.ratingBreakdown}
        />

        {/* Filters */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4 stars</SelectItem>
                <SelectItem value="3">3 stars</SelectItem>
                <SelectItem value="2">2 stars</SelectItem>
                <SelectItem value="1">1 star</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'helpful')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reviews list */}
        <div className="space-y-6">
          {filteredReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        {/* Load more */}
        {hasMore && onLoadMore && (
          <Button
            className="w-full"
            disabled={loading}
            variant="outline"
            onClick={() => void handleLoadMore()}
          >
            {loading ? (
              'Loading...'
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Load More Reviews
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
