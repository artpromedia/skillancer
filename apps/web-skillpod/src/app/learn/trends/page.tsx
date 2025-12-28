'use client';

import { cn } from '@skillancer/ui';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  DollarSign,
  Briefcase,
  ChevronRight,
  Flame,
  ArrowUpRight,
  Globe,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EmergingSkills } from '@/components/learning/emerging-skills';
import { TrendChart } from '@/components/learning/trend-chart';

interface SkillTrend {
  id: string;
  name: string;
  category: string;
  growth: number;
  demandLevel: 'exploding' | 'high' | 'growing' | 'stable' | 'declining';
  jobPostings: number;
  avgSalary: string;
  yearlySalaryGrowth: number;
  hasSkill: boolean;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  topEmployers: string[];
  relatedSkills: string[];
  historicalData: { month: string; value: number }[];
}

export default function MarketTrendsPage() {
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | '2y'>('1y');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [view, setView] = useState<'list' | 'chart' | 'emerging'>('list');

  // Mock skill trends data
  const skillTrends: SkillTrend[] = [
    {
      id: '1',
      name: 'AI/ML Engineering',
      category: 'AI/ML',
      growth: 156,
      demandLevel: 'exploding',
      jobPostings: 45000,
      avgSalary: '$185,000',
      yearlySalaryGrowth: 24,
      hasSkill: false,
      topEmployers: ['OpenAI', 'Google', 'Microsoft', 'Meta', 'Amazon'],
      relatedSkills: ['Python', 'TensorFlow', 'PyTorch', 'LLMs'],
      historicalData: [
        { month: 'Jan', value: 25000 },
        { month: 'Mar', value: 30000 },
        { month: 'Jun', value: 38000 },
        { month: 'Sep', value: 42000 },
        { month: 'Dec', value: 45000 },
      ],
    },
    {
      id: '2',
      name: 'Kubernetes',
      category: 'DevOps',
      growth: 82,
      demandLevel: 'high',
      jobPostings: 28500,
      avgSalary: '$165,000',
      yearlySalaryGrowth: 15,
      hasSkill: false,
      topEmployers: ['Google', 'Amazon', 'Microsoft', 'Spotify', 'Netflix'],
      relatedSkills: ['Docker', 'AWS', 'Terraform', 'Helm'],
      historicalData: [
        { month: 'Jan', value: 18000 },
        { month: 'Mar', value: 21000 },
        { month: 'Jun', value: 24000 },
        { month: 'Sep', value: 26500 },
        { month: 'Dec', value: 28500 },
      ],
    },
    {
      id: '3',
      name: 'React',
      category: 'Frontend',
      growth: 45,
      demandLevel: 'growing',
      jobPostings: 52000,
      avgSalary: '$145,000',
      yearlySalaryGrowth: 8,
      hasSkill: true,
      skillLevel: 'Expert',
      topEmployers: ['Meta', 'Netflix', 'Airbnb', 'Uber', 'Stripe'],
      relatedSkills: ['TypeScript', 'Next.js', 'Redux', 'GraphQL'],
      historicalData: [
        { month: 'Jan', value: 42000 },
        { month: 'Mar', value: 45000 },
        { month: 'Jun', value: 48000 },
        { month: 'Sep', value: 50000 },
        { month: 'Dec', value: 52000 },
      ],
    },
    {
      id: '4',
      name: 'TypeScript',
      category: 'Frontend',
      growth: 68,
      demandLevel: 'high',
      jobPostings: 38000,
      avgSalary: '$150,000',
      yearlySalaryGrowth: 12,
      hasSkill: true,
      skillLevel: 'Advanced',
      topEmployers: ['Microsoft', 'Google', 'Airbnb', 'Stripe', 'Vercel'],
      relatedSkills: ['React', 'Node.js', 'JavaScript', 'Next.js'],
      historicalData: [
        { month: 'Jan', value: 25000 },
        { month: 'Mar', value: 28000 },
        { month: 'Jun', value: 32000 },
        { month: 'Sep', value: 35000 },
        { month: 'Dec', value: 38000 },
      ],
    },
    {
      id: '5',
      name: 'Rust',
      category: 'Systems',
      growth: 95,
      demandLevel: 'exploding',
      jobPostings: 8500,
      avgSalary: '$175,000',
      yearlySalaryGrowth: 18,
      hasSkill: false,
      topEmployers: ['Cloudflare', 'Discord', 'Dropbox', 'Amazon', 'Microsoft'],
      relatedSkills: ['C++', 'WebAssembly', 'Systems Design'],
      historicalData: [
        { month: 'Jan', value: 4500 },
        { month: 'Mar', value: 5500 },
        { month: 'Jun', value: 6800 },
        { month: 'Sep', value: 7500 },
        { month: 'Dec', value: 8500 },
      ],
    },
    {
      id: '6',
      name: 'Node.js',
      category: 'Backend',
      growth: 22,
      demandLevel: 'stable',
      jobPostings: 42000,
      avgSalary: '$140,000',
      yearlySalaryGrowth: 5,
      hasSkill: true,
      skillLevel: 'Advanced',
      topEmployers: ['LinkedIn', 'Netflix', 'Uber', 'PayPal', 'Walmart'],
      relatedSkills: ['TypeScript', 'Express', 'MongoDB', 'PostgreSQL'],
      historicalData: [
        { month: 'Jan', value: 38000 },
        { month: 'Mar', value: 39500 },
        { month: 'Jun', value: 40500 },
        { month: 'Sep', value: 41500 },
        { month: 'Dec', value: 42000 },
      ],
    },
    {
      id: '7',
      name: 'PHP',
      category: 'Backend',
      growth: -12,
      demandLevel: 'declining',
      jobPostings: 18000,
      avgSalary: '$95,000',
      yearlySalaryGrowth: -2,
      hasSkill: false,
      topEmployers: ['WordPress', 'Shopify', 'Slack', 'Tumblr'],
      relatedSkills: ['Laravel', 'MySQL', 'WordPress'],
      historicalData: [
        { month: 'Jan', value: 22000 },
        { month: 'Mar', value: 21000 },
        { month: 'Jun', value: 20000 },
        { month: 'Sep', value: 19000 },
        { month: 'Dec', value: 18000 },
      ],
    },
    {
      id: '8',
      name: 'Go',
      category: 'Backend',
      growth: 58,
      demandLevel: 'high',
      jobPostings: 22000,
      avgSalary: '$165,000',
      yearlySalaryGrowth: 14,
      hasSkill: false,
      topEmployers: ['Google', 'Uber', 'Twitch', 'Dropbox', 'Docker'],
      relatedSkills: ['Kubernetes', 'Docker', 'Microservices'],
      historicalData: [
        { month: 'Jan', value: 14000 },
        { month: 'Mar', value: 16000 },
        { month: 'Jun', value: 18500 },
        { month: 'Sep', value: 20500 },
        { month: 'Dec', value: 22000 },
      ],
    },
  ];

  const categories = ['all', ...new Set(skillTrends.map((s) => s.category))];

  const filteredTrends = skillTrends
    .filter((skill) => categoryFilter === 'all' || skill.category === categoryFilter)
    .sort((a, b) => b.growth - a.growth);

  const getDemandLevelStyles = (level: SkillTrend['demandLevel']) => {
    switch (level) {
      case 'exploding':
        return { bg: 'bg-red-100', text: 'text-red-700', icon: Flame };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-700', icon: TrendingUp };
      case 'growing':
        return { bg: 'bg-green-100', text: 'text-green-700', icon: TrendingUp };
      case 'stable':
        return { bg: 'bg-blue-100', text: 'text-blue-700', icon: Minus };
      case 'declining':
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: TrendingDown };
    }
  };

  const stats = {
    totalSkillsTracked: skillTrends.length,
    exploringGrowth: skillTrends.filter((s) => s.demandLevel === 'exploding').length,
    yourSkillsGrowing: skillTrends.filter((s) => s.hasSkill && s.growth > 0).length,
    opportunityGaps: skillTrends.filter((s) => !s.hasSkill && s.growth > 50).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Market Trends</h1>
              <p className="text-gray-500">Track skill demand and stay ahead of the market</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
              {(['3m', '6m', '1y', '2y'] as const).map((range) => (
                <button
                  key={range}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    timeRange === range ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  )}
                  onClick={() => setTimeRange(range)}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Globe className="h-5 w-5 text-gray-600" />
                <p className="text-2xl font-bold text-gray-900">{stats.totalSkillsTracked}</p>
              </div>
              <p className="text-sm text-gray-500">Skills Tracked</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{stats.exploringGrowth}</p>
              </div>
              <p className="text-sm text-red-700">Exploding Demand</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{stats.yourSkillsGrowing}</p>
              </div>
              <p className="text-sm text-green-700">Your Skills Growing</p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <p className="text-2xl font-bold text-purple-600">{stats.opportunityGaps}</p>
              </div>
              <p className="text-sm text-purple-700">High-Growth Opportunities</p>
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
              <span className="text-sm text-gray-600">Category:</span>
              <select
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              )}
              onClick={() => setView('list')}
            >
              List View
            </button>
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === 'chart' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              )}
              onClick={() => setView('chart')}
            >
              Trend Chart
            </button>
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                view === 'emerging' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              )}
              onClick={() => setView('emerging')}
            >
              Emerging
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        {view === 'list' && (
          <div className="space-y-3">
            {filteredTrends.map((skill) => {
              const demandStyles = getDemandLevelStyles(skill.demandLevel);
              const DemandIcon = demandStyles.icon;
              return (
                <div
                  key={skill.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{skill.name}</h3>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            demandStyles.bg,
                            demandStyles.text
                          )}
                        >
                          <DemandIcon className="h-3 w-3" />
                          {skill.demandLevel.charAt(0).toUpperCase() + skill.demandLevel.slice(1)}
                        </span>
                        {skill.hasSkill && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            You have this skill ({skill.skillLevel})
                          </span>
                        )}
                      </div>
                      <p className="mb-3 text-sm text-gray-500">{skill.category}</p>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-1">
                          <ArrowUpRight
                            className={cn(
                              'h-4 w-4',
                              skill.growth >= 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          />
                          <span className={skill.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {skill.growth >= 0 ? '+' : ''}
                            {skill.growth}% growth
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Briefcase className="h-4 w-4" />
                          {skill.jobPostings.toLocaleString()} jobs
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <DollarSign className="h-4 w-4" />
                          {skill.avgSalary}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <TrendingUp className="h-4 w-4" />
                          {skill.yearlySalaryGrowth >= 0 ? '+' : ''}
                          {skill.yearlySalaryGrowth}% salary YoY
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!skill.hasSkill && (
                        <Link
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                          href={`/learn/recommendations?skill=${skill.name}`}
                        >
                          Learn Now
                        </Link>
                      )}
                      <Link
                        className="rounded-lg p-2 hover:bg-gray-100"
                        href={`/learn/trends/${skill.id}`}
                      >
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </Link>
                    </div>
                  </div>

                  {/* Related Skills */}
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="mb-2 text-xs text-gray-500">Related Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {skill.relatedSkills.map((related) => (
                        <span
                          key={related}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {related}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'chart' && <TrendChart timeRange={timeRange} trends={filteredTrends} />}

        {view === 'emerging' && <EmergingSkills trends={filteredTrends} />}
      </div>
    </div>
  );
}
