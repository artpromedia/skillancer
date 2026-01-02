'use client';

/**
 * AI Career Coach Page
 * Sprint M7: AI Work Assistant
 *
 * Provides personalized career guidance and insights
 */

import {
  Sparkles,
  TrendingUp,
  Target,
  Lightbulb,
  DollarSign,
  BarChart3,
  Clock,
  Award,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  RefreshCw,
  MessageCircle,
  BookOpen,
  Zap,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface CareerMetric {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: typeof TrendingUp;
}

interface CareerGoal {
  id: string;
  title: string;
  category: 'earnings' | 'skills' | 'clients' | 'rate';
  current: number;
  target: number;
  deadline: string;
  status: 'on_track' | 'behind' | 'ahead' | 'completed';
}

interface Recommendation {
  id: string;
  type: 'opportunity' | 'improvement' | 'warning' | 'tip';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionItems: string[];
}

interface CoachInsight {
  id: string;
  message: string;
  timestamp: Date;
  category: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const CAREER_METRICS: CareerMetric[] = [
  {
    label: 'Monthly Earnings',
    value: '$8,450',
    change: 12.5,
    trend: 'up',
    icon: DollarSign,
  },
  {
    label: 'Average Rate',
    value: '$75/hr',
    change: 8.3,
    trend: 'up',
    icon: TrendingUp,
  },
  {
    label: 'Active Projects',
    value: '4',
    change: 0,
    trend: 'neutral',
    icon: BarChart3,
  },
  {
    label: 'Hours This Month',
    value: '127',
    change: -5.2,
    trend: 'down',
    icon: Clock,
  },
];

const CAREER_GOALS: CareerGoal[] = [
  {
    id: '1',
    title: 'Reach $10k/month',
    category: 'earnings',
    current: 8450,
    target: 10000,
    deadline: '2025-03-31',
    status: 'on_track',
  },
  {
    id: '2',
    title: 'Increase hourly rate to $85',
    category: 'rate',
    current: 75,
    target: 85,
    deadline: '2025-06-30',
    status: 'on_track',
  },
  {
    id: '3',
    title: 'Get 3 new long-term clients',
    category: 'clients',
    current: 1,
    target: 3,
    deadline: '2025-04-30',
    status: 'behind',
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: '1',
    type: 'opportunity',
    title: 'Specialize in AI/ML Projects',
    description:
      'Based on your skills and market trends, specializing in AI/ML could increase your rate by 30-40%.',
    impact: 'high',
    actionItems: [
      'Complete 2 AI-focused courses',
      'Update portfolio with AI projects',
      'Target AI/ML job postings',
    ],
  },
  {
    id: '2',
    type: 'improvement',
    title: 'Improve Proposal Win Rate',
    description:
      'Your proposal win rate is 15%. Top freelancers in your category average 25%. Focus on personalization.',
    impact: 'high',
    actionItems: [
      'Use AI proposal suggestions',
      'Reference specific job requirements',
      'Include relevant portfolio pieces',
    ],
  },
  {
    id: '3',
    type: 'tip',
    title: 'Optimize Working Hours',
    description:
      "You're most productive 9 AM - 1 PM. Consider scheduling complex work during these hours.",
    impact: 'medium',
    actionItems: [
      'Block morning hours for deep work',
      'Schedule meetings in afternoon',
      'Use time tracking insights',
    ],
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function MetricCard({ metric }: { metric: CareerMetric }) {
  const Icon = metric.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            metric.trend === 'up'
              ? 'text-green-600'
              : metric.trend === 'down'
                ? 'text-red-600'
                : 'text-gray-500'
          }`}
        >
          {metric.trend === 'up' && <ArrowUp className="h-4 w-4" />}
          {metric.trend === 'down' && <ArrowDown className="h-4 w-4" />}
          {metric.change !== 0 && `${Math.abs(metric.change)}%`}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
        <p className="text-sm text-gray-500">{metric.label}</p>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: CareerGoal }) {
  const progress = Math.round((goal.current / goal.target) * 100);
  const statusColors = {
    on_track: 'bg-green-100 text-green-700',
    behind: 'bg-red-100 text-red-700',
    ahead: 'bg-blue-100 text-blue-700',
    completed: 'bg-purple-100 text-purple-700',
  };

  const categoryIcons = {
    earnings: DollarSign,
    skills: BookOpen,
    clients: Target,
    rate: TrendingUp,
  };

  const Icon = categoryIcons[goal.category];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <Icon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{goal.title}</h4>
            <p className="text-xs text-gray-500">Due: {goal.deadline}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[goal.status]}`}
        >
          {goal.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-900">{progress}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full transition-all ${
              goal.status === 'behind' ? 'bg-red-500' : 'bg-purple-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Current: {goal.current}</span>
          <span>Target: {goal.target}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeStyles = {
    opportunity: { bg: 'bg-green-50', icon: Lightbulb, color: 'text-green-600' },
    improvement: { bg: 'bg-blue-50', icon: TrendingUp, color: 'text-blue-600' },
    warning: { bg: 'bg-amber-50', icon: Zap, color: 'text-amber-600' },
    tip: { bg: 'bg-purple-50', icon: Sparkles, color: 'text-purple-600' },
  };

  const impactColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  };

  const style = typeStyles[recommendation.type];
  const Icon = style.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${style.bg}`}
        >
          <Icon className={`h-5 w-5 ${style.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{recommendation.title}</h4>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${impactColors[recommendation.impact]}`}
            >
              {recommendation.impact} impact
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{recommendation.description}</p>
        </div>
        <ChevronRight
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <h5 className="text-sm font-medium text-gray-700">Action Items:</h5>
          <ul className="mt-2 space-y-2">
            {recommendation.actionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                  {idx + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function AICoachPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<CoachInsight[]>([
    {
      id: '1',
      message: "You're on track to hit your $10k/month goal! Keep focusing on high-value projects.",
      timestamp: new Date(),
      category: 'earnings',
    },
  ]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setInsights((prev) => [
        {
          id: Date.now().toString(),
          message:
            'New insight: Consider raising your rate by 10% for new clients based on your recent reviews.',
          timestamp: new Date(),
          category: 'rate',
        },
        ...prev,
      ]);
      setIsLoading(false);
    }, 1500);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Career Coach</h1>
            <p className="mt-1 text-gray-500">
              Personalized insights to grow your freelance career
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            disabled={isLoading}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Insights
          </button>
        </div>

        {/* AI Coach Banner */}
        <div className="mb-8 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Your AI Coach Says</h2>
              <p className="mt-1 text-purple-100">
                {insights[0]?.message || 'Analyzing your career data...'}
              </p>
            </div>
            <button className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30">
              <MessageCircle className="h-4 w-4" />
              Chat with Coach
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Career Metrics</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAREER_METRICS.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </div>

        {/* Goals and Recommendations */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Goals */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Your Goals</h3>
              <button className="text-sm font-medium text-purple-600 hover:text-purple-700">
                + Add Goal
              </button>
            </div>
            <div className="space-y-4">
              {CAREER_GOALS.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">AI Recommendations</h3>
            <div className="space-y-4">
              {RECOMMENDATIONS.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          </div>
        </div>

        {/* Insights Timeline */}
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Insights</h3>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {insights.map((insight) => (
                <div key={insight.id} className="flex items-start gap-3 p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700">{insight.message}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {insight.timestamp.toLocaleTimeString()} · {insight.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
