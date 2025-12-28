'use client';

import { cn } from '@skillancer/ui';
import {
  ClipboardCheck,
  Search,
  Clock,
  Award,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calendar,
  ChevronRight,
  BarChart3,
  Target,
  Star,
  Grid,
  List,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Mock data
const assessmentCategories = [
  { id: 'frontend', name: 'Frontend Development', count: 12 },
  { id: 'backend', name: 'Backend Development', count: 8 },
  { id: 'cloud', name: 'Cloud & DevOps', count: 15 },
  { id: 'data', name: 'Data & Analytics', count: 10 },
  { id: 'mobile', name: 'Mobile Development', count: 6 },
  { id: 'design', name: 'UI/UX Design', count: 5 },
];

const availableAssessments = [
  {
    id: 'react-advanced',
    title: 'React Advanced Patterns',
    category: 'Frontend Development',
    difficulty: 'Advanced',
    duration: '60 min',
    questions: 40,
    passingScore: 75,
    enrolled: 2340,
    avgScore: 72,
    skills: ['React', 'TypeScript', 'Performance'],
    badge: '🏆',
  },
  {
    id: 'aws-solutions',
    title: 'AWS Solutions Architect',
    category: 'Cloud & DevOps',
    difficulty: 'Advanced',
    duration: '90 min',
    questions: 65,
    passingScore: 72,
    enrolled: 5620,
    avgScore: 68,
    skills: ['AWS', 'Cloud Architecture', 'Security'],
    badge: '☁️',
  },
  {
    id: 'nodejs-core',
    title: 'Node.js Core Concepts',
    category: 'Backend Development',
    difficulty: 'Intermediate',
    duration: '45 min',
    questions: 35,
    passingScore: 70,
    enrolled: 3890,
    avgScore: 74,
    skills: ['Node.js', 'JavaScript', 'APIs'],
    badge: '🟢',
  },
  {
    id: 'typescript-fundamentals',
    title: 'TypeScript Fundamentals',
    category: 'Frontend Development',
    difficulty: 'Beginner',
    duration: '30 min',
    questions: 25,
    passingScore: 70,
    enrolled: 8920,
    avgScore: 78,
    skills: ['TypeScript', 'JavaScript'],
    badge: '📘',
  },
  {
    id: 'docker-kubernetes',
    title: 'Docker & Kubernetes',
    category: 'Cloud & DevOps',
    difficulty: 'Intermediate',
    duration: '60 min',
    questions: 45,
    passingScore: 70,
    enrolled: 4210,
    avgScore: 69,
    skills: ['Docker', 'Kubernetes', 'DevOps'],
    badge: '🐳',
  },
  {
    id: 'python-data',
    title: 'Python for Data Science',
    category: 'Data & Analytics',
    difficulty: 'Intermediate',
    duration: '75 min',
    questions: 50,
    passingScore: 70,
    enrolled: 6540,
    avgScore: 71,
    skills: ['Python', 'Pandas', 'NumPy'],
    badge: '🐍',
  },
];

const myHistory = [
  {
    id: '1',
    assessmentId: 'react-advanced',
    title: 'React Advanced Patterns',
    status: 'passed',
    score: 85,
    date: '2024-01-15',
    credentialId: 'cred-1',
  },
  {
    id: '2',
    assessmentId: 'nodejs-core',
    title: 'Node.js Core Concepts',
    status: 'passed',
    score: 78,
    date: '2024-01-10',
    credentialId: 'cred-2',
  },
  {
    id: '3',
    assessmentId: 'aws-solutions',
    title: 'AWS Solutions Architect',
    status: 'failed',
    score: 65,
    date: '2024-01-05',
    retakeAvailable: '2024-02-05',
  },
];

const stats = {
  passed: 5,
  failed: 2,
  pending: 1,
  avgScore: 76,
  totalCredentials: 5,
  topPercentile: 15,
};

export default function AssessmentsPage() {
  const [activeTab, setActiveTab] = useState<'available' | 'history' | 'upcoming'>('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredAssessments = availableAssessments.filter((assessment) => {
    const matchesSearch =
      assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assessment.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || assessment.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || assessment.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-700';
      case 'Advanced':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-2 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Assessment Center</h1>
          </div>
          <p className="max-w-2xl text-white/80">
            Verify your skills through proctored assessments and earn credentials that set you apart
            in the marketplace
          </p>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm text-white/70">Passed</span>
              </div>
              <p className="text-2xl font-bold">{stats.passed}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                <span className="text-sm text-white/70">Failed</span>
              </div>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                <span className="text-sm text-white/70">Pending Retake</span>
              </div>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm text-white/70">Avg Score</span>
              </div>
              <p className="text-2xl font-bold">{stats.avgScore}%</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span className="text-sm text-white/70">Credentials</span>
              </div>
              <p className="text-2xl font-bold">{stats.totalCredentials}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm text-white/70">Top Percentile</span>
              </div>
              <p className="text-2xl font-bold">{stats.topPercentile}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              {[
                { id: 'available', label: 'Available Assessments', icon: ClipboardCheck },
                { id: 'history', label: 'My History', icon: Clock },
                { id: 'upcoming', label: 'Scheduled', icon: Calendar },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={cn(
                    'flex items-center gap-2 border-b-2 py-4 font-medium transition-colors',
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
                <button
                  className={cn('rounded p-1.5', viewMode === 'grid' ? 'bg-white shadow-sm' : '')}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  className={cn('rounded p-1.5', viewMode === 'list' ? 'bg-white shadow-sm' : '')}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'available' && (
          <div className="flex gap-6">
            {/* Filters Sidebar */}
            <div className="w-64 shrink-0 space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search assessments..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Categories */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 font-medium text-gray-900">Categories</h3>
                <div className="space-y-1">
                  <button
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedCategory ? 'hover:bg-gray-50' : 'bg-indigo-50 text-indigo-700'
                    )}
                    onClick={() => setSelectedCategory(null)}
                  >
                    All Categories
                  </button>
                  {assessmentCategories.map((cat) => (
                    <button
                      key={cat.id}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                        selectedCategory === cat.name
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-gray-50'
                      )}
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      {cat.name}
                      <span className="text-gray-400">{cat.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 font-medium text-gray-900">Difficulty</h3>
                <div className="space-y-1">
                  {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                    <button
                      key={diff}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        selectedDifficulty === diff
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-gray-50'
                      )}
                      onClick={() =>
                        setSelectedDifficulty(selectedDifficulty === diff ? null : diff)
                      }
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Assessments Grid */}
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {filteredAssessments.length} assessments available
                </p>
              </div>

              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
                    : 'space-y-3'
                )}
              >
                {filteredAssessments.map((assessment) => (
                  <Link
                    key={assessment.id}
                    className={cn(
                      'rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md',
                      viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-5'
                    )}
                    href={`/assessments/${assessment.id}`}
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <div className="mb-3 flex items-start justify-between">
                          <span className="text-3xl">{assessment.badge}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              getDifficultyColor(assessment.difficulty)
                            )}
                          >
                            {assessment.difficulty}
                          </span>
                        </div>
                        <h3 className="mb-1 font-semibold text-gray-900">{assessment.title}</h3>
                        <p className="mb-3 text-sm text-gray-500">{assessment.category}</p>

                        <div className="mb-3 flex flex-wrap gap-1">
                          {assessment.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="mb-3 grid grid-cols-2 gap-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {assessment.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {assessment.questions} Qs
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            {assessment.passingScore}% to pass
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5" />
                            Avg {assessment.avgScore}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                          <span className="text-xs text-gray-500">
                            {assessment.enrolled.toLocaleString()} taken
                          </span>
                          <span className="flex items-center gap-1 text-sm font-medium text-indigo-600">
                            Start
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">{assessment.badge}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900">{assessment.title}</h3>
                          <p className="text-sm text-gray-500">{assessment.category}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            getDifficultyColor(assessment.difficulty)
                          )}
                        >
                          {assessment.difficulty}
                        </span>
                        <div className="text-right text-sm text-gray-500">
                          <p>{assessment.duration}</p>
                          <p>{assessment.questions} questions</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Assessment History</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {myHistory.map((attempt) => (
                <div key={attempt.id} className="flex items-center gap-4 p-4">
                  {getStatusIcon(attempt.status)}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900">{attempt.title}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(attempt.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'font-semibold',
                        attempt.status === 'passed' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {attempt.score}%
                    </p>
                    {attempt.credentialId && (
                      <Link
                        className="text-sm text-indigo-600 hover:underline"
                        href={`/credentials/${attempt.credentialId}`}
                      >
                        View Credential
                      </Link>
                    )}
                    {attempt.retakeAvailable && (
                      <p className="text-sm text-gray-500">
                        Retake: {new Date(attempt.retakeAvailable).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                    href={`/assessments/${attempt.assessmentId}/results`}
                  >
                    View Results
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <h3 className="mb-1 text-lg font-medium text-gray-900">No Scheduled Assessments</h3>
            <p className="mb-4 text-gray-500">
              Schedule an assessment for a time that works best for you
            </p>
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              onClick={() => setActiveTab('available')}
            >
              Browse Assessments
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
