'use client';

import { cn } from '@skillancer/ui';
import {
  BookOpen,
  Video,
  Code,
  Award,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  TrendingUp,
  Star,
  Bookmark,
  X,
  ExternalLink,
  Users,
  BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useRef } from 'react';

interface Recommendation {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'project' | 'tutorial';
  provider: string;
  duration: string;
  relevanceScore: number;
  reasons: string[];
  thumbnail?: string;
  rating: number;
  enrollments: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
  careerImpact: {
    rateIncrease: string;
    opportunityIncrease: string;
  };
}

export function RecommendationCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  // Mock recommendations
  const recommendations: Recommendation[] = [
    {
      id: '1',
      title: 'Advanced React Patterns & Architecture',
      type: 'course',
      provider: 'Frontend Masters',
      duration: '8h 30m',
      relevanceScore: 95,
      reasons: [
        '12 job postings in your saved searches require React expertise',
        'Builds on your existing React skills',
        'High-paying clients are increasingly requesting this skill',
      ],
      rating: 4.9,
      enrollments: 15420,
      level: 'Advanced',
      skills: ['React', 'TypeScript', 'Architecture'],
      careerImpact: {
        rateIncrease: '+$25/hr',
        opportunityIncrease: '+40%',
      },
    },
    {
      id: '2',
      title: 'AWS Solutions Architect Professional',
      type: 'certification',
      provider: 'Amazon Web Services',
      duration: '45h',
      relevanceScore: 88,
      reasons: [
        'Most requested cloud certification in your field',
        'Complements your existing DevOps skills',
        'High demand with limited supply',
      ],
      rating: 4.7,
      enrollments: 45200,
      level: 'Advanced',
      skills: ['AWS', 'Cloud Architecture', 'Security'],
      careerImpact: {
        rateIncrease: '+$35/hr',
        opportunityIncrease: '+65%',
      },
    },
    {
      id: '3',
      title: 'Build a Full-Stack SaaS Application',
      type: 'project',
      provider: 'Skillpod Projects',
      duration: '20h',
      relevanceScore: 92,
      reasons: [
        'Demonstrates end-to-end development capabilities',
        'Portfolio piece for client proposals',
        'Covers trending tech stack',
      ],
      rating: 4.8,
      enrollments: 3250,
      level: 'Intermediate',
      skills: ['Next.js', 'PostgreSQL', 'Stripe'],
      careerImpact: {
        rateIncrease: '+$20/hr',
        opportunityIncrease: '+30%',
      },
    },
    {
      id: '4',
      title: 'GraphQL Mastery with Apollo',
      type: 'tutorial',
      provider: 'Apollo GraphQL',
      duration: '4h',
      relevanceScore: 85,
      reasons: [
        'Quick skill to add to your toolkit',
        'Increasingly requested in job postings',
        'Works well with your React experience',
      ],
      rating: 4.6,
      enrollments: 8900,
      level: 'Intermediate',
      skills: ['GraphQL', 'Apollo', 'API Design'],
      careerImpact: {
        rateIncrease: '+$15/hr',
        opportunityIncrease: '+25%',
      },
    },
    {
      id: '5',
      title: 'System Design Interview Prep',
      type: 'course',
      provider: 'Educative',
      duration: '12h',
      relevanceScore: 82,
      reasons: [
        'Essential for senior-level positions',
        'Gap identified in your skill profile',
        'High ROI for time invested',
      ],
      rating: 4.8,
      enrollments: 28300,
      level: 'Advanced',
      skills: ['System Design', 'Scalability', 'Architecture'],
      careerImpact: {
        rateIncrease: '+$30/hr',
        opportunityIncrease: '+50%',
      },
    },
  ];

  const visibleRecommendations = recommendations.filter((rec) => !dismissedItems.has(rec.id));

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const toggleSave = (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const dismiss = (id: string) => {
    setDismissedItems((prev) => new Set(prev).add(id));
  };

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'course':
        return BookOpen;
      case 'certification':
        return Award;
      case 'project':
        return Code;
      case 'tutorial':
        return Video;
    }
  };

  const getTypeBadgeColor = (type: Recommendation['type']) => {
    switch (type) {
      case 'course':
        return 'bg-blue-100 text-blue-700';
      case 'certification':
        return 'bg-purple-100 text-purple-700';
      case 'project':
        return 'bg-green-100 text-green-700';
      case 'tutorial':
        return 'bg-orange-100 text-orange-700';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 p-2">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Recommended For You</h2>
            <p className="text-sm text-gray-500">Based on your skills and career goals</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="scrollbar-hide -mx-1 flex gap-4 overflow-x-auto px-1 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {visibleRecommendations.map((rec) => {
          const TypeIcon = getTypeIcon(rec.type);
          return (
            <div
              key={rec.id}
              className="w-80 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Card Header */}
              <div className="p-4 pb-3">
                <div className="mb-2 flex items-start justify-between">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      getTypeBadgeColor(rec.type)
                    )}
                  >
                    <TypeIcon className="h-3 w-3" />
                    {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className="rounded p-1 transition-colors hover:bg-gray-200"
                      onClick={() => toggleSave(rec.id)}
                    >
                      <Bookmark
                        className={cn(
                          'h-4 w-4',
                          savedItems.has(rec.id)
                            ? 'fill-indigo-600 text-indigo-600'
                            : 'text-gray-400'
                        )}
                      />
                    </button>
                    <button
                      className="rounded p-1 transition-colors hover:bg-gray-200"
                      onClick={() => dismiss(rec.id)}
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <h3 className="mb-1 line-clamp-2 font-medium text-gray-900">{rec.title}</h3>
                <p className="mb-2 text-sm text-gray-500">{rec.provider}</p>

                {/* Meta */}
                <div className="mb-3 flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {rec.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {rec.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {rec.enrollments.toLocaleString()}
                  </span>
                </div>

                {/* Relevance Score */}
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${rec.relevanceScore}%` }}
                    />
                  </div>
                  <span
                    className={cn('text-sm font-medium', getRelevanceColor(rec.relevanceScore))}
                  >
                    {rec.relevanceScore}% match
                  </span>
                </div>

                {/* Why Recommended */}
                <button
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  onClick={() => setExpandedReason(expandedReason === rec.id ? null : rec.id)}
                >
                  {expandedReason === rec.id ? 'Hide reasons' : 'Why this?'}
                </button>
                {expandedReason === rec.id && (
                  <div className="mt-2 rounded-lg bg-indigo-50 p-2">
                    <ul className="space-y-1">
                      {rec.reasons.map((reason) => (
                        <li key={reason} className="flex items-start gap-1 text-xs text-indigo-700">
                          <span className="text-indigo-400">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Career Impact */}
              <div className="border-t border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-green-700">Career Impact</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-sm text-green-700">
                    <TrendingUp className="h-4 w-4" />
                    {rec.careerImpact.rateIncrease}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-green-700">
                    <BarChart2 className="h-4 w-4" />
                    {rec.careerImpact.opportunityIncrease} jobs
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 p-4 pt-3">
                <div className="flex gap-2">
                  <Link
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    href={`/learn/course/${rec.id}`}
                  >
                    Start Learning
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                    onClick={() => toggleSave(rec.id)}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All */}
      <div className="mt-4 text-center">
        <Link
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          href="/learn/recommendations"
        >
          View All Recommendations →
        </Link>
      </div>
    </div>
  );
}

export default RecommendationCarousel;
