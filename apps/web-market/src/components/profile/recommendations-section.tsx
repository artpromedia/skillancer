'use client';

import { cn } from '@skillancer/ui';
import { MessageSquare, Plus, ChevronRight, Quote } from 'lucide-react';
import { useState } from 'react';

interface Recommendation {
  id: string;
  recommender: {
    id: string;
    name: string;
    title: string;
    avatar?: string;
  };
  relationship: string;
  duration: string;
  text: string;
  skillsMentioned: string[];
  date: string;
}

interface RecommendationsSectionProps {
  recommendations: Recommendation[];
  isOwnProfile?: boolean;
  onRequestRecommendation?: () => void;
  onGiveRecommendation?: () => void;
  onViewAll?: () => void;
  className?: string;
}

export function RecommendationsSection({
  recommendations,
  isOwnProfile = false,
  onRequestRecommendation,
  onGiveRecommendation,
  onViewAll,
  className,
}: Readonly<RecommendationsSectionProps>) {
  const [showAll, setShowAll] = useState(false);
  const displayedRecommendations = showAll ? recommendations : recommendations.slice(0, 3);

  return (
    <section className={cn('rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="border-b border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Recommendations</h3>
              <p className="text-sm text-gray-500">{recommendations.length} testimonials</p>
            </div>
          </div>

          <div className="flex gap-2">
            {isOwnProfile ? (
              <>
                {onRequestRecommendation && (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    onClick={onRequestRecommendation}
                  >
                    <Plus className="h-4 w-4" />
                    Request
                  </button>
                )}
              </>
            ) : (
              <>
                {onGiveRecommendation && (
                  <button
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    onClick={onGiveRecommendation}
                  >
                    <Plus className="h-4 w-4" />
                    Write Recommendation
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      {recommendations.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {displayedRecommendations.map((rec) => (
            <div key={rec.id} className="p-6 transition-colors hover:bg-gray-50">
              {/* Recommender Info */}
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 font-medium text-white">
                  {rec.recommender.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{rec.recommender.name}</h4>
                  <p className="text-sm text-gray-600">{rec.recommender.title}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {rec.relationship} • {rec.duration}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{rec.date}</span>
              </div>

              {/* Recommendation Text */}
              <div className="relative">
                <Quote className="absolute -left-2 -top-1 h-6 w-6 text-gray-200" />
                <p className="pl-4 leading-relaxed text-gray-700">{rec.text}</p>
              </div>

              {/* Skills Mentioned */}
              {rec.skillsMentioned.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {rec.skillsMentioned.map((skill) => (
                    <span
                      key={skill}
                      className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No recommendations yet</p>
          {isOwnProfile && onRequestRecommendation && (
            <button
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              onClick={onRequestRecommendation}
            >
              Request Your First Recommendation
            </button>
          )}
        </div>
      )}

      {/* Show More/View All */}
      {recommendations.length > 3 && (
        <div className="border-t border-gray-100 p-4">
          <button
            className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            onClick={() => (onViewAll ? onViewAll() : setShowAll(!showAll))}
          >
            {showAll ? 'Show less' : `View all ${recommendations.length} recommendations`}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}

export default RecommendationsSection;
