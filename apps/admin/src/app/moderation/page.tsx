'use client';

import { useState } from 'react';
import {
  useModerationItems,
  useModerationStats,
  useApproveItem,
  useRejectItem,
  useEscalateItem,
  useBulkApproveItems,
  useBulkRejectItems,
} from '../../hooks/api/use-moderation';

type ModerationTab = 'jobs' | 'profiles' | 'reviews' | 'messages' | 'portfolio';

const contentTypeMap: Record<ModerationTab, string> = {
  jobs: 'job_posting',
  profiles: 'profile',
  reviews: 'review',
  messages: 'message',
  portfolio: 'portfolio',
};

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<ModerationTab>('jobs');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: itemsData, isLoading, error } = useModerationItems({
    contentType: contentTypeMap[activeTab] as never,
    status: 'pending' as never,
  });
  const { data: statsData } = useModerationStats();

  const approveItem = useApproveItem();
  const rejectItem = useRejectItem();
  const escalateItem = useEscalateItem();
  const bulkApprove = useBulkApproveItems();
  const bulkReject = useBulkRejectItems();

  const queue = itemsData?.data ?? [];
  const stats = statsData?.data ?? {
    pendingCount: 0,
    approvedToday: 0,
    rejectedToday: 0,
    avgReviewTime: 0,
  };

  const tabCounts: Record<ModerationTab, number> = {
    jobs: stats.pendingByType?.job_posting ?? 0,
    profiles: stats.pendingByType?.profile ?? 0,
    reviews: stats.pendingByType?.review ?? 0,
    messages: stats.pendingByType?.message ?? 0,
    portfolio: stats.pendingByType?.portfolio ?? 0,
  };

  const tabs: { key: ModerationTab; label: string }[] = [
    { key: 'jobs', label: 'Jobs' },
    { key: 'profiles', label: 'Profiles' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'messages', label: 'Messages' },
    { key: 'portfolio', label: 'Portfolio' },
  ];

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === queue.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(queue.map((item: Record<string, unknown>) => item.id as string));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'escalate') => {
    if (action === 'approve') {
      bulkApprove.mutate(selectedItems);
    } else if (action === 'reject') {
      bulkReject.mutate({ itemIds: selectedItems, reason: 'Bulk rejection by admin' });
    }
    setSelectedItems([]);
  };

  const handleApprove = (id: string) => {
    approveItem.mutate({ id });
  };

  const handleReject = (id: string) => {
    rejectItem.mutate({ id, reason: 'Rejected by admin' });
  };

  const handleEscalate = (id: string) => {
    escalateItem.mutate({ id, reason: 'Escalated for further review' });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-red-600 bg-red-50';
    if (score >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
          <p className="text-gray-600">Review and moderate flagged content</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{stats.pendingCount ?? 0}</span> items
            pending
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Pending Review</div>
          <div className="text-2xl font-bold text-gray-900">{stats.pendingCount ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Approved Today</div>
          <div className="text-2xl font-bold text-green-600">{stats.approvedToday ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Rejected Today</div>
          <div className="text-2xl font-bold text-red-600">{stats.rejectedToday ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Avg Review Time</div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.avgReviewTime ? `${(stats.avgReviewTime / 60).toFixed(1)}m` : '-'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedItems([]);
              }}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-indigo-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-900">
            {selectedItems.length} items selected
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              onClick={() => handleBulkAction('approve')}
            >
              Approve All
            </button>
            <button
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => handleBulkAction('reject')}
            >
              Reject All
            </button>
            <button
              className="rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
              onClick={() => handleBulkAction('escalate')}
            >
              Escalate All
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-white py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <span className="ml-3 text-gray-500">Loading moderation queue...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load moderation queue</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Queue List */}
      {!isLoading && !error && queue.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <label className="flex items-center gap-2">
              <input
                checked={selectedItems.length === queue.length && queue.length > 0}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                type="checkbox"
                onChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select all</span>
            </label>
          </div>
          <div className="divide-y">
            {queue.map((item: Record<string, unknown>) => (
              <div
                key={item.id as string}
                className="flex items-start gap-4 p-4 hover:bg-gray-50"
              >
                <input
                  checked={selectedItems.includes(item.id as string)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  type="checkbox"
                  onChange={() => handleSelectItem(item.id as string)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {(item.title as string) || (item.contentTitle as string) || 'Untitled'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {(item.reason as string) || (item.flagReason as string) || 'Flagged for review'}
                      </p>
                      {(item.reportedBy as Record<string, string>) && (
                        <p className="mt-1 text-xs text-gray-400">
                          Reported by: {(item.reportedBy as Record<string, string>)?.name || 'Unknown'}{' '}
                          {(item.reportedBy as Record<string, string>)?.email
                            ? `(${(item.reportedBy as Record<string, string>).email})`
                            : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {typeof item.aiScore === 'number' && (
                        <div
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getScoreColor(item.aiScore as number)}`}
                        >
                          AI: {Math.round((item.aiScore as number) * 100)}%
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        {item.createdAt
                          ? new Date(item.createdAt as string).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                      disabled={approveItem.isPending}
                      onClick={() => handleApprove(item.id as string)}
                    >
                      Approve
                    </button>
                    <button
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                      disabled={rejectItem.isPending}
                      onClick={() => handleReject(item.id as string)}
                    >
                      Reject
                    </button>
                    <button
                      className="rounded-lg bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
                      disabled={escalateItem.isPending}
                      onClick={() => handleEscalate(item.id as string)}
                    >
                      Escalate
                    </button>
                    <button className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && queue.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-lg font-medium text-gray-900">Queue is empty</p>
          <p className="mt-1 text-gray-500">No items pending review in this category</p>
        </div>
      )}
    </div>
  );
}
