'use client';

import { cn } from '@skillancer/ui';
import {
  Search,
  Grid3X3,
  List,
  Shield,
  Clock,
  TrendingUp,
  TrendingDown,
  Star,
  ChevronRight,
  BarChart2,
  Code,
  Database,
  Cloud,
  Smartphone,
  Palette,
  Lock,
  Brain,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  verified: boolean;
  verificationSource?: string;
  lastUsed: string;
  marketDemand: 'high' | 'medium' | 'low';
  demandTrend: 'up' | 'down' | 'stable';
  endorsements: number;
  projectCount: number;
  relatedSkills: string[];
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Frontend: Code,
  Backend: Database,
  Cloud: Cloud,
  Mobile: Smartphone,
  Design: Palette,
  Security: Lock,
  'AI/ML': Brain,
};

export default function SkillsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  // Mock data
  const skills: Skill[] = [
    {
      id: '1',
      name: 'React',
      category: 'Frontend',
      level: 'Expert',
      verified: true,
      verificationSource: 'LinkedIn Skill Assessment',
      lastUsed: '2 days ago',
      marketDemand: 'high',
      demandTrend: 'up',
      endorsements: 24,
      projectCount: 45,
      relatedSkills: ['TypeScript', 'Next.js', 'Redux'],
    },
    {
      id: '2',
      name: 'TypeScript',
      category: 'Frontend',
      level: 'Advanced',
      verified: true,
      verificationSource: 'Skill Assessment',
      lastUsed: '1 day ago',
      marketDemand: 'high',
      demandTrend: 'up',
      endorsements: 18,
      projectCount: 38,
      relatedSkills: ['React', 'Node.js', 'JavaScript'],
    },
    {
      id: '3',
      name: 'Node.js',
      category: 'Backend',
      level: 'Advanced',
      verified: true,
      verificationSource: 'Pluralsight IQ',
      lastUsed: '3 days ago',
      marketDemand: 'high',
      demandTrend: 'stable',
      endorsements: 15,
      projectCount: 32,
      relatedSkills: ['Express', 'MongoDB', 'TypeScript'],
    },
    {
      id: '4',
      name: 'AWS',
      category: 'Cloud',
      level: 'Intermediate',
      verified: false,
      lastUsed: '1 week ago',
      marketDemand: 'high',
      demandTrend: 'up',
      endorsements: 8,
      projectCount: 12,
      relatedSkills: ['Docker', 'Kubernetes', 'Terraform'],
    },
    {
      id: '5',
      name: 'PostgreSQL',
      category: 'Backend',
      level: 'Advanced',
      verified: true,
      verificationSource: 'HackerRank',
      lastUsed: '2 days ago',
      marketDemand: 'medium',
      demandTrend: 'stable',
      endorsements: 12,
      projectCount: 28,
      relatedSkills: ['SQL', 'Redis', 'MongoDB'],
    },
    {
      id: '6',
      name: 'GraphQL',
      category: 'Backend',
      level: 'Intermediate',
      verified: false,
      lastUsed: '2 weeks ago',
      marketDemand: 'medium',
      demandTrend: 'up',
      endorsements: 5,
      projectCount: 8,
      relatedSkills: ['Apollo', 'React', 'Node.js'],
    },
    {
      id: '7',
      name: 'Docker',
      category: 'Cloud',
      level: 'Intermediate',
      verified: true,
      verificationSource: 'Docker Certification',
      lastUsed: '4 days ago',
      marketDemand: 'high',
      demandTrend: 'stable',
      endorsements: 10,
      projectCount: 18,
      relatedSkills: ['Kubernetes', 'AWS', 'CI/CD'],
    },
    {
      id: '8',
      name: 'Figma',
      category: 'Design',
      level: 'Beginner',
      verified: false,
      lastUsed: '1 month ago',
      marketDemand: 'medium',
      demandTrend: 'up',
      endorsements: 2,
      projectCount: 3,
      relatedSkills: ['UI/UX', 'CSS', 'Prototyping'],
    },
  ];

  const categories = ['all', ...new Set(skills.map((s) => s.category))];
  const levels = ['all', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredSkills = skills.filter((skill) => {
    if (search && !skill.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false;
    if (levelFilter !== 'all' && skill.level !== levelFilter) return false;
    if (verifiedFilter === 'verified' && !skill.verified) return false;
    if (verifiedFilter === 'unverified' && skill.verified) return false;
    return true;
  });

  const stats = {
    total: skills.length,
    verified: skills.filter((s) => s.verified).length,
    highDemand: skills.filter((s) => s.marketDemand === 'high').length,
    trending: skills.filter((s) => s.demandTrend === 'up').length,
  };

  const getLevelColor = (level: Skill['level']) => {
    switch (level) {
      case 'Expert':
        return 'bg-purple-100 text-purple-700';
      case 'Advanced':
        return 'bg-blue-100 text-blue-700';
      case 'Intermediate':
        return 'bg-green-100 text-green-700';
      case 'Beginner':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getDemandColor = (demand: Skill['marketDemand']) => {
    switch (demand) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Skills</h1>
              <p className="text-gray-500">Manage and track your professional skills</p>
            </div>
            <Link
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              href="/learn/skills/add"
            >
              + Add Skill
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Skills</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">Verified</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-blue-600">{stats.highDemand}</p>
                <BarChart2 className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">High Demand</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-purple-600">{stats.trending}</p>
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">Trending Up</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                placeholder="Search skills..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Level Filter */}
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
            >
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level === 'all' ? 'All Levels' : level}
                </option>
              ))}
            </select>

            {/* Verified Filter */}
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            >
              <option value="all">All</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Unverified Only</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              <button
                className={cn(
                  'rounded-md p-2 transition-colors',
                  view === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                )}
                onClick={() => setView('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  'rounded-md p-2 transition-colors',
                  view === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                )}
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Grid/List */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className={cn(view === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-3')}>
          {filteredSkills.map((skill) => {
            const CategoryIcon = categoryIcons[skill.category] || Code;
            return view === 'grid' ? (
              <Link
                key={skill.id}
                className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                href={`/learn/skills/${skill.id}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <CategoryIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                      <p className="text-sm text-gray-500">{skill.category}</p>
                    </div>
                  </div>
                  {skill.verified && (
                    <div className="rounded-full bg-green-100 p-1">
                      <Shield className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      getLevelColor(skill.level)
                    )}
                  >
                    {skill.level}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      getDemandColor(skill.marketDemand)
                    )}
                  >
                    {skill.demandTrend === 'up' && <TrendingUp className="h-3 w-3" />}
                    {skill.demandTrend === 'down' && <TrendingDown className="h-3 w-3" />}
                    {skill.marketDemand.charAt(0).toUpperCase() + skill.marketDemand.slice(1)}{' '}
                    demand
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    {skill.endorsements} endorsements
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {skill.lastUsed}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                key={skill.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                href={`/learn/skills/${skill.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <CategoryIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{skill.name}</h3>
                      {skill.verified && <Shield className="h-4 w-4 text-green-600" />}
                    </div>
                    <p className="text-sm text-gray-500">{skill.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      getLevelColor(skill.level)
                    )}
                  >
                    {skill.level}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      getDemandColor(skill.marketDemand)
                    )}
                  >
                    {skill.demandTrend === 'up' && <TrendingUp className="h-4 w-4" />}
                    {skill.demandTrend === 'down' && <TrendingDown className="h-4 w-4" />}
                    {skill.marketDemand}
                  </span>
                  <span className="text-sm text-gray-500">{skill.projectCount} projects</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Link>
            );
          })}
        </div>

        {filteredSkills.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500">No skills found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
