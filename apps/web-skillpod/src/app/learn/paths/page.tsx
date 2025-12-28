'use client';

import { cn } from '@skillancer/ui';
import {
  Search,
  Grid3X3,
  List,
  Clock,
  BookOpen,
  Award,
  Users,
  Star,
  ChevronRight,
  Briefcase,
  CheckCircle2,
  Play,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface LearningPath {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  itemCount: number;
  enrollments: number;
  rating: number;
  completionRate: number;
  skills: string[];
  outcomes: {
    rateIncrease: string;
    jobMatches: number;
    certification?: string;
  };
  progress?: number;
  isEnrolled: boolean;
  thumbnail?: string;
}

export default function LearningPathsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [tab, setTab] = useState<'all' | 'enrolled' | 'completed'>('all');

  // Mock learning paths data
  const learningPaths: LearningPath[] = [
    {
      id: '1',
      name: 'Full-Stack JavaScript Mastery',
      description:
        'Master modern JavaScript development from frontend to backend with React, Node.js, and cloud deployment.',
      category: 'Web Development',
      duration: '80 hours',
      difficulty: 'Intermediate',
      itemCount: 24,
      enrollments: 12500,
      rating: 4.8,
      completionRate: 68,
      skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'AWS'],
      outcomes: {
        rateIncrease: '+$25/hr',
        jobMatches: 450,
        certification: 'Full-Stack Developer Certificate',
      },
      progress: 45,
      isEnrolled: true,
    },
    {
      id: '2',
      name: 'Cloud Architecture on AWS',
      description:
        'Learn to design, deploy, and manage scalable applications on Amazon Web Services.',
      category: 'Cloud & DevOps',
      duration: '60 hours',
      difficulty: 'Advanced',
      itemCount: 18,
      enrollments: 8900,
      rating: 4.9,
      completionRate: 72,
      skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
      outcomes: {
        rateIncrease: '+$40/hr',
        jobMatches: 380,
        certification: 'AWS Solutions Architect',
      },
      progress: 20,
      isEnrolled: true,
    },
    {
      id: '3',
      name: 'AI & Machine Learning Fundamentals',
      description:
        'Build a solid foundation in AI and ML with Python, covering neural networks, deep learning, and practical applications.',
      category: 'AI/ML',
      duration: '100 hours',
      difficulty: 'Intermediate',
      itemCount: 32,
      enrollments: 15600,
      rating: 4.7,
      completionRate: 55,
      skills: ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn', 'MLOps'],
      outcomes: {
        rateIncrease: '+$50/hr',
        jobMatches: 520,
      },
      isEnrolled: false,
    },
    {
      id: '4',
      name: 'System Design for Senior Engineers',
      description:
        'Master the art of designing large-scale distributed systems with real-world case studies.',
      category: 'Architecture',
      duration: '45 hours',
      difficulty: 'Expert',
      itemCount: 15,
      enrollments: 6200,
      rating: 4.9,
      completionRate: 78,
      skills: ['System Design', 'Distributed Systems', 'Scalability', 'Architecture'],
      outcomes: {
        rateIncrease: '+$35/hr',
        jobMatches: 280,
      },
      isEnrolled: false,
    },
    {
      id: '5',
      name: 'Mobile Development with React Native',
      description:
        'Build cross-platform mobile apps with React Native, from basics to app store deployment.',
      category: 'Mobile',
      duration: '50 hours',
      difficulty: 'Intermediate',
      itemCount: 20,
      enrollments: 9800,
      rating: 4.6,
      completionRate: 65,
      skills: ['React Native', 'TypeScript', 'iOS', 'Android', 'Expo'],
      outcomes: {
        rateIncrease: '+$20/hr',
        jobMatches: 320,
      },
      isEnrolled: false,
    },
    {
      id: '6',
      name: 'DevOps Engineering Bootcamp',
      description:
        'Comprehensive DevOps training covering CI/CD, containerization, infrastructure as code, and monitoring.',
      category: 'Cloud & DevOps',
      duration: '70 hours',
      difficulty: 'Advanced',
      itemCount: 22,
      enrollments: 7500,
      rating: 4.8,
      completionRate: 70,
      skills: ['Docker', 'Kubernetes', 'Jenkins', 'Prometheus', 'GitOps'],
      outcomes: {
        rateIncrease: '+$30/hr',
        jobMatches: 410,
        certification: 'DevOps Professional',
      },
      isEnrolled: false,
    },
    {
      id: '7',
      name: 'API Design & Development',
      description:
        'Learn REST, GraphQL, and gRPC API design patterns with security best practices.',
      category: 'Backend',
      duration: '35 hours',
      difficulty: 'Intermediate',
      itemCount: 14,
      enrollments: 5400,
      rating: 4.7,
      completionRate: 75,
      skills: ['REST', 'GraphQL', 'gRPC', 'OpenAPI', 'Security'],
      outcomes: {
        rateIncrease: '+$18/hr',
        jobMatches: 290,
      },
      isEnrolled: false,
    },
    {
      id: '8',
      name: 'Frontend Performance Optimization',
      description:
        'Deep dive into web performance with Core Web Vitals, bundling strategies, and runtime optimization.',
      category: 'Web Development',
      duration: '25 hours',
      difficulty: 'Advanced',
      itemCount: 12,
      enrollments: 4200,
      rating: 4.8,
      completionRate: 80,
      skills: ['Performance', 'Webpack', 'React', 'Web Vitals', 'Profiling'],
      outcomes: {
        rateIncrease: '+$22/hr',
        jobMatches: 180,
      },
      progress: 100,
      isEnrolled: true,
    },
  ];

  const categories = ['all', ...new Set(learningPaths.map((p) => p.category))];
  const difficulties = ['all', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

  const filteredPaths = learningPaths
    .filter((path) => {
      if (tab === 'enrolled' && !path.isEnrolled) return false;
      if (tab === 'completed' && path.progress !== 100) return false;
      if (search && !path.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && path.category !== categoryFilter) return false;
      if (difficultyFilter !== 'all' && path.difficulty !== difficultyFilter) return false;
      return true;
    })
    .sort((a, b) => {
      // Enrolled paths first, then by rating
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return b.rating - a.rating;
    });

  const stats = {
    enrolled: learningPaths.filter((p) => p.isEnrolled).length,
    completed: learningPaths.filter((p) => p.progress === 100).length,
    hoursLearned: 42,
    skillsGained: 8,
  };

  const getDifficultyColor = (difficulty: LearningPath['difficulty']) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-700';
      case 'Advanced':
        return 'bg-purple-100 text-purple-700';
      case 'Expert':
        return 'bg-red-100 text-red-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Learning Paths</h1>
              <p className="text-gray-500">Structured learning journeys to master new skills</p>
            </div>
            <Link
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              href="/learn/paths/create"
            >
              Create Custom Path
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <p className="text-2xl font-bold text-indigo-600">{stats.enrolled}</p>
              </div>
              <p className="text-sm text-indigo-700">Active Paths</p>
            </div>
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <p className="text-sm text-green-700">Completed</p>
            </div>
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <p className="text-2xl font-bold text-purple-600">{stats.hoursLearned}h</p>
              </div>
              <p className="text-sm text-purple-700">Hours Learned</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-600" />
                <p className="text-2xl font-bold text-amber-600">{stats.skillsGained}</p>
              </div>
              <p className="text-sm text-amber-700">Skills Gained</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              {(['all', 'enrolled', 'completed'] as const).map((t) => (
                <button
                  key={t}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm capitalize transition-colors',
                    tab === t ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  )}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Search paths..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filters */}
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              {difficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {diff === 'all' ? 'All Levels' : diff}
                </option>
              ))}
            </select>
          </div>

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

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className={cn(view === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4')}>
          {filteredPaths.map((path) => (
            <Link
              key={path.id}
              className={cn(
                'overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md',
                view === 'list' && 'flex'
              )}
              href={`/learn/paths/${path.id}`}
            >
              {view === 'grid' ? (
                <>
                  {/* Grid View */}
                  <div className="p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{path.name}</h3>
                          {path.isEnrolled &&
                            path.progress !== undefined &&
                            path.progress < 100 && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                                In Progress
                              </span>
                            )}
                          {path.progress === 100 && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm text-gray-500">{path.description}</p>
                      </div>
                    </div>

                    {/* Progress */}
                    {path.isEnrolled && path.progress !== undefined && (
                      <div className="mb-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium text-gray-900">{path.progress}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-indigo-600"
                            style={{ width: `${path.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="mb-3 flex items-center gap-3 text-sm text-gray-500">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          getDifficultyColor(path.difficulty)
                        )}
                      >
                        {path.difficulty}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {path.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {path.itemCount} items
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {path.rating}
                      </span>
                    </div>

                    {/* Skills */}
                    <div className="mb-4 flex flex-wrap gap-1">
                      {path.skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {skill}
                        </span>
                      ))}
                      {path.skills.length > 4 && (
                        <span className="px-2 py-0.5 text-xs text-gray-400">
                          +{path.skills.length - 4} more
                        </span>
                      )}
                    </div>

                    {/* Outcomes */}
                    <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <DollarSign className="h-4 w-4" />
                        {path.outcomes.rateIncrease}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-blue-600">
                        <Briefcase className="h-4 w-4" />
                        {path.outcomes.jobMatches} jobs
                      </span>
                      {path.outcomes.certification && (
                        <span className="flex items-center gap-1 text-sm text-purple-600">
                          <Award className="h-4 w-4" />
                          Certification
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* List View */}
                  <div className="flex-1 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{path.name}</h3>
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 text-xs font-medium',
                              getDifficultyColor(path.difficulty)
                            )}
                          >
                            {path.difficulty}
                          </span>
                          {path.isEnrolled &&
                            path.progress !== undefined &&
                            path.progress < 100 && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                                {path.progress}% complete
                              </span>
                            )}
                        </div>
                        <p className="mb-2 text-sm text-gray-500">{path.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {path.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {path.itemCount} items
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {path.enrollments.toLocaleString()} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {path.rating}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {path.isEnrolled ? (
                          <span className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
                            <Play className="h-4 w-4" />
                            Continue
                          </span>
                        ) : (
                          <span className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600">
                            Enroll
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>

        {filteredPaths.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-lg font-medium text-gray-900">No learning paths found</p>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
