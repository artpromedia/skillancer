'use client';

import { cn } from '@skillancer/ui';
import {
  AlertTriangle,
  TrendingUp,
  Target,
  ChevronRight,
  Filter,
  DollarSign,
  Briefcase,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import GapImpactChart from '@/components/learning/gap-impact-chart';
import SkillGapCard from '@/components/learning/skill-gap-card';

interface SkillGap {
  id: string;
  skillName: string;
  category: string;
  currentLevel: 'None' | 'Beginner' | 'Intermediate';
  requiredLevel: 'Intermediate' | 'Advanced' | 'Expert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  demandTrend: 'up' | 'down' | 'stable';
  impact: {
    missedJobs: number;
    potentialRateIncrease: string;
    opportunityScore: number;
  };
  timeToAcquire: string;
  learningPath?: {
    id: string;
    name: string;
    duration: string;
  };
  relatedJobs: string[];
}

export default function SkillGapsPage() {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'impact' | 'time'>('severity');
  const [view, setView] = useState<'cards' | 'impact'>('cards');

  // Mock skill gaps data
  const skillGaps: SkillGap[] = [
    {
      id: '1',
      skillName: 'Kubernetes',
      category: 'DevOps & Cloud',
      currentLevel: 'None',
      requiredLevel: 'Advanced',
      severity: 'critical',
      demandTrend: 'up',
      impact: {
        missedJobs: 45,
        potentialRateIncrease: '+$35/hr',
        opportunityScore: 95,
      },
      timeToAcquire: '3 months',
      learningPath: {
        id: 'kube-1',
        name: 'Kubernetes Mastery',
        duration: '40 hours',
      },
      relatedJobs: ['DevOps Engineer', 'Platform Engineer', 'SRE'],
    },
    {
      id: '2',
      skillName: 'System Design',
      category: 'Architecture',
      currentLevel: 'Beginner',
      requiredLevel: 'Expert',
      severity: 'critical',
      demandTrend: 'up',
      impact: {
        missedJobs: 38,
        potentialRateIncrease: '+$45/hr',
        opportunityScore: 92,
      },
      timeToAcquire: '4 months',
      learningPath: {
        id: 'sys-1',
        name: 'System Design Interview Prep',
        duration: '50 hours',
      },
      relatedJobs: ['Staff Engineer', 'Solutions Architect', 'Tech Lead'],
    },
    {
      id: '3',
      skillName: 'GraphQL',
      category: 'Backend',
      currentLevel: 'Beginner',
      requiredLevel: 'Advanced',
      severity: 'high',
      demandTrend: 'up',
      impact: {
        missedJobs: 28,
        potentialRateIncrease: '+$20/hr',
        opportunityScore: 78,
      },
      timeToAcquire: '1 month',
      learningPath: {
        id: 'gql-1',
        name: 'GraphQL Full Stack',
        duration: '25 hours',
      },
      relatedJobs: ['Full Stack Developer', 'Backend Engineer', 'API Developer'],
    },
    {
      id: '4',
      skillName: 'Machine Learning',
      category: 'AI/ML',
      currentLevel: 'None',
      requiredLevel: 'Intermediate',
      severity: 'high',
      demandTrend: 'up',
      impact: {
        missedJobs: 22,
        potentialRateIncrease: '+$40/hr',
        opportunityScore: 85,
      },
      timeToAcquire: '6 months',
      learningPath: {
        id: 'ml-1',
        name: 'ML Foundations for Engineers',
        duration: '80 hours',
      },
      relatedJobs: ['ML Engineer', 'Data Scientist', 'AI Developer'],
    },
    {
      id: '5',
      skillName: 'Terraform',
      category: 'DevOps & Cloud',
      currentLevel: 'Intermediate',
      requiredLevel: 'Advanced',
      severity: 'medium',
      demandTrend: 'stable',
      impact: {
        missedJobs: 15,
        potentialRateIncrease: '+$15/hr',
        opportunityScore: 65,
      },
      timeToAcquire: '2 weeks',
      learningPath: {
        id: 'tf-1',
        name: 'Advanced Terraform',
        duration: '12 hours',
      },
      relatedJobs: ['Cloud Engineer', 'DevOps Engineer', 'Platform Engineer'],
    },
    {
      id: '6',
      skillName: 'React Native',
      category: 'Mobile',
      currentLevel: 'Beginner',
      requiredLevel: 'Advanced',
      severity: 'medium',
      demandTrend: 'stable',
      impact: {
        missedJobs: 12,
        potentialRateIncrease: '+$18/hr',
        opportunityScore: 60,
      },
      timeToAcquire: '2 months',
      learningPath: {
        id: 'rn-1',
        name: 'React Native Pro',
        duration: '35 hours',
      },
      relatedJobs: ['Mobile Developer', 'Cross-Platform Engineer'],
    },
    {
      id: '7',
      skillName: 'Web3/Blockchain',
      category: 'Emerging',
      currentLevel: 'None',
      requiredLevel: 'Intermediate',
      severity: 'low',
      demandTrend: 'down',
      impact: {
        missedJobs: 8,
        potentialRateIncrease: '+$30/hr',
        opportunityScore: 45,
      },
      timeToAcquire: '3 months',
      relatedJobs: ['Blockchain Developer', 'Web3 Engineer'],
    },
  ];

  const severities = ['all', 'critical', 'high', 'medium', 'low'];

  const filteredGaps = skillGaps
    .filter((gap) => severityFilter === 'all' || gap.severity === severityFilter)
    .sort((a, b) => {
      if (sortBy === 'severity') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      }
      if (sortBy === 'impact') {
        return b.impact.opportunityScore - a.impact.opportunityScore;
      }
      // Time - convert to comparable numbers
      return 0;
    });

  const stats = {
    totalGaps: skillGaps.length,
    criticalGaps: skillGaps.filter((g) => g.severity === 'critical').length,
    potentialEarnings: '$125/hr',
    missedOpportunities: skillGaps.reduce((acc, g) => acc + g.impact.missedJobs, 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Skill Gaps Analysis</h1>
              <p className="text-gray-500">
                Identify and close the gaps between your current skills and market demands
              </p>
            </div>
            <Link
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              href="/learn/assessment"
            >
              Take Skill Assessment
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{stats.criticalGaps}</p>
              </div>
              <p className="text-sm text-red-700">Critical Gaps</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">{stats.totalGaps}</p>
              <p className="text-sm text-amber-700">Total Skill Gaps</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{stats.potentialEarnings}</p>
              </div>
              <p className="text-sm text-green-700">Potential Rate Increase</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">{stats.missedOpportunities}</p>
              </div>
              <p className="text-sm text-blue-700">Missed Job Opportunities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Severity:</span>
              <select
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                {severities.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev === 'all' ? 'All Severities' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="severity">Severity</option>
                <option value="impact">Career Impact</option>
                <option value="time">Time to Learn</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              )}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === 'impact' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              )}
              onClick={() => setView('impact')}
            >
              Impact Chart
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        {view === 'cards' ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredGaps.map((gap) => (
              <SkillGapCard key={gap.id} gap={gap} />
            ))}
          </div>
        ) : (
          <GapImpactChart gaps={filteredGaps} />
        )}

        {filteredGaps.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-gray-900">No skill gaps found!</p>
            <p className="text-gray-500">You&apos;re well-aligned with market demands.</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            href="/learn/paths"
          >
            <div className="rounded-lg bg-indigo-100 p-2">
              <Target className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Learning Paths</p>
              <p className="text-sm text-gray-500">Structured skill development</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            href="/learn/recommendations"
          >
            <div className="rounded-lg bg-purple-100 p-2">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Quick Wins</p>
              <p className="text-sm text-gray-500">Skills you can learn fast</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            href="/learn/trends"
          >
            <div className="rounded-lg bg-green-100 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Market Trends</p>
              <p className="text-sm text-gray-500">See what&apos;s growing</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
