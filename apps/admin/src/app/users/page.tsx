/**
 * Users List Page
 *
 * Search, filter, and manage platform users with bulk actions.
 *
 * @module app/users/page
 */

'use client';

import {
  Search,
  Filter,
  Download,
  MoreVertical,
  Eye,
  UserX,
  Ban,
  Mail,
  Shield,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  type: 'freelancer' | 'client' | 'both';
  status: 'active' | 'suspended' | 'banned' | 'pending';
  verification: 'none' | 'basic' | 'verified' | 'premium';
  joinedAt: string;
  lastActive: string;
  trustScore: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'John Developer',
    email: 'john@example.com',
    type: 'freelancer',
    status: 'active',
    verification: 'verified',
    joinedAt: '2024-01-15',
    lastActive: '2 hours ago',
    trustScore: 92,
  },
  {
    id: '2',
    name: 'Sarah Client',
    email: 'sarah@company.com',
    type: 'client',
    status: 'active',
    verification: 'premium',
    joinedAt: '2023-11-20',
    lastActive: '5 minutes ago',
    trustScore: 98,
  },
  {
    id: '3',
    name: 'Mike Designer',
    email: 'mike@studio.io',
    type: 'freelancer',
    status: 'suspended',
    verification: 'basic',
    joinedAt: '2024-02-10',
    lastActive: '3 days ago',
    trustScore: 45,
  },
  {
    id: '4',
    name: 'Emily Manager',
    email: 'emily@corp.net',
    type: 'both',
    status: 'active',
    verification: 'verified',
    joinedAt: '2023-08-05',
    lastActive: '1 hour ago',
    trustScore: 88,
  },
  {
    id: '5',
    name: 'Spam Account',
    email: 'spam123@fake.com',
    type: 'freelancer',
    status: 'banned',
    verification: 'none',
    joinedAt: '2024-03-01',
    lastActive: '2 weeks ago',
    trustScore: 5,
  },
];

// ============================================================================
// Helper Components
// ============================================================================

function getStatusBadge(status: User['status']) {
  const styles = {
    active: 'admin-badge-success',
    suspended: 'admin-badge-warning',
    banned: 'admin-badge-danger',
    pending: 'admin-badge-info',
  };

  return <span className={styles[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function getVerificationBadge(verification: User['verification']) {
  const config = {
    none: { style: 'admin-badge-gray', icon: Shield, label: 'Unverified' },
    basic: { style: 'admin-badge-info', icon: Shield, label: 'Basic' },
    verified: { style: 'admin-badge-success', icon: ShieldCheck, label: 'Verified' },
    premium: {
      style: 'admin-badge bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      icon: ShieldCheck,
      label: 'Premium',
    },
  };

  const { style, icon: Icon, label } = config[verification];

  return (
    <span className={`${style} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function getTrustScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

// ============================================================================
// Main Component
// ============================================================================

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const toggleSelectAll = () => {
    if (selectedUsers.length === MOCK_USERS.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(MOCK_USERS.map((u) => u.id));
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage platform users, verify identities, and handle account issues
          </p>
        </div>
        <button className="admin-btn-secondary">
          <Download className="h-4 w-4" />
          Export Users
        </button>
      </div>

      {/* Search and Filters */}
      <div className="admin-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="admin-input pl-10"
              placeholder="Search by name, email, or ID..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <button className="admin-btn-secondary" onClick={() => setFilterOpen(!filterOpen)}>
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Expanded Filters */}
        {filterOpen && (
          <div className="mt-4 grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700">
            <div>
              <label
                htmlFor="filter-user-type"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                User Type
              </label>
              <select id="filter-user-type" className="admin-input">
                <option value="">All Types</option>
                <option value="freelancer">Freelancer</option>
                <option value="client">Client</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-status"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Status
              </label>
              <select id="filter-status" className="admin-input">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-verification"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Verification
              </label>
              <select id="filter-verification" className="admin-input">
                <option value="">All Levels</option>
                <option value="none">Unverified</option>
                <option value="basic">Basic</option>
                <option value="verified">Verified</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-date-range"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Date Range
              </label>
              <select id="filter-date-range" className="admin-input">
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/20">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {selectedUsers.length} users selected
          </span>
          <div className="flex gap-2">
            <button className="admin-btn-secondary text-xs">
              <Mail className="h-3 w-3" />
              Send Email
            </button>
            <button className="admin-btn-secondary text-xs">
              <UserX className="h-3 w-3" />
              Suspend
            </button>
            <button className="admin-btn-danger text-xs">
              <Ban className="h-3 w-3" />
              Ban
            </button>
          </div>
          <button
            className="ml-auto text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            onClick={() => setSelectedUsers([])}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="admin-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-12">
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 dark:border-gray-600"
                    onClick={toggleSelectAll}
                  >
                    {selectedUsers.length === MOCK_USERS.length && (
                      <Check className="h-3 w-3 text-indigo-600" />
                    )}
                  </button>
                </th>
                <th>User</th>
                <th>Type</th>
                <th>Status</th>
                <th>Verification</th>
                <th>Trust Score</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th className="w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        selectedUsers.includes(user.id)
                          ? 'border-indigo-600 bg-indigo-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      onClick={() => toggleSelectUser(user.id)}
                    >
                      {selectedUsers.includes(user.id) && <Check className="h-3 w-3 text-white" />}
                    </button>
                  </td>
                  <td>
                    <Link
                      className="flex items-center gap-3 hover:text-indigo-600"
                      href={`/users/${user.id}`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="capitalize">{user.type}</td>
                  <td>{getStatusBadge(user.status)}</td>
                  <td>{getVerificationBadge(user.verification)}</td>
                  <td>
                    <span className={`font-medium ${getTrustScoreColor(user.trustScore)}`}>
                      {user.trustScore}
                    </span>
                  </td>
                  <td className="text-gray-500">{user.joinedAt}</td>
                  <td className="text-gray-500">{user.lastActive}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        href={`/users/${user.id}`}
                        title="View user"
                      >
                        <Eye className="h-4 w-4 text-gray-500" />
                      </Link>
                      <button
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="More actions"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium">1</span> to <span className="font-medium">5</span>{' '}
            of <span className="font-medium">12,847</span> users
          </p>
          <div className="flex items-center gap-2">
            <button disabled className="admin-btn-secondary">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button className="admin-btn-secondary">
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
