/**
 * Executive Function Tools Dashboard
 *
 * Tools for assessing and improving executive functions:
 * - Self-assessment
 * - Goal setting and tracking
 * - Strategies and interventions
 */

'use client';

import {
  Brain,
  Target,
  Clock,
  Heart,
  Eye,
  PlayCircle,
  RefreshCw,
  Folder,
  Map,
  PauseCircle,
  ChevronRight,
  Plus,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface ExecutiveFunctionArea {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  score?: number;
  status: 'strength' | 'typical' | 'challenge';
}

interface Goal {
  id: string;
  title: string;
  targetArea: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'PAUSED';
  targetDate?: string;
}

interface CheckIn {
  id: string;
  goalTitle: string;
  progress: number;
  date: string;
}

// =============================================================================
// Mock Data
// =============================================================================

const executiveFunctionAreas: ExecutiveFunctionArea[] = [
  {
    id: 'INHIBITION',
    name: 'Inhibition',
    description: 'Response control and impulse management',
    icon: <PauseCircle className="h-5 w-5" />,
    color: '#EF4444',
    score: 72,
    status: 'typical',
  },
  {
    id: 'WORKING_MEMORY',
    name: 'Working Memory',
    description: 'Holding and manipulating information',
    icon: <Brain className="h-5 w-5" />,
    color: '#8B5CF6',
    score: 85,
    status: 'strength',
  },
  {
    id: 'COGNITIVE_FLEXIBILITY',
    name: 'Cognitive Flexibility',
    description: 'Shifting between tasks and perspectives',
    icon: <RefreshCw className="h-5 w-5" />,
    color: '#10B981',
    score: 68,
    status: 'typical',
  },
  {
    id: 'PLANNING',
    name: 'Planning',
    description: 'Creating roadmaps to reach goals',
    icon: <Map className="h-5 w-5" />,
    color: '#3B82F6',
    score: 78,
    status: 'typical',
  },
  {
    id: 'ORGANIZATION',
    name: 'Organization',
    description: 'Keeping track of information and belongings',
    icon: <Folder className="h-5 w-5" />,
    color: '#F59E0B',
    score: 55,
    status: 'challenge',
  },
  {
    id: 'TIME_MANAGEMENT',
    name: 'Time Management',
    description: 'Estimating and tracking time effectively',
    icon: <Clock className="h-5 w-5" />,
    color: '#EC4899',
    score: 62,
    status: 'challenge',
  },
  {
    id: 'SELF_MONITORING',
    name: 'Self-Monitoring',
    description: 'Observing and evaluating your own behavior',
    icon: <Eye className="h-5 w-5" />,
    color: '#14B8A6',
    score: 75,
    status: 'typical',
  },
  {
    id: 'EMOTIONAL_CONTROL',
    name: 'Emotional Control',
    description: 'Managing emotional responses',
    icon: <Heart className="h-5 w-5" />,
    color: '#F43F5E',
    score: 80,
    status: 'strength',
  },
  {
    id: 'TASK_INITIATION',
    name: 'Task Initiation',
    description: 'Beginning tasks without procrastination',
    icon: <PlayCircle className="h-5 w-5" />,
    color: '#6366F1',
    score: 58,
    status: 'challenge',
  },
  {
    id: 'SUSTAINED_ATTENTION',
    name: 'Sustained Attention',
    description: 'Maintaining focus over time',
    icon: <Target className="h-5 w-5" />,
    color: '#0EA5E9',
    score: 70,
    status: 'typical',
  },
];

const activeGoals: Goal[] = [
  {
    id: '1',
    title: 'Improve task initiation with morning routine',
    targetArea: 'TASK_INITIATION',
    progress: 45,
    status: 'IN_PROGRESS',
    targetDate: '2026-02-15',
  },
  {
    id: '2',
    title: 'Develop organization system for documents',
    targetArea: 'ORGANIZATION',
    progress: 30,
    status: 'IN_PROGRESS',
    targetDate: '2026-02-01',
  },
  {
    id: '3',
    title: 'Practice time estimation for meetings',
    targetArea: 'TIME_MANAGEMENT',
    progress: 65,
    status: 'IN_PROGRESS',
    targetDate: '2026-01-31',
  },
];

const recentCheckIns: CheckIn[] = [
  { id: '1', goalTitle: 'Practice time estimation', progress: 65, date: '2026-01-12' },
  { id: '2', goalTitle: 'Improve task initiation', progress: 45, date: '2026-01-11' },
  { id: '3', goalTitle: 'Organization system', progress: 30, date: '2026-01-10' },
];

// =============================================================================
// Components
// =============================================================================

function AssessmentOverview() {
  const overallScore = Math.round(
    executiveFunctionAreas.reduce((sum, a) => sum + (a.score ?? 0), 0) / executiveFunctionAreas.length
  );

  const strengths = executiveFunctionAreas.filter((a) => a.status === 'strength');
  const challenges = executiveFunctionAreas.filter((a) => a.status === 'challenge');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Executive Function Profile
          </h2>
          <p className="text-sm text-gray-500">Last assessed: January 10, 2026</p>
        </div>
        <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          Take New Assessment
        </button>
      </div>

      <div className="mt-6 flex items-center gap-8">
        {/* Overall Score */}
        <div className="text-center">
          <div className="relative mx-auto h-28 w-28">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray={`${overallScore * 2.83} 283`}
                className="text-blue-600"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{overallScore}</span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">Overall Score</p>
        </div>

        {/* Strengths & Challenges */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Strengths</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {strengths.map((area) => (
                <span
                  key={area.id}
                  className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  {area.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Areas for Growth</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {challenges.map((area) => (
                <span
                  key={area.id}
                  className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                >
                  {area.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaCard({ area }: { area: ExecutiveFunctionArea }) {
  const statusColors = {
    strength: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20',
    typical: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    challenge: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20',
  };

  return (
    <div
      className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${statusColors[area.status]}`}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${area.color}20`, color: area.color }}
        >
          {area.icon}
        </div>
        {area.score !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-sm font-medium ${
              area.status === 'strength'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                : area.status === 'challenge'
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {area.score}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-medium text-gray-900 dark:text-white">{area.name}</h3>
      <p className="mt-1 text-xs text-gray-500">{area.description}</p>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const areaInfo = executiveFunctionAreas.find((a) => a.id === goal.targetArea);

  const statusColors = {
    NOT_STARTED: 'text-gray-500',
    IN_PROGRESS: 'text-blue-600',
    ACHIEVED: 'text-green-600',
    PAUSED: 'text-yellow-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${areaInfo?.color}20`, color: areaInfo?.color }}
          >
            {areaInfo?.icon}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{goal.title}</h4>
            <p className="mt-1 text-xs text-gray-500">{areaInfo?.name}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className={statusColors[goal.status]}>{goal.status.replace('_', ' ')}</span>
          <span className="text-gray-500">{goal.progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        {goal.targetDate && (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Target: {new Date(goal.targetDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivity() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="font-semibold text-gray-900 dark:text-white">Recent Check-ins</h3>
      <div className="mt-4 space-y-3">
        {recentCheckIns.map((checkIn) => (
          <div
            key={checkIn.id}
            className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{checkIn.goalTitle}</p>
              <p className="text-xs text-gray-500">{new Date(checkIn.date).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {checkIn.progress}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function ExecutiveFunctionPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Executive Function Tools
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Assess, track, and improve your cognitive skills
            </p>
          </div>
        </div>
      </div>

      {/* Assessment Overview */}
      <AssessmentOverview />

      {/* Main Content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left Column - Areas Grid */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Executive Function Areas
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {executiveFunctionAreas.map((area) => (
              <AreaCard key={area.id} area={area} />
            ))}
          </div>
        </div>

        {/* Right Column - Goals & Activity */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Goals</h3>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>

          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
