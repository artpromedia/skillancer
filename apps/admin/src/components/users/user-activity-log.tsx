/**
 * User Activity Log Component
 *
 * Timeline of all user actions including login, profile changes,
 * transactions, and interactions.
 *
 * @module components/users/user-activity-log
 */

'use client';

import {
  LogIn,
  LogOut,
  Edit,
  FileText,
  DollarSign,
  MessageSquare,
  Briefcase,
  CheckCircle,
  XCircle,
  Shield,
  Download,
  Filter,
  Search,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type ActivityType =
  | 'login'
  | 'logout'
  | 'profile_update'
  | 'bid_submitted'
  | 'contract_created'
  | 'contract_completed'
  | 'payment_received'
  | 'payment_sent'
  | 'message_sent'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'support_ticket';

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

interface UserActivityLogProps {
  userId: string;
  activities?: ActivityItem[];
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'login',
    title: 'Logged in',
    description: 'Successful login via password',
    timestamp: '2024-03-15 14:32:00',
    ipAddress: '192.168.1.100',
    location: 'San Francisco, CA',
    userAgent: 'Chrome 122 on macOS',
  },
  {
    id: '2',
    type: 'bid_submitted',
    title: 'Submitted proposal',
    description: 'Proposal for "Senior React Developer" job',
    timestamp: '2024-03-15 14:45:00',
    metadata: { jobId: 'job-123', bidAmount: 5000 },
  },
  {
    id: '3',
    type: 'message_sent',
    title: 'Sent message',
    description: 'Message to Sarah Client regarding project scope',
    timestamp: '2024-03-15 15:10:00',
    metadata: { recipientId: 'user-456', threadId: 'thread-789' },
  },
  {
    id: '4',
    type: 'contract_completed',
    title: 'Contract completed',
    description: 'Contract #12345 marked as complete',
    timestamp: '2024-03-14 16:00:00',
    metadata: { contractId: 'contract-12345', amount: 7500 },
  },
  {
    id: '5',
    type: 'payment_received',
    title: 'Payment received',
    description: 'Received $7,125 for completed milestone',
    timestamp: '2024-03-14 16:05:00',
    metadata: { amount: 7125, currency: 'USD', transactionId: 'txn-abc123' },
  },
  {
    id: '6',
    type: 'profile_update',
    title: 'Profile updated',
    description: 'Updated skills and hourly rate',
    timestamp: '2024-03-13 10:20:00',
    metadata: { changedFields: ['skills', 'hourlyRate'] },
  },
  {
    id: '7',
    type: 'verification_approved',
    title: 'Identity verified',
    description: 'Identity verification approved by admin',
    timestamp: '2024-03-10 09:00:00',
    metadata: { verificationLevel: 'verified', approvedBy: 'admin-sarah' },
  },
  {
    id: '8',
    type: 'login',
    title: 'Logged in',
    description: 'Successful login via Google OAuth',
    timestamp: '2024-03-09 08:15:00',
    ipAddress: '10.0.0.50',
    location: 'San Francisco, CA',
    userAgent: 'Safari 17 on iOS',
  },
  {
    id: '9',
    type: 'contract_created',
    title: 'Contract started',
    description: 'Started contract for "E-commerce Platform Development"',
    timestamp: '2024-03-05 11:30:00',
    metadata: { contractId: 'contract-67890', value: 15000 },
  },
  {
    id: '10',
    type: 'logout',
    title: 'Logged out',
    description: 'Manual logout from session',
    timestamp: '2024-03-04 18:00:00',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityIcon(type: ActivityType) {
  const icons: Record<ActivityType, typeof LogIn> = {
    login: LogIn,
    logout: LogOut,
    profile_update: Edit,
    bid_submitted: FileText,
    contract_created: Briefcase,
    contract_completed: CheckCircle,
    payment_received: DollarSign,
    payment_sent: DollarSign,
    message_sent: MessageSquare,
    verification_submitted: Shield,
    verification_approved: CheckCircle,
    verification_rejected: XCircle,
    support_ticket: MessageSquare,
  };

  return icons[type] || FileText;
}

function getActivityColor(type: ActivityType) {
  const colors: Record<ActivityType, string> = {
    login: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    logout: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    profile_update: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    bid_submitted: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    contract_created: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    contract_completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    payment_received:
      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    payment_sent: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    message_sent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    verification_submitted:
      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    verification_approved: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    verification_rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    support_ticket: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return colors[type] || 'bg-gray-100 text-gray-600';
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItemRow({
  activity,
  isExpanded,
  onToggle,
}: Readonly<{
  activity: ActivityItem;
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  const Icon = getActivityIcon(activity.type);
  const colorClass = getActivityColor(activity.type);

  return (
    <div className="border-b border-gray-200 last:border-0 dark:border-gray-700">
      <button
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggle}
      >
        {/* Icon */}
        <div className={`rounded-full p-2 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
            <span className="text-sm text-gray-500">{activity.timestamp}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
        </div>

        {/* Expand Arrow */}
        {(activity.metadata || activity.ipAddress) && (
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && (activity.metadata || activity.ipAddress) && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {activity.ipAddress && (
              <div>
                <span className="text-gray-500">IP Address:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-white">
                  {activity.ipAddress}
                </span>
              </div>
            )}
            {activity.location && (
              <div>
                <span className="text-gray-500">Location:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{activity.location}</span>
              </div>
            )}
            {activity.userAgent && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Device:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{activity.userAgent}</span>
              </div>
            )}
            {activity.metadata &&
              Object.entries(activity.metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500">{key}:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserActivityLog({
  userId,
  activities = MOCK_ACTIVITIES,
}: Readonly<UserActivityLogProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ActivityType | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activityTypes: { value: ActivityType; label: string }[] = [
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'profile_update', label: 'Profile Updates' },
    { value: 'bid_submitted', label: 'Bids/Proposals' },
    { value: 'contract_created', label: 'Contracts Created' },
    { value: 'contract_completed', label: 'Contracts Completed' },
    { value: 'payment_received', label: 'Payments Received' },
    { value: 'payment_sent', label: 'Payments Sent' },
    { value: 'message_sent', label: 'Messages' },
    { value: 'verification_submitted', label: 'Verifications' },
    { value: 'support_ticket', label: 'Support Tickets' },
  ];

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      !searchQuery ||
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !filterType || activity.type === filterType;

    return matchesSearch && matchesType;
  });

  const handleExport = () => {
    // Export activity log as CSV
    console.log('Exporting activity log for user:', userId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h3>
        <button className="admin-btn-secondary" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="admin-input pl-10"
              placeholder="Search activity..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <button className="admin-btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Activity Type
              </label>
              <select
                className="admin-input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ActivityType | '')}
              >
                <option value="">All Types</option>
                {activityTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input className="admin-input" type="date" />
                <span className="text-gray-400">to</span>
                <input className="admin-input" type="date" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {filteredActivities.length > 0 ? (
          filteredActivities.map((activity) => (
            <ActivityItemRow
              key={activity.id}
              activity={activity}
              isExpanded={expandedId === activity.id}
              onToggle={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
            />
          ))
        ) : (
          <div className="py-12 text-center">
            <p className="text-gray-500">No activity found matching your filters</p>
          </div>
        )}
      </div>

      {/* Load More */}
      {filteredActivities.length > 0 && (
        <div className="text-center">
          <button className="admin-btn-secondary">Load More Activity</button>
        </div>
      )}
    </div>
  );
}

export default UserActivityLog;
