/**
 * User Detail Page
 *
 * Comprehensive view of a single user with tabs for profile, activity,
 * contracts, payments, disputes, and admin notes.
 *
 * @module app/users/[userId]/page
 */

'use client';

import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Star,
  Briefcase,
  DollarSign,
  Scale,
  MessageSquare,
  Ban,
  UserX,
  RotateCcw,
  Key,
  LogOut,
  Trash2,
  Edit,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  type: 'freelancer' | 'client' | 'both';
  status: 'active' | 'suspended' | 'banned' | 'pending';
  verification: {
    level: 'none' | 'basic' | 'verified' | 'premium';
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    addressVerified: boolean;
  };
  joinedAt: string;
  lastActive: string;
  trustScore: number;
  bio?: string;
  skills?: string[];
  hourlyRate?: number;
  currency?: string;
}

interface TrustScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  factors: string[];
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_USER: UserProfile = {
  id: '1',
  name: 'John Developer',
  email: 'john@example.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  type: 'freelancer',
  status: 'active',
  verification: {
    level: 'verified',
    emailVerified: true,
    phoneVerified: true,
    identityVerified: true,
    addressVerified: false,
  },
  joinedAt: 'January 15, 2024',
  lastActive: '2 hours ago',
  trustScore: 92,
  bio: 'Full-stack developer with 10 years of experience. Specializing in React, Node.js, and cloud infrastructure.',
  skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL'],
  hourlyRate: 150,
  currency: 'USD',
};

const TRUST_BREAKDOWN: TrustScoreBreakdown[] = [
  {
    category: 'Account History',
    score: 25,
    maxScore: 25,
    factors: ['Account age > 1 year', 'No previous suspensions'],
  },
  {
    category: 'Verification',
    score: 20,
    maxScore: 25,
    factors: ['Identity verified', 'Email verified', 'Phone verified', 'Address pending'],
  },
  {
    category: 'Transaction History',
    score: 22,
    maxScore: 25,
    factors: ['50+ completed contracts', 'No chargebacks', 'On-time delivery 95%'],
  },
  {
    category: 'Reputation',
    score: 25,
    maxScore: 25,
    factors: ['4.9 average rating', 'Zero disputes lost', 'Client repeat rate 40%'],
  },
];

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ user }: Readonly<{ user: UserProfile }>) {
  return (
    <div className="space-y-6">
      {/* Bio */}
      {user.bio && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Bio</h3>
          <p className="text-gray-900 dark:text-white">{user.bio}</p>
        </div>
      )}

      {/* Skills */}
      {user.skills && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {user.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          Contact Information
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Mail className="h-4 w-4 text-gray-400" />
            {user.email}
            {user.verification.emailVerified && <ShieldCheck className="h-4 w-4 text-green-500" />}
          </div>
          {user.phone && (
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Phone className="h-4 w-4 text-gray-400" />
              {user.phone}
              {user.verification.phoneVerified && (
                <ShieldCheck className="h-4 w-4 text-green-500" />
              )}
            </div>
          )}
          {user.location && (
            <div className="flex items-center gap-2 text-gray-900 dark:text-white">
              <MapPin className="h-4 w-4 text-gray-400" />
              {user.location}
            </div>
          )}
        </div>
      </div>

      {/* Rate */}
      {typeof user.hourlyRate === 'number' && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Hourly Rate</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ${user.hourlyRate}
            <span className="text-sm font-normal text-gray-500">/{user.currency}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const activities = [
    { time: '2 hours ago', action: 'Logged in', details: 'From San Francisco, CA' },
    { time: '5 hours ago', action: 'Submitted proposal', details: 'For "React Developer" job' },
    { time: '1 day ago', action: 'Contract completed', details: 'Contract #12345 marked complete' },
    { time: '2 days ago', action: 'Received payment', details: '$2,500 for milestone delivery' },
    { time: '3 days ago', action: 'Profile updated', details: 'Skills and bio modified' },
  ];

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={`${activity.time}-${activity.action}`}
          className="flex items-start gap-4 border-b border-gray-200 pb-4 last:border-0 dark:border-gray-700"
        >
          <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-700">
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">{activity.action}</p>
            <p className="text-sm text-gray-500">{activity.details}</p>
          </div>
          <span className="text-sm text-gray-400">{activity.time}</span>
        </div>
      ))}
    </div>
  );
}

function ContractsTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Active Contracts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">47</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Success Rate</p>
          <p className="text-2xl font-bold text-green-600">98%</p>
        </div>
      </div>
      <p className="text-center text-sm text-gray-500">
        <Link className="text-indigo-600 hover:underline" href="/contracts?user=1">
          View all contracts →
        </Link>
      </p>
    </div>
  );
}

function PaymentsTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Total Earned</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">$127,450</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Pending Payout</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">$3,500</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">This Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">$8,200</p>
        </div>
      </div>
      <p className="text-center text-sm text-gray-500">
        <Link className="text-indigo-600 hover:underline" href="/payments?user=1">
          View payment history →
        </Link>
      </p>
    </div>
  );
}

function DisputesTab() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Scale className="mb-4 h-12 w-12 text-gray-300" />
      <p className="text-gray-500">No disputes on record</p>
      <p className="text-sm text-gray-400">This user has never been involved in a dispute</p>
    </div>
  );
}

function AdminNotesTab() {
  const notes = [
    {
      id: '1',
      author: 'Admin Sarah',
      date: '2024-02-15',
      content: 'Verified identity manually after document review. All checks passed.',
    },
    {
      id: '2',
      author: 'Support Mike',
      date: '2024-01-20',
      content: 'User reported login issues. Reset 2FA after identity verification call.',
    },
  ];

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white">{note.author}</span>
            <span className="text-sm text-gray-500">{note.date}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{note.content}</p>
        </div>
      ))}
      <button className="admin-btn-secondary w-full">
        <Edit className="h-4 w-4" />
        Add Note
      </button>
    </div>
  );
}

// ============================================================================
// Sidebar Components
// ============================================================================

function TrustScoreSidebar({ breakdown }: Readonly<{ breakdown: TrustScoreBreakdown[] }>) {
  const totalScore = breakdown.reduce((sum, item) => sum + item.score, 0);
  const maxScore = breakdown.reduce((sum, item) => sum + item.maxScore, 0);

  return (
    <div className="admin-card">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Trust Score Breakdown</h3>
      <div className="mb-4 text-center">
        <span className="text-4xl font-bold text-green-600">{totalScore}</span>
        <span className="text-lg text-gray-400">/{maxScore}</span>
      </div>
      <div className="space-y-4">
        {breakdown.map((item) => (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{item.category}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {item.score}/{item.maxScore}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${(item.score / item.maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskIndicators() {
  const indicators = [
    { label: 'Suspicious IP', status: 'clear' },
    { label: 'Duplicate Account', status: 'clear' },
    { label: 'Chargeback History', status: 'clear' },
    { label: 'Spam Reports', status: 'clear' },
  ];

  return (
    <div className="admin-card">
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Risk Indicators</h3>
      <div className="space-y-2">
        {indicators.map((indicator) => (
          <div key={indicator.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{indicator.label}</span>
            <span className="admin-badge-success">Clear</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function UserDetailPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Briefcase },
    { id: 'activity', label: 'Activity Log', icon: Clock },
    { id: 'contracts', label: 'Contracts', icon: Briefcase },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'disputes', label: 'Disputes', icon: Scale },
    { id: 'notes', label: 'Admin Notes', icon: MessageSquare },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab user={MOCK_USER} />;
      case 'activity':
        return <ActivityTab />;
      case 'contracts':
        return <ContractsTab />;
      case 'payments':
        return <PaymentsTab />;
      case 'disputes':
        return <DisputesTab />;
      case 'notes':
        return <AdminNotesTab />;
      default:
        return <OverviewTab user={MOCK_USER} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        href="/users"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      {/* User Header */}
      <div className="admin-card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* User Info */}
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <span className="text-2xl font-bold">
                {MOCK_USER.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {MOCK_USER.name}
                </h1>
                <span className="admin-badge-success">Active</span>
                <span className="admin-badge-success flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <p className="text-gray-500">{MOCK_USER.email}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {MOCK_USER.joinedAt}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Active {MOCK_USER.lastActive}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  4.9 (127 reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button className="admin-btn-secondary">
              <Mail className="h-4 w-4" />
              Message
            </button>
            <a
              className="admin-btn-secondary"
              href={`/impersonate?user=${MOCK_USER.id}`}
              rel="noopener"
              target="_blank"
            >
              <ExternalLink className="h-4 w-4" />
              Impersonate
            </a>
            <button className="admin-btn-secondary text-yellow-600 hover:text-yellow-700">
              <UserX className="h-4 w-4" />
              Suspend
            </button>
            <button className="admin-btn-danger">
              <Ban className="h-4 w-4" />
              Ban
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tabs Content */}
        <div className="lg:col-span-2">
          <div className="admin-card">
            {/* Tab Navigation */}
            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {renderTabContent()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TrustScoreSidebar breakdown={TRUST_BREAKDOWN} />
          <RiskIndicators />

          {/* Admin Actions */}
          <div className="admin-card">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Admin Actions</h3>
            <div className="space-y-2">
              <button className="admin-btn-secondary w-full justify-start">
                <ShieldCheck className="h-4 w-4" />
                Verify Identity Manually
              </button>
              <button className="admin-btn-secondary w-full justify-start">
                <Key className="h-4 w-4" />
                Reset Password
              </button>
              <button className="admin-btn-secondary w-full justify-start">
                <LogOut className="h-4 w-4" />
                Force Logout All Sessions
              </button>
              <button className="admin-btn-secondary w-full justify-start">
                <RotateCcw className="h-4 w-4" />
                Merge Duplicate Account
              </button>
              <button className="admin-btn-secondary w-full justify-start text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
                Delete Account (GDPR)
              </button>
            </div>
          </div>

          {/* Related Accounts */}
          <div className="admin-card">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Related Accounts</h3>
            <p className="text-center text-sm text-gray-500">No related accounts found</p>
          </div>
        </div>
      </div>
    </div>
  );
}
