'use client';

import { cn } from '@skillancer/ui';
import {
  Award,
  Shield,
  Search,
  Grid3X3,
  List,
  Calendar,
  Download,
  Share2,
  Clock,
  BadgeCheck,
  ChevronRight,
  TrendingUp,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Mock credentials data
const credentials = [
  {
    id: 'cred-1',
    name: 'Advanced React Developer',
    issueDate: '2024-01-15',
    expiryDate: '2027-01-15',
    status: 'active',
    score: 92,
    percentile: 95,
    skills: ['React', 'Redux', 'TypeScript', 'Testing'],
    verificationCode: 'SKILL-RCT-2024-92847',
    badge: '🏆',
    category: 'Frontend',
    level: 'Advanced',
  },
  {
    id: 'cred-2',
    name: 'Node.js Professional',
    issueDate: '2024-02-20',
    expiryDate: '2027-02-20',
    status: 'active',
    score: 88,
    percentile: 90,
    skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs'],
    verificationCode: 'SKILL-NOD-2024-38291',
    badge: '🎯',
    category: 'Backend',
    level: 'Professional',
  },
  {
    id: 'cred-3',
    name: 'AWS Cloud Practitioner',
    issueDate: '2023-08-10',
    expiryDate: '2026-08-10',
    status: 'active',
    score: 85,
    percentile: 82,
    skills: ['AWS', 'Cloud Architecture', 'S3', 'EC2', 'Lambda'],
    verificationCode: 'SKILL-AWS-2023-18374',
    badge: '☁️',
    category: 'Cloud',
    level: 'Practitioner',
  },
  {
    id: 'cred-4',
    name: 'Python Data Science',
    issueDate: '2023-05-05',
    expiryDate: '2024-05-05',
    status: 'expiring-soon',
    score: 78,
    percentile: 75,
    skills: ['Python', 'Pandas', 'NumPy', 'Machine Learning'],
    verificationCode: 'SKILL-PDS-2023-92837',
    badge: '📊',
    category: 'Data Science',
    level: 'Intermediate',
  },
  {
    id: 'cred-5',
    name: 'JavaScript Fundamentals',
    issueDate: '2022-12-01',
    expiryDate: '2023-12-01',
    status: 'expired',
    score: 82,
    percentile: 70,
    skills: ['JavaScript', 'ES6+', 'DOM', 'Async'],
    verificationCode: 'SKILL-JSF-2022-47281',
    badge: '📜',
    category: 'Frontend',
    level: 'Fundamentals',
  },
];

const categories = ['All', 'Frontend', 'Backend', 'Cloud', 'Data Science', 'DevOps'];

export default function CredentialsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>(
    'all'
  );

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch =
      cred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || cred.category === selectedCategory;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && cred.status === 'active') ||
      (filterStatus === 'expiring' && cred.status === 'expiring-soon') ||
      (filterStatus === 'expired' && cred.status === 'expired');

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: credentials.length,
    active: credentials.filter((c) => c.status === 'active').length,
    expiringSoon: credentials.filter((c) => c.status === 'expiring-soon').length,
    expired: credentials.filter((c) => c.status === 'expired').length,
    avgScore: Math.round(credentials.reduce((sum, c) => sum + c.score, 0) / credentials.length),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            <BadgeCheck className="h-3 w-3" />
            Active
          </span>
        );
      case 'expiring-soon':
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            Expiring Soon
          </span>
        );
      case 'expired':
        return (
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
                <Award className="h-8 w-8 text-indigo-600" />
                My Credentials
              </h1>
              <p className="mt-1 text-gray-600">
                Your verified skill credentials and professional certifications
              </p>
            </div>
            <Link
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              href="/assessments"
            >
              <Target className="h-4 w-4" />
              Earn More Credentials
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-5 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-500">Total Credentials</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  <p className="text-sm text-gray-500">Active</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.expiringSoon}</p>
                  <p className="text-sm text-gray-500">Expiring Soon</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                  <p className="text-sm text-gray-500">Expired</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.avgScore}%</p>
                  <p className="text-sm text-gray-500">Avg Score</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-64 rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500"
                placeholder="Search credentials..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    selectedCategory === cat
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center rounded-lg bg-gray-100 p-1">
              <button
                className={cn(
                  'rounded-lg p-2',
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'
                )}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  'rounded-lg p-2',
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'
                )}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Credentials Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCredentials.map((credential) => (
              <Link
                key={credential.id}
                className={cn(
                  'overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-lg',
                  credential.status === 'expired' && 'opacity-75'
                )}
                href={`/credentials/${credential.id}`}
              >
                {/* Card Header */}
                <div className="border-b border-gray-100 p-6">
                  <div className="mb-3 flex items-start justify-between">
                    <span className="text-3xl">{credential.badge}</span>
                    {getStatusBadge(credential.status)}
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">{credential.name}</h3>
                  <p className="text-sm text-gray-500">
                    {credential.category} • {credential.level}
                  </p>
                </div>

                {/* Score & Stats */}
                <div className="grid grid-cols-3 gap-4 bg-gray-50 px-6 py-4 text-center">
                  <div>
                    <p className="text-xl font-bold text-gray-900">{credential.score}%</p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-indigo-600">
                      Top {100 - credential.percentile}%
                    </p>
                    <p className="text-xs text-gray-500">Percentile</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{credential.skills.length}</p>
                    <p className="text-xs text-gray-500">Skills</p>
                  </div>
                </div>

                {/* Skills */}
                <div className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {credential.skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill}
                        className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                      >
                        {skill}
                      </span>
                    ))}
                    {credential.skills.length > 3 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{credential.skills.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500">
                  <span>Issued: {new Date(credential.issueDate).toLocaleDateString()}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCredentials.map((credential) => (
              <Link
                key={credential.id}
                className={cn(
                  'flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-lg',
                  credential.status === 'expired' && 'opacity-75'
                )}
                href={`/credentials/${credential.id}`}
              >
                <span className="text-3xl">{credential.badge}</span>

                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{credential.name}</h3>
                    {getStatusBadge(credential.status)}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {credential.category} • {credential.level} • Issued{' '}
                    {new Date(credential.issueDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-center">
                  <div>
                    <p className="font-bold text-gray-900">{credential.score}%</p>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                  <div>
                    <p className="font-bold text-indigo-600">Top {100 - credential.percentile}%</p>
                    <p className="text-xs text-gray-500">Percentile</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={(e) => {
                      e.preventDefault();
                      // Share action
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={(e) => {
                      e.preventDefault();
                      // Download action
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredCredentials.length === 0 && (
          <div className="py-16 text-center">
            <Award className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No credentials found</h3>
            <p className="mb-6 text-gray-500">
              {searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your filters'
                : 'Start earning credentials by taking skill assessments'}
            </p>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              href="/assessments"
            >
              Browse Assessments
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
