'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Activity,
  Calendar,
  Clock,
  BookOpen,
  Code,
  Award,
  Play,
  Download,
  Flame,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import ActivityTimeline from '../../../components/learning/activity-timeline';
import LearningGoals from '../../../components/learning/learning-goals';

// Mock data
const activityStats = {
  totalHours: 127,
  thisWeek: 8.5,
  streak: 12,
  coursesCompleted: 14,
  certificationsEarned: 3,
  projectsFinished: 7,
};

const recentActivity = [
  {
    id: '1',
    type: 'progress' as const,
    title: 'Advanced React Patterns',
    subtitle: 'Completed Module 4: Compound Components',
    time: '2 hours ago',
    duration: '45 min',
    progress: 65,
  },
  {
    id: '2',
    type: 'completed' as const,
    title: 'TypeScript Fundamentals',
    subtitle: 'Course completed with 92% score',
    time: '1 day ago',
    duration: '8 hours total',
    badge: 'Certificate Earned',
  },
  {
    id: '3',
    type: 'started' as const,
    title: 'AWS Solutions Architect',
    subtitle: 'Started certification preparation',
    time: '2 days ago',
    duration: 'Est. 40 hours',
  },
  {
    id: '4',
    type: 'achievement' as const,
    title: '7-Day Learning Streak',
    subtitle: 'Unlocked streak achievement',
    time: '3 days ago',
  },
  {
    id: '5',
    type: 'project' as const,
    title: 'Build a SaaS Dashboard',
    subtitle: 'Submitted project for review',
    time: '4 days ago',
    duration: '12 hours spent',
  },
];

const weeklyData = [
  { day: 'Mon', hours: 1.5, target: 1 },
  { day: 'Tue', hours: 2, target: 1 },
  { day: 'Wed', hours: 0.5, target: 1 },
  { day: 'Thu', hours: 1.5, target: 1 },
  { day: 'Fri', hours: 2, target: 1 },
  { day: 'Sat', hours: 0, target: 1 },
  { day: 'Sun', hours: 1, target: 1 },
];

export default function ActivityPage() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
  const [view, setView] = useState<'timeline' | 'calendar' | 'stats'>('timeline');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link
            className="mb-4 inline-flex items-center gap-1 text-white/80 hover:text-white"
            href="/learn"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Activity className="h-6 w-6" />
                <h1 className="text-2xl font-bold">Learning Activity</h1>
              </div>
              <p className="text-white/80">Track your progress, streaks, and achievements</p>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 transition-colors hover:bg-white/20">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mx-auto -mt-6 max-w-7xl px-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-gray-500">Total Hours</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.totalHours}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-500">This Week</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.thisWeek}h</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-gray-500">Day Streak</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.streak}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-500">Courses</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.coursesCompleted}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-gray-500">Certifications</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.certificationsEarned}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Code className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-500">Projects</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{activityStats.projectsFinished}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
            {(['timeline', 'calendar', 'stats'] as const).map((v) => (
              <button
                key={v}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                  view === v ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100'
                )}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1">
            {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
              <button
                key={range}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                  timeRange === range ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-gray-100'
                )}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pb-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Activity */}
          <div className="space-y-6 lg:col-span-2">
            {/* Weekly Chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Weekly Learning Hours</h3>
              <div className="flex h-40 items-end gap-2">
                {weeklyData.map((day, idx) => {
                  const height = (day.hours / 2.5) * 100;
                  const targetHeight = (day.target / 2.5) * 100;
                  const isToday =
                    idx === new Date().getDay() - 1 || (idx === 6 && new Date().getDay() === 0);
                  return (
                    <div key={day.day} className="flex flex-1 flex-col items-center">
                      <div
                        className="relative flex w-full justify-center"
                        style={{ height: '120px' }}
                      >
                        {/* Target line */}
                        <div
                          className="absolute w-full border-t-2 border-dashed border-gray-300"
                          style={{ bottom: `${targetHeight}%` }}
                        />
                        {/* Actual bar */}
                        <div
                          className={cn(
                            'w-8 rounded-t transition-all',
                            day.hours >= day.target ? 'bg-emerald-500' : 'bg-gray-300',
                            isToday && 'ring-2 ring-emerald-400 ring-offset-2'
                          )}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          'mt-2 text-xs',
                          isToday ? 'font-bold text-emerald-600' : 'text-gray-500'
                        )}
                      >
                        {day.day}
                      </span>
                      <span className="text-xs text-gray-400">{day.hours}h</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-emerald-500" /> Goal met
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-gray-300" /> Below goal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-8 border-t-2 border-dashed border-gray-300" /> Daily target
                </span>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                <Link
                  className="text-sm text-emerald-600 hover:text-emerald-700"
                  href="/learn/activity/all"
                >
                  View all
                </Link>
              </div>
              <ActivityTimeline activities={recentActivity} />
            </div>

            {/* In Progress */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Continue Learning</h3>
              <div className="space-y-3">
                {[
                  {
                    title: 'Advanced React Patterns',
                    progress: 65,
                    provider: 'Frontend Masters',
                    lastActivity: '2 hours ago',
                  },
                  {
                    title: 'AWS Solutions Architect',
                    progress: 12,
                    provider: 'AWS Training',
                    lastActivity: '2 days ago',
                  },
                  {
                    title: 'System Design Interview Prep',
                    progress: 35,
                    provider: 'Skillpod',
                    lastActivity: '1 week ago',
                  },
                ].map((course) => (
                  <Link
                    key={course.title}
                    className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-gray-50"
                    href={`/learn/course/${encodeURIComponent(course.title)}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                      <Play className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{course.title}</p>
                      <p className="text-sm text-gray-500">
                        {course.provider} • {course.lastActivity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-emerald-600">{course.progress}%</p>
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Goals & Achievements */}
          <div className="space-y-6">
            {/* Learning Goals */}
            <LearningGoals />

            {/* Achievements */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Achievements</h3>
                <Link
                  className="text-sm text-emerald-600 hover:text-emerald-700"
                  href="/learn/achievements"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { icon: '🔥', title: '7-Day Streak', date: '3 days ago' },
                  { icon: '🎓', title: 'First Certification', date: '1 week ago' },
                  { icon: '📚', title: '10 Courses Completed', date: '2 weeks ago' },
                  { icon: '⭐', title: 'Top 10% Learner', date: '1 month ago' },
                ].map((achievement) => (
                  <div
                    key={achievement.title}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50"
                  >
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900">{achievement.title}</p>
                      <p className="text-xs text-gray-500">{achievement.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills Progress */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Skills Growing</h3>
              <div className="space-y-3">
                {[
                  { name: 'React', growth: '+15%', hours: 24 },
                  { name: 'TypeScript', growth: '+22%', hours: 18 },
                  { name: 'AWS', growth: '+8%', hours: 12 },
                  { name: 'Node.js', growth: '+5%', hours: 8 },
                ].map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{skill.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{skill.hours}h</span>
                      <span className="text-sm font-medium text-emerald-600">{skill.growth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
