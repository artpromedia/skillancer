'use client';

import { useState } from 'react';

type ModerationTab = 'jobs' | 'profiles' | 'reviews' | 'messages' | 'portfolio';

interface QueueItem {
  id: string;
  type: ModerationTab;
  title: string;
  reportedBy?: { name: string; email: string };
  reason: string;
  aiScore: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
}

const mockQueue: QueueItem[] = [
  {
    id: '1',
    type: 'jobs',
    title: 'Senior React Developer Needed',
    reason: 'Contact info in description',
    aiScore: 0.85,
    createdAt: '2024-01-15T10:00:00Z',
    status: 'pending',
  },
  {
    id: '2',
    type: 'profiles',
    title: 'John Doe Profile',
    reportedBy: { name: 'Jane Smith', email: 'jane@example.com' },
    reason: 'Fake credentials',
    aiScore: 0.72,
    createdAt: '2024-01-15T09:30:00Z',
    status: 'pending',
  },
  {
    id: '3',
    type: 'reviews',
    title: 'Review by ClientX',
    reportedBy: { name: 'FreelancerY', email: 'fy@example.com' },
    reason: 'Harassment',
    aiScore: 0.91,
    createdAt: '2024-01-15T08:00:00Z',
    status: 'pending',
  },
  {
    id: '4',
    type: 'jobs',
    title: 'Quick Data Entry Task',
    reason: 'Spam/duplicate',
    aiScore: 0.95,
    createdAt: '2024-01-14T15:00:00Z',
    status: 'pending',
  },
  {
    id: '5',
    type: 'messages',
    title: 'Message from User123',
    reportedBy: { name: 'User456', email: 'u456@example.com' },
    reason: 'Solicitation',
    aiScore: 0.68,
    createdAt: '2024-01-14T12:00:00Z',
    status: 'pending',
  },
];

const tabs: { key: ModerationTab; label: string; count: number }[] = [
  { key: 'jobs', label: 'Jobs', count: 12 },
  { key: 'profiles', label: 'Profiles', count: 5 },
  { key: 'reviews', label: 'Reviews', count: 8 },
  { key: 'messages', label: 'Messages', count: 3 },
  { key: 'portfolio', label: 'Portfolio', count: 2 },
];

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState<ModerationTab>('jobs');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const filteredQueue = mockQueue.filter((item) => item.type === activeTab);

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredQueue.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredQueue.map((item) => item.id));
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'escalate') => {
    console.log(`Bulk ${action}:`, selectedItems);
    setSelectedItems([]);
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
            <span className="font-medium text-gray-900">30</span> items pending
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Pending Review</div>
          <div className="text-2xl font-bold text-gray-900">30</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Approved Today</div>
          <div className="text-2xl font-bold text-green-600">45</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Rejected Today</div>
          <div className="text-2xl font-bold text-red-600">12</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Avg Review Time</div>
          <div className="text-2xl font-bold text-gray-900">2.5m</div>
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
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
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

      {/* Queue List */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <label className="flex items-center gap-2">
            <input
              checked={selectedItems.length === filteredQueue.length && filteredQueue.length > 0}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              type="checkbox"
              onChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">Select all</span>
          </label>
        </div>
        <div className="divide-y">
          {filteredQueue.map((item) => (
            <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-gray-50">
              <input
                checked={selectedItems.includes(item.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                type="checkbox"
                onChange={() => handleSelectItem(item.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.reason}</p>
                    {item.reportedBy && (
                      <p className="mt-1 text-xs text-gray-400">
                        Reported by: {item.reportedBy.name} ({item.reportedBy.email})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getScoreColor(item.aiScore)}`}
                    >
                      AI: {Math.round(item.aiScore * 100)}%
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-200">
                    Approve
                  </button>
                  <button className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200">
                    Reject
                  </button>
                  <button className="rounded-lg bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-200">
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
    </div>
  );
}
