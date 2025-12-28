'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Clock,
  Target,
  BookOpen,
  Award,
  Shield,
  Camera,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Play,
  Info,
  Users,
  Star,
  BarChart3,
  Lock,
  Laptop,
  Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

// Mock assessment data
const mockAssessment = {
  id: 'react-advanced',
  title: 'React Advanced Patterns',
  description:
    'Test your knowledge of advanced React patterns including compound components, render props, higher-order components, custom hooks, performance optimization, and state management patterns.',
  category: 'Frontend Development',
  difficulty: 'Advanced',
  duration: 60, // minutes
  questions: 40,
  passingScore: 75,
  badge: '🏆',
  skills: ['React', 'TypeScript', 'Performance', 'Design Patterns'],
  objectives: [
    'Understand compound component patterns',
    'Implement render props and HOCs correctly',
    'Create performant custom hooks',
    'Apply memoization strategies',
    'Handle complex state management',
  ],
  prerequisites: ['Basic React knowledge', 'JavaScript ES6+', 'Basic TypeScript (recommended)'],
  proctoringRequired: true,
  proctoringRequirements: [
    { id: 'camera', label: 'Camera access for identity verification', icon: Camera },
    { id: 'screen', label: 'Screen sharing during assessment', icon: Monitor },
    { id: 'fullscreen', label: 'Full-screen mode required', icon: Laptop },
    { id: 'connection', label: 'Stable internet connection', icon: Wifi },
  ],
  credential: {
    name: 'React Advanced Patterns Certified',
    validFor: '2 years',
    benefits: [
      'Verified skill badge on profile',
      'Priority in job matching',
      '+15% average rate increase',
      'Access to advanced projects',
    ],
  },
  stats: {
    totalAttempts: 15420,
    passRate: 68,
    avgScore: 72,
    avgDuration: 52, // minutes
  },
  previousAttempts: [
    {
      id: 'attempt-1',
      date: '2024-01-05',
      score: 68,
      status: 'failed',
      canRetake: true,
      retakeDate: '2024-02-05',
    },
  ],
};

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const assessment = mockAssessment; // In real app, fetch by params.assessmentId

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-700';
      case 'Advanced':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStartAssessment = () => {
    router.push(`/assessments/${String(params.assessmentId)}/take`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Link
            className="mb-4 inline-flex items-center gap-1 text-white/80 hover:text-white"
            href="/assessments"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessments
          </Link>

          <div className="flex items-start gap-4">
            <span className="text-5xl">{assessment.badge}</span>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    getDifficultyColor(assessment.difficulty)
                  )}
                >
                  {assessment.difficulty}
                </span>
                <span className="text-white/60">•</span>
                <span className="text-sm text-white/80">{assessment.category}</span>
              </div>
              <h1 className="mb-2 text-2xl font-bold">{assessment.title}</h1>
              <p className="max-w-2xl text-white/80">{assessment.description}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <p className="text-xl font-semibold">{assessment.duration} min</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                <BookOpen className="h-4 w-4" />
                Questions
              </div>
              <p className="text-xl font-semibold">{assessment.questions}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                <Target className="h-4 w-4" />
                Passing Score
              </div>
              <p className="text-xl font-semibold">{assessment.passingScore}%</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
              <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
                <BarChart3 className="h-4 w-4" />
                Avg Score
              </div>
              <p className="text-xl font-semibold">{assessment.stats.avgScore}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Learning Objectives */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">What This Assessment Covers</h2>
              <ul className="space-y-2">
                {assessment.objectives.map((objective) => (
                  <li key={objective} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-gray-700">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Skills Tested */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Skills Tested</h2>
              <div className="flex flex-wrap gap-2">
                {assessment.skills.map((skill) => (
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
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Prerequisites</h2>
              <ul className="space-y-2">
                {assessment.prerequisites.map((prereq) => (
                  <li key={prereq} className="flex items-center gap-2 text-gray-700">
                    <Info className="h-4 w-4 text-blue-500" />
                    {prereq}
                  </li>
                ))}
              </ul>
            </div>

            {/* Proctoring Requirements */}
            {assessment.proctoringRequired && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <h2 className="font-semibold text-gray-900">Proctoring Requirements</h2>
                </div>
                <p className="mb-4 text-gray-600">
                  This assessment is proctored to ensure credential integrity. Please ensure you
                  meet the following requirements:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {assessment.proctoringRequirements.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                      <req.icon className="h-5 w-5 text-gray-600" />
                      <span className="text-sm text-gray-700">{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Attempts */}
            {assessment.previousAttempts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h2 className="font-semibold text-amber-900">Previous Attempts</h2>
                </div>
                {assessment.previousAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between rounded-lg bg-white p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        Score: <span className="text-red-600">{attempt.score}%</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(attempt.date).toLocaleDateString()}
                      </p>
                    </div>
                    {attempt.canRetake ? (
                      <p className="text-sm text-amber-700">
                        Retake available: {new Date(attempt.retakeDate).toLocaleDateString()}
                      </p>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Lock className="h-4 w-4" />
                        Retake locked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Start Card */}
            <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Ready to Start?</h3>

              <button
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
                onClick={handleStartAssessment}
              >
                <Play className="h-5 w-5" />
                Start Assessment
              </button>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowScheduleModal(true)}
              >
                <Calendar className="h-5 w-5" />
                Schedule for Later
              </button>

              <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Estimated time: {assessment.stats.avgDuration} min
                </p>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {assessment.stats.totalAttempts.toLocaleString()} have taken this
                </p>
                <p className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {assessment.stats.passRate}% pass rate
                </p>
              </div>
            </div>

            {/* Credential Preview */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">What You&apos;ll Earn</h3>
              </div>

              <div className="mb-4 rounded-lg bg-white p-4 text-center">
                <span className="mb-2 block text-4xl">{assessment.badge}</span>
                <p className="font-medium text-gray-900">{assessment.credential.name}</p>
                <p className="text-sm text-gray-500">Valid for {assessment.credential.validFor}</p>
              </div>

              <ul className="space-y-2">
                {assessment.credential.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Tips for Success</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-indigo-600">1.</span> Read each question
                  carefully before answering
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-indigo-600">2.</span> Manage your time -
                  don&apos;t spend too long on one question
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-indigo-600">3.</span> Flag difficult questions
                  and return to them later
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-indigo-600">4.</span> Ensure stable internet and
                  quiet environment
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Schedule Assessment</h2>
            </div>
            <p className="mb-4 text-gray-600">
              Choose a date and time to take the {assessment.title} assessment.
            </p>
            <div className="mb-4 space-y-3">
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="schedule-date"
                >
                  Date
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="schedule-date"
                  type="date"
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="schedule-time"
                >
                  Time
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="schedule-time"
                  type="time"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700"
                onClick={() => setShowScheduleModal(false)}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
