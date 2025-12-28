'use client';

import { cn } from '@skillancer/ui';
import {
  BookOpen,
  Target,
  TrendingUp,
  Award,
  Clock,
  ChevronRight,
  Play,
  Compass,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LearningStreak } from '@/components/learning/learning-streak';
import { RecommendationCarousel } from '@/components/learning/recommendation-carousel';
import { SkillHealthScore } from '@/components/learning/skill-health-score';

// Types
interface LearningPath {
  id: string;
  title: string;
  progress: number;
  totalItems: number;
  completedItems: number;
  estimatedTime: string;
  nextItem: {
    title: string;
    type: 'video' | 'assessment' | 'reading' | 'project';
    duration: string;
  };
}

interface SkillGap {
  id: string;
  skillName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  currentLevel: number;
  requiredLevel: number;
}

interface CompletedItem {
  id: string;
  title: string;
  type: 'course' | 'assessment' | 'certification';
  completedAt: string;
  score?: number;
}

interface MarketTrend {
  skillName: string;
  growth: number;
  demandLevel: 'high' | 'medium' | 'low';
  relevanceToUser: boolean;
}

// Mock data
const activePaths: LearningPath[] = [
  {
    id: '1',
    title: 'Full-Stack React Developer',
    progress: 65,
    totalItems: 24,
    completedItems: 16,
    estimatedTime: '8h remaining',
    nextItem: {
      title: 'Advanced State Management with Redux Toolkit',
      type: 'video',
      duration: '45 min',
    },
  },
  {
    id: '2',
    title: 'Cloud Architecture Fundamentals',
    progress: 30,
    totalItems: 18,
    completedItems: 5,
    estimatedTime: '15h remaining',
    nextItem: {
      title: 'AWS Lambda Deep Dive',
      type: 'reading',
      duration: '20 min',
    },
  },
];

const skillGapAlerts: SkillGap[] = [
  {
    id: '1',
    skillName: 'TypeScript',
    severity: 'critical',
    impact: 'Missing 45% of jobs in your field',
    currentLevel: 2,
    requiredLevel: 4,
  },
  {
    id: '2',
    skillName: 'Docker',
    severity: 'high',
    impact: 'Could increase rate by $15/hr',
    currentLevel: 1,
    requiredLevel: 3,
  },
];

const recentlyCompleted: CompletedItem[] = [
  {
    id: '1',
    title: 'React Performance Optimization',
    type: 'course',
    completedAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'JavaScript Advanced Patterns',
    type: 'assessment',
    completedAt: '2024-01-14',
    score: 92,
  },
  {
    id: '3',
    title: 'AWS Cloud Practitioner',
    type: 'certification',
    completedAt: '2024-01-12',
  },
];

const marketTrends: MarketTrend[] = [
  { skillName: 'AI/ML Integration', growth: 156, demandLevel: 'high', relevanceToUser: true },
  { skillName: 'Rust', growth: 89, demandLevel: 'high', relevanceToUser: false },
  { skillName: 'Next.js 14', growth: 67, demandLevel: 'high', relevanceToUser: true },
];

const severityColors = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const typeIcons = {
  video: Play,
  assessment: ClipboardCheck,
  reading: BookOpen,
  project: Target,
};

export default function LearnPage() {
  const [userName] = useState('Alex');
  const currentHour = new Date().getHours();
  const greeting = (() => {
    if (currentHour < 12) return 'Good morning';
    if (currentHour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">
                {greeting}, {userName}! 👋
              </h1>
              <p className="text-indigo-100">
                You&apos;re making great progress. Keep learning to unlock new opportunities!
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LearningStreak compact />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-200" />
                <span className="text-sm text-indigo-200">This Week</span>
              </div>
              <p className="text-2xl font-bold">12.5h</p>
              <p className="text-xs text-indigo-200">+3.2h vs last week</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-200" />
                <span className="text-sm text-indigo-200">Completed</span>
              </div>
              <p className="text-2xl font-bold">24</p>
              <p className="text-xs text-indigo-200">courses this month</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-200" />
                <span className="text-sm text-indigo-200">Credentials</span>
              </div>
              <p className="text-2xl font-bold">7</p>
              <p className="text-xs text-indigo-200">verified certifications</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-1 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-200" />
                <span className="text-sm text-indigo-200">Skills</span>
              </div>
              <p className="text-2xl font-bold">18</p>
              <p className="text-xs text-indigo-200">in your profile</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Quick Actions */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
            href="/learn/paths"
          >
            <Play className="h-4 w-4" />
            Continue Learning
          </Link>
          <Link
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
            href="/learn/skills"
          >
            <Compass className="h-4 w-4" />
            Explore New Skills
          </Link>
          <Link
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
            href="/learn/gaps"
          >
            <ClipboardCheck className="h-4 w-4" />
            Take Assessment
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Skill Gap Alerts */}
            {skillGapAlerts.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <h2 className="font-semibold text-gray-900">Skill Gap Alerts</h2>
                  </div>
                  <Link
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                    href="/learn/gaps"
                  >
                    View all gaps
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {skillGapAlerts.map((gap) => (
                    <div
                      key={gap.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-4',
                        severityColors[gap.severity]
                      )}
                    >
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-medium">{gap.skillName}</span>
                          <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs uppercase">
                            {gap.severity}
                          </span>
                        </div>
                        <p className="text-sm opacity-80">{gap.impact}</p>
                      </div>
                      <Link
                        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50"
                        href={`/learn/gaps/${gap.id}`}
                      >
                        Close Gap
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Learning Paths */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Active Learning Paths</h2>
                <Link
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  href="/learn/paths"
                >
                  View all paths
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-4">
                {activePaths.map((path) => {
                  const NextIcon = typeIcons[path.nextItem.type];
                  return (
                    <div key={path.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{path.title}</h3>
                          <p className="text-sm text-gray-500">
                            {path.completedItems}/{path.totalItems} completed • {path.estimatedTime}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-indigo-600">{path.progress}%</span>
                      </div>
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all"
                          style={{ width: `${path.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <NextIcon className="h-4 w-4" />
                          <span>Next: {path.nextItem.title}</span>
                          <span className="text-gray-400">• {path.nextItem.duration}</span>
                        </div>
                        <Link
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-700"
                          href={`/learn/paths/${path.id}`}
                        >
                          <Play className="h-3 w-3" />
                          Continue
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Recommendations */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold text-gray-900">Recommended For You</h2>
                </div>
                <Link
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  href="/learn/recommendations"
                >
                  See all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <RecommendationCarousel />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Skill Health Score */}
            <SkillHealthScore />

            {/* Market Trends Preview */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Trending Skills</h2>
                <Link
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  href="/learn/trends"
                >
                  View trends
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {marketTrends.map((trend) => (
                  <div key={trend.skillName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{trend.skillName}</span>
                      {trend.relevanceToUser && (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                          Relevant
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">+{trend.growth}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Completed */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recently Completed</h2>
                <Link
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  href="/learn/activity"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentlyCompleted.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div
                      className={cn(
                        'rounded-lg p-2',
                        item.type === 'course' && 'bg-blue-100',
                        item.type === 'assessment' && 'bg-purple-100',
                        item.type === 'certification' && 'bg-amber-100'
                      )}
                    >
                      {item.type === 'course' && <BookOpen className="h-4 w-4 text-blue-600" />}
                      {item.type === 'assessment' && (
                        <ClipboardCheck className="h-4 w-4 text-purple-600" />
                      )}
                      {item.type === 'certification' && (
                        <Award className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                        {item.score && <span>• Score: {item.score}%</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                <h2 className="font-semibold text-amber-900">Recent Achievement</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-3">
                  <Zap className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-900">Speed Learner</p>
                  <p className="text-sm text-amber-700">Completed 5 courses in one week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
