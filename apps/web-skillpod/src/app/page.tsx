'use client';

import {
  ClipboardCheck,
  Award,
  BookOpen,
  TrendingUp,
  Clock,
  ChevronRight,
  Target,
  Play,
} from 'lucide-react';
import Link from 'next/link';

import { ProfileSidebar } from '@/components/layout/profile-sidebar';

// Mock data
const recommendedAssessments = [
  {
    id: '1',
    title: 'React Advanced Patterns',
    category: 'Frontend',
    difficulty: 'Advanced',
    duration: 60,
    skills: ['React', 'TypeScript', 'State Management'],
    popularity: 92,
  },
  {
    id: '2',
    title: 'Node.js Backend Development',
    category: 'Backend',
    difficulty: 'Intermediate',
    duration: 45,
    skills: ['Node.js', 'Express', 'APIs'],
    popularity: 88,
  },
  {
    id: '3',
    title: 'AWS Cloud Practitioner',
    category: 'Cloud',
    difficulty: 'Beginner',
    duration: 90,
    skills: ['AWS', 'Cloud Computing'],
    popularity: 95,
  },
];

const recentActivity = [
  {
    id: 'activity-1',
    type: 'credential',
    title: 'Earned React Expert credential',
    time: '2 days ago',
    icon: Award,
  },
  {
    id: 'activity-2',
    type: 'assessment',
    title: 'Completed TypeScript assessment (88%)',
    time: '1 week ago',
    icon: ClipboardCheck,
  },
  {
    id: 'activity-3',
    type: 'learning',
    title: 'Started AWS Learning Path',
    time: '2 weeks ago',
    icon: BookOpen,
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Alex! 👋</h1>
        <p className="mt-1 text-gray-500">Continue building your verified skill portfolio</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-8 lg:col-span-2">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link
              className="group flex items-center gap-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 p-4 text-white transition-colors hover:from-indigo-600 hover:to-indigo-700"
              href="/assessments"
            >
              <div className="rounded-xl bg-white/20 p-3">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Take Assessment</p>
                <p className="text-sm opacity-80">Verify your skills</p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>

            <Link
              className="group flex items-center gap-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 p-4 text-white transition-colors hover:from-purple-600 hover:to-purple-700"
              href="/credentials"
            >
              <div className="rounded-xl bg-white/20 p-3">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">My Credentials</p>
                <p className="text-sm opacity-80">View & share</p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>

            <Link
              className="group flex items-center gap-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 text-white transition-colors hover:from-emerald-600 hover:to-emerald-700"
              href="/learn"
            >
              <div className="rounded-xl bg-white/20 p-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Continue Learning</p>
                <p className="text-sm opacity-80">Pick up where you left</p>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>
          </div>

          {/* Recommended Assessments */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Target className="h-5 w-5 text-indigo-600" />
                Recommended for You
              </h2>
              <Link className="text-sm text-indigo-600 hover:text-indigo-700" href="/assessments">
                View all
              </Link>
            </div>

            <div className="space-y-4">
              {recommendedAssessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="rounded-xl bg-indigo-50 p-3 transition-colors group-hover:bg-indigo-100">
                    <ClipboardCheck className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900">{assessment.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                      <span>{assessment.category}</span>
                      <span>•</span>
                      <span>{assessment.difficulty}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {assessment.duration} min
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {assessment.skills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {assessment.popularity}% popularity
                      </div>
                    </div>
                    <Link
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                      href={`/assessments/${assessment.id}`}
                    >
                      <Play className="h-4 w-4" />
                      Start
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h2>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <activity.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <ProfileSidebar className="hidden lg:block" />
      </div>
    </div>
  );
}
