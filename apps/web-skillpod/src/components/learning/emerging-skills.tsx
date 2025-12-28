'use client';

import {
  TrendingUp,
  Flame,
  Rocket,
  Star,
  DollarSign,
  Briefcase,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

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

interface EmergingSkillsProps {
  trends: SkillTrend[];
}

export function EmergingSkills({ trends }: Readonly<EmergingSkillsProps>) {
  // Filter for emerging skills (high growth, exploding or high demand)
  const emergingSkills = trends
    .filter(
      (t) =>
        t.growth > 50 ||
        t.demandLevel === 'exploding' ||
        (t.demandLevel === 'high' && t.yearlySalaryGrowth > 10)
    )
    .sort((a, b) => b.growth - a.growth);

  // Categorize by opportunity type
  const hotOpportunities = emergingSkills.filter((s) => !s.hasSkill && s.growth > 70);
  const growingWithYou = emergingSkills.filter((s) => s.hasSkill && s.growth > 30);
  const futureProof = emergingSkills.filter((s) => s.yearlySalaryGrowth > 15);

  return (
    <div className="space-y-6">
      {/* Hot Opportunities - Skills you don't have but should learn */}
      {hotOpportunities.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <Flame className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">🔥 Hot Opportunities</h3>
              <p className="text-sm text-gray-600">
                High-growth skills you should consider learning
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {hotOpportunities.slice(0, 4).map((skill) => (
              <div
                key={skill.id}
                className="rounded-lg border border-red-100 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{skill.name}</h4>
                    <p className="text-xs text-gray-500">{skill.category}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                    <TrendingUp className="h-4 w-4" />+{skill.growth}%
                  </span>
                </div>
                <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {skill.jobPostings.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    {skill.avgSalary}
                  </span>
                </div>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                  href={`/learn/recommendations?skill=${skill.name}`}
                >
                  Start Learning
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growing with You - Skills you have that are trending */}
      {growingWithYou.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <Rocket className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">🚀 Growing With You</h3>
              <p className="text-sm text-gray-600">
                Skills you already have that are increasing in demand
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {growingWithYou.slice(0, 6).map((skill) => (
              <div key={skill.id} className="rounded-lg border border-green-100 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="font-medium text-gray-900">{skill.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Your level: {skill.skillLevel}</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                    <TrendingUp className="h-3.5 w-3.5" />+{skill.growth}%
                  </span>
                </div>
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <p className="text-xs text-green-700">
                    <DollarSign className="inline h-3 w-3" /> Salary growth: +
                    {skill.yearlySalaryGrowth}% YoY
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Future-Proof Skills */}
      <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">✨ Future-Proof Your Career</h3>
            <p className="text-sm text-gray-600">Skills with the highest salary growth potential</p>
          </div>
        </div>
        <div className="space-y-3">
          {futureProof.slice(0, 5).map((skill, index) => (
            <div
              key={skill.id}
              className="flex items-center justify-between rounded-lg border border-purple-100 bg-white p-4"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                  {index + 1}
                </span>
                <div>
                  <h4 className="font-medium text-gray-900">{skill.name}</h4>
                  <p className="text-xs text-gray-500">{skill.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{skill.avgSalary}</p>
                  <p className="text-xs text-green-600">
                    +{skill.yearlySalaryGrowth}% salary growth
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {skill.jobPostings.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">job openings</p>
                </div>
                {!skill.hasSkill && (
                  <Link
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-purple-700"
                    href={`/learn/paths?skill=${skill.name}`}
                  >
                    Learn
                  </Link>
                )}
                {skill.hasSkill && (
                  <span className="rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-700">
                    ✓ You know this
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          href="/learn/assessment"
        >
          <div className="rounded-lg bg-blue-100 p-2">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Take Assessment</p>
            <p className="text-sm text-gray-500">Find your skill gaps</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          href="/learn/paths"
        >
          <div className="rounded-lg bg-indigo-100 p-2">
            <Rocket className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Learning Paths</p>
            <p className="text-sm text-gray-500">Structured learning</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
        <a
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          href="https://trends.google.com/trends/explore?cat=5"
          rel="noopener noreferrer"
          target="_blank"
        >
          <div className="rounded-lg bg-green-100 p-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Google Trends</p>
            <p className="text-sm text-gray-500">External insights</p>
          </div>
          <ExternalLink className="h-5 w-5 text-gray-400" />
        </a>
      </div>
    </div>
  );
}

export default EmergingSkills;
