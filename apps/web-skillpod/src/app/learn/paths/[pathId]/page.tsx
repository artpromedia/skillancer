'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  Award,
  Star,
  Users,
  Play,
  CheckCircle2,
  Lock,
  ChevronRight,
  DollarSign,
  Briefcase,
  Share2,
  Bookmark,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import PathItem from '@/components/learning/path-item';
import PathRoadmap from '@/components/learning/path-roadmap';

interface PathModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  itemCount: number;
  type: 'course' | 'project' | 'assessment' | 'certification';
  status: 'completed' | 'in-progress' | 'locked' | 'available';
  items: PathItemData[];
}

interface PathItemData {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'quiz' | 'exercise' | 'project';
  duration: string;
  status: 'completed' | 'in-progress' | 'locked' | 'available';
}

export default function LearningPathDetailPage() {
  const params = useParams();
  const pathId = params.pathId;
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'community'>('overview');
  const [expandedModule, setExpandedModule] = useState<string | null>('1');

  // Mock path data
  const path = {
    id: pathId,
    name: 'Full-Stack JavaScript Mastery',
    description:
      'Master modern JavaScript development from frontend to backend. This comprehensive path covers React, Node.js, TypeScript, databases, and cloud deployment. Perfect for developers looking to become full-stack experts.',
    category: 'Web Development',
    duration: '80 hours',
    difficulty: 'Intermediate' as const,
    itemCount: 24,
    enrollments: 12500,
    rating: 4.8,
    reviewCount: 2340,
    completionRate: 68,
    skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker'],
    prerequisites: ['JavaScript Fundamentals', 'Basic HTML/CSS', 'Command Line Basics'],
    outcomes: {
      rateIncrease: '+$25/hr',
      jobMatches: 450,
      certification: 'Full-Stack Developer Certificate',
    },
    progress: 45,
    isEnrolled: true,
    instructor: {
      name: 'Alex Chen',
      title: 'Senior Software Engineer at Google',
      avatar: null,
      students: 45000,
    },
    modules: [
      {
        id: '1',
        title: 'React Fundamentals',
        description: 'Build a solid foundation in React with hooks, state, and component patterns.',
        duration: '12 hours',
        itemCount: 8,
        type: 'course' as const,
        status: 'completed' as const,
        items: [
          {
            id: '1-1',
            title: 'Introduction to React',
            type: 'video' as const,
            duration: '15m',
            status: 'completed' as const,
          },
          {
            id: '1-2',
            title: 'Components & Props',
            type: 'video' as const,
            duration: '25m',
            status: 'completed' as const,
          },
          {
            id: '1-3',
            title: 'State & Lifecycle',
            type: 'video' as const,
            duration: '30m',
            status: 'completed' as const,
          },
          {
            id: '1-4',
            title: 'Hooks Deep Dive',
            type: 'video' as const,
            duration: '45m',
            status: 'completed' as const,
          },
          {
            id: '1-5',
            title: 'Practice: Counter App',
            type: 'exercise' as const,
            duration: '30m',
            status: 'completed' as const,
          },
          {
            id: '1-6',
            title: 'Context API',
            type: 'video' as const,
            duration: '20m',
            status: 'completed' as const,
          },
          {
            id: '1-7',
            title: 'React Patterns Quiz',
            type: 'quiz' as const,
            duration: '15m',
            status: 'completed' as const,
          },
          {
            id: '1-8',
            title: 'Project: Todo App',
            type: 'project' as const,
            duration: '2h',
            status: 'completed' as const,
          },
        ],
      },
      {
        id: '2',
        title: 'Advanced React & TypeScript',
        description:
          'Level up with TypeScript integration, performance optimization, and advanced patterns.',
        duration: '15 hours',
        itemCount: 10,
        type: 'course' as const,
        status: 'in-progress' as const,
        items: [
          {
            id: '2-1',
            title: 'TypeScript Basics',
            type: 'video' as const,
            duration: '30m',
            status: 'completed' as const,
          },
          {
            id: '2-2',
            title: 'React with TypeScript',
            type: 'video' as const,
            duration: '45m',
            status: 'completed' as const,
          },
          {
            id: '2-3',
            title: 'Type Safety Patterns',
            type: 'reading' as const,
            duration: '20m',
            status: 'in-progress' as const,
          },
          {
            id: '2-4',
            title: 'Performance Optimization',
            type: 'video' as const,
            duration: '40m',
            status: 'available' as const,
          },
          {
            id: '2-5',
            title: 'React.memo & useMemo',
            type: 'exercise' as const,
            duration: '30m',
            status: 'available' as const,
          },
          {
            id: '2-6',
            title: 'Code Splitting',
            type: 'video' as const,
            duration: '25m',
            status: 'locked' as const,
          },
          {
            id: '2-7',
            title: 'Error Boundaries',
            type: 'video' as const,
            duration: '20m',
            status: 'locked' as const,
          },
          {
            id: '2-8',
            title: 'Testing React Apps',
            type: 'video' as const,
            duration: '45m',
            status: 'locked' as const,
          },
          {
            id: '2-9',
            title: 'Advanced Patterns Quiz',
            type: 'quiz' as const,
            duration: '20m',
            status: 'locked' as const,
          },
          {
            id: '2-10',
            title: 'Project: Dashboard',
            type: 'project' as const,
            duration: '4h',
            status: 'locked' as const,
          },
        ],
      },
      {
        id: '3',
        title: 'Node.js & Express',
        description: 'Build robust backend APIs with Node.js, Express, and middleware patterns.',
        duration: '14 hours',
        itemCount: 9,
        type: 'course' as const,
        status: 'locked' as const,
        items: [
          {
            id: '3-1',
            title: 'Node.js Fundamentals',
            type: 'video' as const,
            duration: '35m',
            status: 'locked' as const,
          },
          {
            id: '3-2',
            title: 'Express Framework',
            type: 'video' as const,
            duration: '40m',
            status: 'locked' as const,
          },
          {
            id: '3-3',
            title: 'REST API Design',
            type: 'video' as const,
            duration: '30m',
            status: 'locked' as const,
          },
          {
            id: '3-4',
            title: 'Middleware Patterns',
            type: 'reading' as const,
            duration: '25m',
            status: 'locked' as const,
          },
          {
            id: '3-5',
            title: 'Authentication & JWT',
            type: 'video' as const,
            duration: '45m',
            status: 'locked' as const,
          },
          {
            id: '3-6',
            title: 'Error Handling',
            type: 'video' as const,
            duration: '20m',
            status: 'locked' as const,
          },
          {
            id: '3-7',
            title: 'Practice: Auth API',
            type: 'exercise' as const,
            duration: '1h',
            status: 'locked' as const,
          },
          {
            id: '3-8',
            title: 'Backend Quiz',
            type: 'quiz' as const,
            duration: '20m',
            status: 'locked' as const,
          },
          {
            id: '3-9',
            title: 'Project: Blog API',
            type: 'project' as const,
            duration: '4h',
            status: 'locked' as const,
          },
        ],
      },
      {
        id: '4',
        title: 'Databases & Data Modeling',
        description: 'Master both SQL and NoSQL databases with real-world data modeling.',
        duration: '12 hours',
        itemCount: 8,
        type: 'course' as const,
        status: 'locked' as const,
        items: [],
      },
      {
        id: '5',
        title: 'Full-Stack Capstone Project',
        description: 'Build a complete full-stack application from scratch.',
        duration: '20 hours',
        itemCount: 1,
        type: 'project' as const,
        status: 'locked' as const,
        items: [],
      },
      {
        id: '6',
        title: 'Final Assessment',
        description: 'Demonstrate your full-stack mastery and earn your certificate.',
        duration: '3 hours',
        itemCount: 1,
        type: 'certification' as const,
        status: 'locked' as const,
        items: [],
      },
    ] as PathModule[],
  };

  const getModuleTypeIcon = (type: PathModule['type']) => {
    switch (type) {
      case 'course':
        return BookOpen;
      case 'project':
        return Briefcase;
      case 'assessment':
        return Award;
      case 'certification':
        return Award;
    }
  };

  const getModuleStatusIcon = (
    module: PathModule,
    ModuleIcon: React.ComponentType<{ className?: string }>
  ) => {
    if (module.status === 'completed') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (module.status === 'locked') {
      return <Lock className="h-5 w-5 text-gray-400" />;
    }
    return (
      <ModuleIcon
        className={cn(
          'h-5 w-5',
          module.status === 'in-progress' ? 'text-indigo-600' : 'text-gray-600'
        )}
      />
    );
  };

  const completedModules = path.modules.filter((m) => m.status === 'completed').length;
  const totalModules = path.modules.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link
            className="mb-4 inline-flex items-center gap-1 text-sm text-indigo-200 hover:text-white"
            href="/learn/paths"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Learning Paths
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-bold">{path.name}</h1>
                <span className={cn('rounded bg-white/20 px-2 py-0.5 text-xs font-medium')}>
                  {path.difficulty}
                </span>
              </div>
              <p className="mb-4 max-w-2xl text-indigo-100">{path.description}</p>

              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {path.duration}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {path.itemCount} items
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {path.enrollments.toLocaleString()} enrolled
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {path.rating} ({path.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20">
                <Bookmark className="h-5 w-5" />
              </button>
              <button className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress */}
          {path.isEnrolled && (
            <div className="mt-6 rounded-xl bg-white/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm">Your Progress</span>
                <span className="text-sm font-medium">{path.progress}% complete</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${path.progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-indigo-200">
                {completedModules} of {totalModules} modules completed
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6 flex gap-6">
            {(['overview', 'curriculum', 'community'] as const).map((tab) => (
              <button
                key={tab}
                className={cn(
                  'border-b-2 pb-2 text-sm font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'border-white text-white'
                    : 'border-transparent text-indigo-200 hover:text-white'
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              {/* Roadmap Visualization */}
              <PathRoadmap modules={path.modules} />

              {/* Skills */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Skills You&apos;ll Learn</h3>
                <div className="flex flex-wrap gap-2">
                  {path.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Prerequisites */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Prerequisites</h3>
                <ul className="space-y-2">
                  {path.prerequisites.map((prereq) => (
                    <li key={prereq} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {prereq}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* CTA */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                {path.isEnrolled ? (
                  <Link
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
                    href={`/learn/paths/${String(path.id)}/continue`}
                  >
                    <Play className="h-5 w-5" />
                    Continue Learning
                  </Link>
                ) : (
                  <button className="w-full rounded-lg bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700">
                    Enroll Now
                  </button>
                )}
              </div>

              {/* Outcomes */}
              <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Career Impact</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{path.outcomes.rateIncrease}</p>
                      <p className="text-sm text-gray-500">Average rate increase</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <Briefcase className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{path.outcomes.jobMatches} jobs</p>
                      <p className="text-sm text-gray-500">Matching opportunities</p>
                    </div>
                  </div>
                  {path.outcomes.certification && (
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-100 p-2">
                        <Award className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Certificate</p>
                        <p className="text-sm text-gray-500">{path.outcomes.certification}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructor */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="mb-4 font-semibold text-gray-900">Instructor</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600">
                    {path.instructor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{path.instructor.name}</p>
                    <p className="text-sm text-gray-500">{path.instructor.title}</p>
                    <p className="text-xs text-gray-400">
                      {path.instructor.students.toLocaleString()} students
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            {path.modules.map((module) => {
              const ModuleIcon = getModuleTypeIcon(module.type);
              const isExpanded = expandedModule === module.id;
              return (
                <div
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <button
                    className="flex w-full items-center justify-between p-5 transition-colors hover:bg-gray-50"
                    onClick={() => setExpandedModule(isExpanded ? null : module.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          module.status === 'completed' && 'bg-green-100',
                          module.status === 'in-progress' && 'bg-indigo-100',
                          module.status === 'available' && 'bg-gray-100',
                          module.status === 'locked' && 'bg-gray-50'
                        )}
                      >
                        {getModuleStatusIcon(module, ModuleIcon)}
                      </div>
                      <div className="text-left">
                        <h4 className="font-medium text-gray-900">{module.title}</h4>
                        <p className="text-sm text-gray-500">{module.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-700">{module.duration}</p>
                        <p className="text-xs text-gray-500">{module.itemCount} items</p>
                      </div>
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 text-gray-400 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </div>
                  </button>

                  {isExpanded && module.items.length > 0 && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {module.items.map((item) => (
                        <PathItem
                          key={item.id}
                          item={item}
                          moduleId={module.id}
                          pathId={path.id as string}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'community' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <MessageCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">Community Discussions</h3>
            <p className="mb-4 text-gray-500">Connect with other learners on this path</p>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
              Join Discussion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
