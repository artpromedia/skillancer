'use client';

import {
  MessageSquare,
  CheckCircle2,
  EyeOff,
  Eye,
  Plus,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { WriteRecommendation } from '@/components/recommendations/write-recommendation';

// Mock data
const receivedRecommendations = [
  {
    id: '1',
    recommender: {
      id: '1',
      name: 'Sarah Johnson',
      title: 'Product Manager at TechCorp',
      avatar: '',
    },
    relationship: 'They worked for me',
    duration: '8 months',
    text: 'Outstanding developer with exceptional problem-solving skills. Delivered our e-commerce platform ahead of schedule with clean, maintainable code.',
    skillsHighlighted: ['React', 'Node.js', 'TypeScript'],
    date: '2 weeks ago',
    status: 'displayed',
    isPending: false,
  },
  {
    id: '2',
    recommender: {
      id: '2',
      name: 'Michael Chen',
      title: 'CTO at StartupXYZ',
      avatar: '',
    },
    relationship: 'We collaborated',
    duration: '1 year',
    text: 'A true professional. Their technical expertise and communication skills made our complex project a success.',
    skillsHighlighted: ['Python', 'AWS', 'Docker'],
    date: '1 month ago',
    status: 'displayed',
    isPending: false,
  },
  {
    id: '3',
    recommender: {
      id: '3',
      name: 'Emily Rodriguez',
      title: 'Engineering Lead',
      avatar: '',
    },
    relationship: 'I worked for them',
    duration: '6 months',
    text: 'Great mentor and collaborator. Always willing to help and share knowledge with the team.',
    skillsHighlighted: ['JavaScript', 'Mentoring'],
    date: '3 days ago',
    status: 'pending',
    isPending: true,
  },
];

const givenRecommendations = [
  {
    id: '1',
    recipient: { name: 'David Park', title: 'Full Stack Developer' },
    text: 'Excellent developer with strong problem-solving skills...',
    date: '1 week ago',
  },
  {
    id: '2',
    recipient: { name: 'Lisa Anderson', title: 'UX Designer' },
    text: 'Creative and detail-oriented designer who delivers...',
    date: '3 weeks ago',
  },
];

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');
  const [statusFilter, setStatusFilter] = useState<'all' | 'displayed' | 'pending' | 'hidden'>(
    'all'
  );
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

  const filteredRecommendations = receivedRecommendations.filter((rec) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return rec.isPending;
    return rec.status === statusFilter;
  });

  const pendingCount = receivedRecommendations.filter((r) => r.isPending).length;

  const handleApprove = (_id: string) => {
    // Feature: API call to approve recommendation - not yet implemented
  };

  const handleHide = (_id: string) => {
    // Feature: API call to hide recommendation - not yet implemented
  };

  const handleShow = (_id: string) => {
    // Feature: API call to show recommendation - not yet implemented
  };

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
                      {rec.recommender.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{rec.recommender.name}</h4>
                      <p className="text-sm text-gray-600">{rec.recommender.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {rec.relationship} • {rec.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{rec.date}</span>
                    {rec.isPending && (
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        Pending
                      </span>
                    )}
                    {rec.status === 'displayed' && (
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
                  {rec.isPending && (
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
                  {rec.status === 'displayed' && (
                    <button
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      onClick={() => handleHide(rec.id)}
                    >
                      <EyeOff className="h-4 w-4" />
                      Hide
                    </button>
                  )}
                  {rec.status === 'hidden' && (
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
          {givenRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{rec.recipient.name}</h4>
                  <p className="text-sm text-gray-600">{rec.recipient.title}</p>
                </div>
                <span className="text-xs text-gray-400">{rec.date}</span>
              </div>
              <p className="text-gray-700">{rec.text}</p>
            </div>
          ))}
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
