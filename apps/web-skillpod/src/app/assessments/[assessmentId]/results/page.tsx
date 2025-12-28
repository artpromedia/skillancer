'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Trophy,
  XCircle,
  Clock,
  Target,
  BarChart3,
  Share2,
  Download,
  Award,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Mock results data
const mockResults = {
  attemptId: 'attempt-123',
  assessmentId: 'react-advanced',
  assessmentTitle: 'React Advanced Patterns',
  status: 'passed',
  score: 85,
  passingScore: 75,
  percentile: 82,
  timeTaken: 48, // minutes
  timeAllowed: 60,
  questionsTotal: 40,
  questionsCorrect: 34,
  completedAt: '2024-01-20T14:30:00Z',
  sections: [
    { name: 'Compound Components', score: 90, total: 8, correct: 7 },
    { name: 'Render Props & HOCs', score: 75, total: 8, correct: 6 },
    { name: 'Custom Hooks', score: 100, total: 8, correct: 8 },
    { name: 'Performance Optimization', score: 75, total: 8, correct: 6 },
    { name: 'State Management', score: 87, total: 8, correct: 7 },
  ],
  strengths: ['Custom Hooks', 'Compound Components', 'Context API'],
  improvements: ['Render Props patterns', 'Memoization strategies', 'useReducer patterns'],
  credential: {
    id: 'cred-456',
    name: 'React Advanced Patterns Certified',
    badge: '🏆',
    verificationUrl: 'https://skillancer.com/verify/abc123',
  },
  retakeInfo: null, // Would have info if failed
};

export default function AssessmentResultsPage() {
  const [showDetailedReview, setShowDetailedReview] = useState(false);
  const [animateScore, setAnimateScore] = useState(false);

  const results = mockResults;
  const isPassed = results.status === 'passed';

  useEffect(() => {
    // Animate score after mount
    const timer = setTimeout(() => setAnimateScore(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const getSectionColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Result */}
      <div
        className={cn(
          'text-white',
          isPassed
            ? 'bg-gradient-to-r from-green-600 to-emerald-600'
            : 'bg-gradient-to-r from-red-600 to-rose-600'
        )}
      >
        <div className="mx-auto max-w-4xl px-4 py-8">
          <Link
            className="mb-6 inline-flex items-center gap-1 text-white/80 hover:text-white"
            href="/assessments"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessments
          </Link>

          <div className="text-center">
            {/* Result Icon with Animation */}
            <div
              className={cn(
                'mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full transition-transform duration-500',
                animateScore ? 'scale-100' : 'scale-0',
                'bg-white/20'
              )}
            >
              {isPassed ? <Trophy className="h-12 w-12" /> : <XCircle className="h-12 w-12" />}
            </div>

            <h1 className="mb-2 text-3xl font-bold">
              {isPassed ? 'Congratulations!' : 'Keep Learning!'}
            </h1>
            <p className="mb-6 text-white/80">
              {isPassed
                ? 'You passed the assessment and earned a new credential!'
                : "You didn't pass this time, but you can try again."}
            </p>

            {/* Score Display */}
            <div className="inline-flex items-center gap-8 rounded-xl bg-white/10 px-8 py-6 backdrop-blur">
              <div className="text-center">
                <p className="mb-1 text-sm text-white/70">Your Score</p>
                <p
                  className={cn(
                    'text-5xl font-bold transition-all duration-1000',
                    animateScore ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  {results.score}%
                </p>
              </div>
              <div className="h-16 w-px bg-white/20" />
              <div className="text-center">
                <p className="mb-1 text-sm text-white/70">Passing Score</p>
                <p className="text-3xl font-semibold">{results.passingScore}%</p>
              </div>
              <div className="h-16 w-px bg-white/20" />
              <div className="text-center">
                <p className="mb-1 text-sm text-white/70">Percentile</p>
                <p className="text-3xl font-semibold">{results.percentile}th</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {results.timeTaken} min (of {results.timeAllowed} min)
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {results.questionsCorrect}/{results.questionsTotal} correct
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Top {100 - results.percentile}% of test takers
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Score Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Score Breakdown by Topic</h2>
              <div className="space-y-4">
                {results.sections.map((section) => (
                  <div key={section.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{section.name}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {section.score}% ({section.correct}/{section.total})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          getSectionColor(section.score)
                        )}
                        style={{ width: animateScore ? `${section.score}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Strengths</h3>
                </div>
                <ul className="space-y-2">
                  {results.strengths.map((strength) => (
                    <li key={strength} className="flex items-center gap-2 text-sm text-green-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900">Areas to Improve</h3>
                </div>
                <ul className="space-y-2">
                  {results.improvements.map((improvement) => (
                    <li
                      key={improvement}
                      className="flex items-center gap-2 text-sm text-amber-800"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Detailed Review */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                className="flex w-full items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => setShowDetailedReview(!showDetailedReview)}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Detailed Question Review</span>
                </div>
                {showDetailedReview ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>
              {showDetailedReview && (
                <div className="border-t border-gray-200 p-4">
                  <p className="py-8 text-center text-gray-600">
                    Detailed question review is available for premium users.
                    <br />
                    <Link className="text-indigo-600 hover:underline" href="/upgrade">
                      Upgrade to access
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* Recommended Learning */}
            {!isPassed && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 font-semibold text-gray-900">Recommended Study Materials</h2>
                <div className="space-y-3">
                  {results.improvements.map((topic) => (
                    <Link
                      key={topic}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                      href={`/learn/search?q=${encodeURIComponent(topic)}`}
                    >
                      <span className="text-gray-700">{topic}</span>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Credential Card (if passed) */}
            {isPassed && results.credential && (
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Credential Earned!</h3>
                </div>

                <div className="mb-4 rounded-lg bg-white p-4 text-center">
                  <span className="mb-2 block text-5xl">{results.credential.badge}</span>
                  <p className="font-medium text-gray-900">{results.credential.name}</p>
                </div>

                <div className="space-y-2">
                  <Link
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700"
                    href={`/credentials/${results.credential.id}`}
                  >
                    <Award className="h-4 w-4" />
                    View Credential
                  </Link>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 font-medium hover:bg-gray-50">
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 font-medium hover:bg-gray-50">
                    <Download className="h-4 w-4" />
                    Download Certificate
                  </button>
                </div>
              </div>
            )}

            {/* Retake Options (if failed) */}
            {!isPassed && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Try Again</h3>
                </div>

                <p className="mb-4 text-gray-600">
                  You can retake this assessment after a 7-day waiting period.
                </p>

                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-500">Next available</p>
                  <p className="font-medium text-gray-900">January 27, 2024</p>
                </div>

                <button className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700">
                  Schedule Retake
                </button>
              </div>
            )}

            {/* Assessment Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Assessment Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Assessment</dt>
                  <dd className="font-medium text-gray-900">{results.assessmentTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Completed</dt>
                  <dd className="text-gray-900">
                    {new Date(results.completedAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="text-gray-900">{results.timeTaken} minutes</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Questions</dt>
                  <dd className="text-gray-900">{results.questionsTotal}</dd>
                </div>
              </dl>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 font-medium hover:bg-gray-50"
                href="/assessments"
              >
                Browse More Assessments
              </Link>
              <Link
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 font-medium hover:bg-gray-50"
                href="/learn"
              >
                Continue Learning
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
