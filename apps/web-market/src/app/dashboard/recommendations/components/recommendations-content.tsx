'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  CheckCircle2,
  EyeOff,
  Eye,
  Plus,
  ArrowLeft,
  GripVertical,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { WriteRecommendation } from '@/components/recommendations/write-recommendation';
import { recommendationsApi, type Recommendation } from '@/lib/api/recommendations';

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Map API status to display status
function mapStatus(status: Recommendation['status']): 'displayed' | 'hidden' | 'pending' {
  if (status === 'pending') return 'pending';
  if (status === 'hidden') return 'hidden';
  return 'displayed';
}

// Map API relationship to display text
function formatRelationship(relationship: Recommendation['relationship']): string {
  const map: Record<string, string> = {
    client: 'They were my client',
    employer: 'They worked for me',
    colleague: 'We collaborated',
    other: 'Professional connection',
  };
  return map[relationship] || relationship;
}

export function RecommendationsContent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');
  const [statusFilter, setStatusFilter] = useState<'all' | 'displayed' | 'pending' | 'hidden'>(
    'all'
  );
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

  // Fetch received recommendations
  const {
    data: receivedData,
    isLoading: isLoadingReceived,
    error: receivedError,
  } = useQuery({
    queryKey: ['recommendations', 'received'],
    queryFn: async () => {
      const response = await recommendationsApi.getRecommendationsReceived('me');
      return response.data;
    },
  });

  // Fetch given recommendations
  const {
    data: givenData,
    isLoading: isLoadingGiven,
    error: givenError,
  } = useQuery({
    queryKey: ['recommendations', 'given'],
    queryFn: async () => {
      const response = await recommendationsApi.getRecommendationsGiven('me');
      return response.data;
    },
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.approveRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.hideRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const showMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.showRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const receivedRecommendations = receivedData || [];
  const givenRecommendations = givenData || [];

  const filteredRecommendations = receivedRecommendations.filter((rec) => {
    const displayStatus = mapStatus(rec.status);
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return rec.status === 'pending';
    return displayStatus === statusFilter;
  });

  const pendingCount = receivedRecommendations.filter((r) => r.status === 'pending').length;

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleHide = (id: string) => {
    hideMutation.mutate(id);
  };

  const handleShow = (id: string) => {
    showMutation.mutate(id);
  };

  const isLoading = isLoadingReceived || isLoadingGiven;
  const error = receivedError || givenError;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-500">Loading recommendations...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Failed to load recommendations</h3>
          <p className="text-gray-500">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          href="/dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
            <p className="mt-1 text-gray-500">Manage testimonials and endorsements</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            onClick={() => setIsWriteModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Write Recommendation
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'received'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('received')}
        >
          Received ({receivedRecommendations.length})
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {pendingCount} new
            </span>
          )}
        </button>
        <button
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'given'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('given')}
        >
          Given ({givenRecommendations.length})
        </button>
      </div>

      {/* Received Recommendations */}
      {activeTab === 'received' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending Approval' },
              { value: 'displayed', label: 'Displayed' },
              { value: 'hidden', label: 'Hidden' },
            ].map((filter) => (
              <button
                key={filter.value}
                className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setStatusFilter(filter.value as typeof statusFilter)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Recommendations List */}
          <div className="space-y-4">
            {filteredRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 font-medium text-white">
                      {rec.recommender.avatar ? (
                        <img
                          src={rec.recommender.avatar}
                          alt={rec.recommender.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        rec.recommender.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{rec.recommender.name}</h4>
                      <p className="text-sm text-gray-600">{rec.recommender.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatRelationship(rec.relationship)} • {rec.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatRelativeTime(rec.createdAt)}</span>
                    {rec.status === 'pending' && (
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        Pending
                      </span>
                    )}
                    {mapStatus(rec.status) === 'displayed' && (
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                        Displayed
                      </span>
                    )}
                  </div>
                </div>

                {/* Text */}
                <p className="mb-4 leading-relaxed text-gray-700">{rec.text}</p>

                {/* Skills */}
                {rec.skillsHighlighted.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {rec.skillsHighlighted.map((skill) => (
                      <span
                        key={skill}
                        className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-gray-100 pt-4">
                  {rec.status === 'pending' && (
                    <>
                      <button
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                        onClick={() => handleApprove(rec.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve & Display
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                        onClick={() => handleHide(rec.id)}
                      >
                        <EyeOff className="h-4 w-4" />
                        Don&apos;t Display
                      </button>
                    </>
                  )}
                  {mapStatus(rec.status) === 'displayed' && (
                    <button
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      onClick={() => handleHide(rec.id)}
                    >
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </button>
                  )}
                  {mapStatus(rec.status) === 'hidden' && (
                    <button
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                      onClick={() => handleShow(rec.id)}
                    >
                      <Eye className="h-4 w-4" />
                      Show
                    </button>
                  )}
                  <button className="ml-auto cursor-move p-2 text-gray-400 hover:text-gray-600">
                    <GripVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredRecommendations.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No recommendations found</p>
            </div>
          )}
        </div>
      )}

      {/* Given Recommendations */}
      {activeTab === 'given' && (
        <div className="space-y-4">
          {givenRecommendations.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">You haven&apos;t written any recommendations yet</p>
              <button
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700"
                onClick={() => setIsWriteModalOpen(true)}
              >
                Write your first recommendation
              </button>
            </div>
          ) : (
            givenRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Recommendation for {rec.recipientId}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {formatRelationship(rec.relationship)} • {rec.duration}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{formatRelativeTime(rec.createdAt)}</span>
                </div>
                <p className="text-gray-700">{rec.text}</p>
                {rec.skillsHighlighted.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rec.skillsHighlighted.map((skill) => (
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
            ))
          )}
        </div>
      )}

      {/* Write Recommendation Modal */}
      <WriteRecommendation
        isOpen={isWriteModalOpen}
        recipientName="John Doe"
        onClose={() => setIsWriteModalOpen(false)}
        onSubmit={(_data) => {
          /* Feature: Submit recommendation - not yet implemented */
        }}
      />
    </div>
  );
}
