'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Shield,
  Clock,
  TrendingUp,
  Star,
  Award,
  BookOpen,
  Briefcase,
  Edit2,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function SkillDetailPage() {
  const params = useParams();
  const skillId = params.skillId;
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'market'>('overview');
  const [showActions, setShowActions] = useState(false);

  // Mock data for skill detail
  const skill = {
    id: skillId,
    name: 'React',
    category: 'Frontend Development',
    level: 'Expert',
    levelProgress: 92,
    verified: true,
    verificationSource: 'LinkedIn Skill Assessment',
    verifiedDate: 'March 2024',
    description:
      'A JavaScript library for building user interfaces, particularly single-page applications with reusable components.',
    lastUsed: '2 days ago',
    yearsExperience: 5,
    marketDemand: 'high' as const,
    demandTrend: 'up' as const,
    endorsements: 24,
    projectCount: 45,
    avgHourlyRate: 125,
    ratePercentile: 78,
    relatedSkills: [
      { name: 'TypeScript', level: 'Advanced', hasSkill: true },
      { name: 'Next.js', level: 'Advanced', hasSkill: true },
      { name: 'Redux', level: 'Intermediate', hasSkill: true },
      { name: 'React Native', level: 'Beginner', hasSkill: false },
      { name: 'GraphQL', level: 'Intermediate', hasSkill: true },
    ],
    certifications: [
      { name: 'Meta React Developer Certificate', issuer: 'Coursera', date: 'Jan 2024' },
      { name: 'React Skill Assessment', issuer: 'LinkedIn', date: 'Mar 2024' },
    ],
    recentProjects: [
      { name: 'E-commerce Platform Rebuild', client: 'TechCorp Inc.', date: 'Feb 2024', rating: 5 },
      { name: 'SaaS Dashboard', client: 'StartupXYZ', date: 'Jan 2024', rating: 5 },
      { name: 'Mobile App (React Native)', client: 'HealthTech', date: 'Dec 2023', rating: 4.8 },
    ],
    learningHistory: [
      {
        type: 'course',
        name: 'Advanced React Patterns',
        provider: 'Frontend Masters',
        date: 'Mar 2024',
      },
      { type: 'project', name: 'Built E-commerce Dashboard', date: 'Feb 2024' },
      {
        type: 'certification',
        name: 'Meta React Certificate',
        provider: 'Coursera',
        date: 'Jan 2024',
      },
      {
        type: 'course',
        name: 'React Performance Optimization',
        provider: 'Pluralsight',
        date: 'Nov 2023',
      },
    ],
    marketInsights: {
      jobPostings: 12450,
      jobGrowth: 24,
      avgSalary: '$145,000',
      topEmployers: ['Google', 'Meta', 'Amazon', 'Microsoft', 'Netflix'],
      complementarySkills: ['TypeScript', 'Next.js', 'Node.js', 'GraphQL'],
      demandByRegion: [
        { region: 'San Francisco', jobs: 2340 },
        { region: 'New York', jobs: 1890 },
        { region: 'Remote', jobs: 4560 },
        { region: 'London', jobs: 980 },
      ],
    },
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Expert':
        return 'from-purple-500 to-indigo-600';
      case 'Advanced':
        return 'from-blue-500 to-cyan-500';
      case 'Intermediate':
        return 'from-green-500 to-emerald-500';
      case 'Beginner':
        return 'from-gray-400 to-gray-500';
      default:
        return 'from-gray-400 to-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            href="/learn/skills"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Skills
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={cn('rounded-xl bg-gradient-to-br p-4', getLevelColor(skill.level))}>
                <span className="text-3xl font-bold text-white">{skill.name.charAt(0)}</span>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{skill.name}</h1>
                  {skill.verified && (
                    <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5">
                      <Shield className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Verified</span>
                    </div>
                  )}
                </div>
                <p className="mb-2 text-gray-500">{skill.category}</p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {skill.yearsExperience} years experience
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {skill.projectCount} projects
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    {skill.endorsements} endorsements
                  </span>
                </div>
              </div>
            </div>
            <div className="relative">
              <button
                className="rounded-lg p-2 hover:bg-gray-100"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreHorizontal className="h-5 w-5 text-gray-500" />
              </button>
              {showActions && (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50">
                    <Edit2 className="h-4 w-4" />
                    Edit Skill
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50">
                    <Shield className="h-4 w-4" />
                    Get Verified
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    Remove Skill
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Level Progress */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Skill Level: {skill.level}</span>
              <span className="text-sm text-gray-500">{skill.levelProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r', getLevelColor(skill.level))}
                style={{ width: `${skill.levelProgress}%` }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-6 border-t border-gray-200 pt-4">
            {(['overview', 'history', 'market'] as const).map((tab) => (
              <button
                key={tab}
                className={cn(
                  '-mb-4 border-b-2 pb-2 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="col-span-2 space-y-6">
              {/* Description */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-2 font-semibold text-gray-900">About</h3>
                <p className="text-gray-600">{skill.description}</p>
              </div>

              {/* Certifications */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Certifications & Assessments</h3>
                  <Link
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    href="/learn/certifications"
                  >
                    Add More
                  </Link>
                </div>
                <div className="space-y-3">
                  {skill.certifications.map((cert) => (
                    <div
                      key={cert.name}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                    >
                      <div className="rounded-lg bg-amber-100 p-2">
                        <Award className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{cert.name}</p>
                        <p className="text-sm text-gray-500">
                          {cert.issuer} • {cert.date}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Projects */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">
                  Recent Projects Using This Skill
                </h3>
                <div className="space-y-3">
                  {skill.recentProjects.map((project) => (
                    <div
                      key={project.name}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{project.name}</p>
                          <p className="text-sm text-gray-500">
                            {project.client} • {project.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm text-gray-700">{project.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Market Demand */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Market Demand</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Demand Level</span>
                    <span className="flex items-center gap-1 font-medium text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      High
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Job Postings</span>
                    <span className="font-medium">
                      {skill.marketInsights.jobPostings.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Growth</span>
                    <span className="font-medium text-green-600">
                      +{skill.marketInsights.jobGrowth}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Avg. Salary</span>
                    <span className="font-medium">{skill.marketInsights.avgSalary}</span>
                  </div>
                </div>
              </div>

              {/* Your Rate */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white">
                <h3 className="mb-4 font-semibold">Your Rate for This Skill</h3>
                <div className="mb-1 text-3xl font-bold">${skill.avgHourlyRate}/hr</div>
                <p className="text-sm text-indigo-100">
                  Top {100 - skill.ratePercentile}% in your category
                </p>
              </div>

              {/* Related Skills */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Related Skills</h3>
                <div className="space-y-2">
                  {skill.relatedSkills.map((related) => (
                    <div
                      key={related.name}
                      className={cn(
                        'flex items-center justify-between rounded-lg p-2',
                        related.hasSkill ? 'bg-green-50' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {related.hasSkill ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={related.hasSkill ? 'text-gray-900' : 'text-gray-500'}>
                          {related.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{related.level}</span>
                    </div>
                  ))}
                </div>
                <Link
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                  href="/learn/gaps"
                >
                  Fill Skill Gaps
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-6 font-semibold text-gray-900">Learning History</h3>
            <div className="space-y-4">
              {skill.learningHistory.map((item, idx) => (
                <div key={item.name} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        item.type === 'course' && 'bg-blue-100',
                        item.type === 'project' && 'bg-green-100',
                        item.type === 'certification' && 'bg-amber-100'
                      )}
                    >
                      {item.type === 'course' && <BookOpen className="h-5 w-5 text-blue-600" />}
                      {item.type === 'project' && <Briefcase className="h-5 w-5 text-green-600" />}
                      {item.type === 'certification' && (
                        <Award className="h-5 w-5 text-amber-600" />
                      )}
                    </div>
                    {idx < skill.learningHistory.length - 1 && (
                      <div className="my-2 w-0.5 flex-1 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.provider && `${item.provider} • `}
                      {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Top Hiring Companies</h3>
              <div className="space-y-3">
                {skill.marketInsights.topEmployers.map((company) => (
                  <div key={company} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-600">
                      {company.charAt(0)}
                    </div>
                    <span className="text-gray-900">{company}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Jobs by Region</h3>
              <div className="space-y-3">
                {skill.marketInsights.demandByRegion.map((region) => (
                  <div key={region.region} className="flex items-center justify-between">
                    <span className="text-gray-600">{region.region}</span>
                    <span className="font-medium text-gray-900">
                      {region.jobs.toLocaleString()} jobs
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">
                Skills Often Paired With {skill.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                {skill.marketInsights.complementarySkills.map((skillName) => (
                  <span
                    key={skillName}
                    className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
                  >
                    {skillName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
