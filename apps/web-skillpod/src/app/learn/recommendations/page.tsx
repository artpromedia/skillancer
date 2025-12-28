'use client';

import { cn } from '@skillancer/ui';
import { ArrowLeft, Sparkles, Grid, List, RefreshCw, Filter, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import RecommendationCard from '../../../components/learning/recommendation-card';
import RecommendationFilters from '../../../components/learning/recommendation-filters';
import WhyRecommended from '../../../components/learning/why-recommended';

import type React from 'react';

// Mock data
const mockRecommendations = [
  {
    id: 'rec-1',
    title: 'Advanced React Patterns & Performance',
    type: 'course' as const,
    provider: 'Frontend Masters',
    duration: '8 hours',
    relevanceScore: 95,
    reasons: [
      'Direct match for 85% of your recent job applications',
      'Addresses React performance gaps identified in your profile',
      'Recommended by 12 freelancers in your network',
    ],
    rating: 4.9,
    enrollments: 15420,
    level: 'Advanced' as const,
    skills: ['React', 'TypeScript', 'Performance', 'Design Patterns'],
    careerImpact: { rateIncrease: '+$25/hr', opportunityIncrease: '+47%' },
    price: 'Included in subscription',
  },
  {
    id: 'rec-2',
    title: 'AWS Solutions Architect Professional',
    type: 'certification' as const,
    provider: 'AWS Training',
    duration: '40 hours',
    relevanceScore: 92,
    reasons: [
      'Top requested certification in your target job category',
      'Complements your existing AWS Associate certification',
      'Average rate increase of $35/hr after completion',
    ],
    rating: 4.8,
    enrollments: 89500,
    level: 'Advanced' as const,
    skills: ['AWS', 'Cloud Architecture', 'Security', 'Networking'],
    careerImpact: { rateIncrease: '+$35/hr', opportunityIncrease: '+62%' },
    price: '$300 exam fee',
  },
  {
    id: 'rec-3',
    title: 'Build a SaaS MVP with Next.js 14',
    type: 'project' as const,
    provider: 'Skillpod Projects',
    duration: '12 hours',
    relevanceScore: 88,
    reasons: [
      'Hands-on experience matching current job requirements',
      'Portfolio piece that demonstrates full-stack skills',
      'Uses technologies from your skill gaps list',
    ],
    rating: 4.7,
    enrollments: 3240,
    level: 'Intermediate' as const,
    skills: ['Next.js', 'React', 'Stripe', 'Prisma', 'Tailwind'],
    careerImpact: { rateIncrease: '+$15/hr', opportunityIncrease: '+28%' },
    price: 'Free',
  },
  {
    id: 'rec-4',
    title: 'Node.js Microservices Architecture',
    type: 'course' as const,
    provider: 'Pluralsight',
    duration: '6 hours',
    relevanceScore: 85,
    reasons: [
      'Matches skills required in 23% of your saved jobs',
      'Builds on your existing Node.js experience',
    ],
    rating: 4.6,
    enrollments: 8920,
    level: 'Intermediate' as const,
    skills: ['Node.js', 'Microservices', 'Docker', 'RabbitMQ'],
    careerImpact: { rateIncrease: '+$20/hr', opportunityIncrease: '+35%' },
    price: 'Included in subscription',
  },
  {
    id: 'rec-5',
    title: 'GraphQL API Design Fundamentals',
    type: 'tutorial' as const,
    provider: 'Apollo',
    duration: '3 hours',
    relevanceScore: 82,
    reasons: [
      'Quick skill addition that many job postings require',
      'Free resource from industry leader',
    ],
    rating: 4.5,
    enrollments: 45200,
    level: 'Beginner' as const,
    skills: ['GraphQL', 'API Design', 'Apollo'],
    careerImpact: { rateIncrease: '+$10/hr', opportunityIncrease: '+18%' },
    price: 'Free',
  },
  {
    id: 'rec-6',
    title: 'Kubernetes for Developers',
    type: 'certification' as const,
    provider: 'CNCF',
    duration: '25 hours',
    relevanceScore: 79,
    reasons: ['High-demand skill in enterprise freelancing', 'Complements your Docker knowledge'],
    rating: 4.7,
    enrollments: 32100,
    level: 'Intermediate' as const,
    skills: ['Kubernetes', 'Docker', 'Cloud Native', 'DevOps'],
    careerImpact: { rateIncrease: '+$30/hr', opportunityIncrease: '+52%' },
    price: '$395 exam fee',
  },
];

export default function RecommendationsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);
  const [savedItems, setSavedItems] = useState<string[]>([]);
  const [dismissedItems, setDismissedItems] = useState<string[]>([]);
  const [selectedRec, setSelectedRec] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    types: [] as string[],
    levels: [] as string[],
    duration: [] as string[],
    minRelevance: 0,
    providers: [] as string[],
    skills: [] as string[],
    sortBy: 'relevance' as const,
  });

  const handleSave = (id: string) => {
    setSavedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleDismiss = (id: string) => {
    setDismissedItems((prev) => [...prev, id]);
  };

  // Filter recommendations
  const filteredRecs = mockRecommendations
    .filter((rec) => !dismissedItems.includes(rec.id))
    .filter((rec) => filters.types.length === 0 || filters.types.includes(rec.type))
    .filter((rec) => filters.levels.length === 0 || filters.levels.includes(rec.level))
    .filter((rec) => rec.relevanceScore >= filters.minRelevance)
    .filter(
      (rec) => filters.skills.length === 0 || rec.skills.some((s) => filters.skills.includes(s))
    )
    .filter((rec) => filters.providers.length === 0 || filters.providers.includes(rec.provider));

  // Sort recommendations
  const sortedRecs = [...filteredRecs].sort((a, b) => {
    switch (filters.sortBy) {
      case 'relevance':
        return b.relevanceScore - a.relevanceScore;
      case 'rating':
        return b.rating - a.rating;
      case 'duration':
        return Number.parseInt(a.duration, 10) - Number.parseInt(b.duration, 10);
      default:
        return 0;
    }
  });

  const selectedRecData = mockRecommendations.find((r) => r.id === selectedRec);

  const renderRecommendations = (): React.ReactNode => {
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedRecs.map((rec) => (
            <div key={rec.id}>
              <RecommendationCard
                showReasons
                isSaved={savedItems.includes(rec.id)}
                recommendation={rec}
                onDismiss={handleDismiss}
                onSave={handleSave}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {sortedRecs.map((rec) => (
          <RecommendationCard
            key={rec.id}
            isSaved={savedItems.includes(rec.id)}
            recommendation={rec}
            variant="compact"
            onDismiss={handleDismiss}
            onSave={handleSave}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link
            className="mb-4 inline-flex items-center gap-1 text-white/80 hover:text-white"
            href="/learn"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Personalized Recommendations</h1>
              </div>
              <p className="text-white/80">
                AI-powered learning suggestions based on your skills, career goals, and market
                demand
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 transition-colors hover:bg-white/20">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                className="flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 transition-colors hover:bg-white/20"
                href="/learn/recommendations/saved"
              >
                <Bookmark className="h-4 w-4" />
                Saved ({savedItems.length})
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  showFilters ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
                )}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>

              <div className="h-6 w-px bg-gray-200" />

              <span className="text-sm text-gray-500">{sortedRecs.length} recommendations</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
                <button
                  className={cn(
                    'rounded p-1.5',
                    viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  className={cn(
                    'rounded p-1.5',
                    viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                  )}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-72 shrink-0">
              <RecommendationFilters
                filters={filters}
                totalResults={sortedRecs.length}
                onChange={setFilters}
              />
            </div>
          )}

          {/* Recommendations */}
          <div className="flex-1">
            {sortedRecs.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <Sparkles className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <h3 className="mb-1 text-lg font-medium text-gray-900">No Recommendations Found</h3>
                <p className="mb-4 text-gray-500">Try adjusting your filters to see more results</p>
                <button
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                  onClick={() =>
                    setFilters({
                      types: [],
                      levels: [],
                      duration: [],
                      minRelevance: 0,
                      providers: [],
                      skills: [],
                      sortBy: 'relevance',
                    })
                  }
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              renderRecommendations()
            )}

            {/* Dismissed Items */}
            {dismissedItems.length > 0 && (
              <div className="mt-8 rounded-xl bg-gray-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {dismissedItems.length} recommendation{dismissedItems.length > 1 ? 's' : ''}{' '}
                    dismissed
                  </p>
                  <button
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    onClick={() => setDismissedItems([])}
                  >
                    Undo all
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Why Recommended Modal */}
      {selectedRecData && (
        <WhyRecommended
          careerRelevance="This skill aligns with Senior Full-Stack Developer roles you've been applying to"
          marketDemand="Job postings requiring this skill have increased 34% this quarter"
          matchScore={selectedRecData.relevanceScore}
          peerActivity="8 freelancers in your network completed this recently"
          reasons={selectedRecData.reasons}
          skillAlignment={selectedRecData.skills}
          variant="modal"
          onClose={() => setSelectedRec(null)}
        />
      )}
    </div>
  );
}
