'use client';

import { cn } from '@skillancer/ui';
import {
  Award,
  TrendingUp,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ChevronRight,
  Target,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

import { SkillConfidenceMeter } from '../skills/skill-confidence-meter';

// Mock data for profile sidebar
const mockCredentials = [
  {
    id: '1',
    name: 'React Expert',
    level: 'expert' as const,
    badge: '⚛️',
    gradient: 'from-cyan-500 to-blue-600',
    status: 'active' as const,
  },
  {
    id: '2',
    name: 'TypeScript Pro',
    level: 'professional' as const,
    badge: '📘',
    gradient: 'from-blue-500 to-indigo-600',
    status: 'active' as const,
  },
  {
    id: '3',
    name: 'AWS Associate',
    level: 'associate' as const,
    badge: '☁️',
    gradient: 'from-orange-500 to-amber-600',
    status: 'active' as const,
  },
];

const mockTopSkills = [
  { name: 'React', confidence: 95, verified: true },
  { name: 'TypeScript', confidence: 88, verified: true },
  { name: 'Node.js', confidence: 82, verified: true },
  { name: 'AWS', confidence: 75, verified: false },
  { name: 'GraphQL', confidence: 70, verified: false },
];

const mockUpcomingAssessments = [
  { id: '1', title: 'AWS Solutions Architect', scheduledAt: '2024-01-20T10:00:00', duration: 90 },
  { id: '2', title: 'Docker & Kubernetes', scheduledAt: '2024-01-25T14:00:00', duration: 60 },
];

// Profile Credentials Card
export function ProfileCredentialsCard({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Award className="h-5 w-5 text-indigo-600" />
          My Credentials
        </h3>
        <Link className="text-sm text-indigo-600 hover:text-indigo-700" href="/credentials">
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {mockCredentials.slice(0, 3).map((cred) => (
          <Link
            key={cred.id}
            className="-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
            href={`/credentials/${cred.id}`}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-lg',
                cred.gradient
              )}
            >
              {cred.badge}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{cred.name}</p>
              <p className="text-xs capitalize text-gray-500">{cred.level}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </Link>
        ))}
      </div>

      {mockCredentials.length > 3 && (
        <Link
          className="mt-4 flex items-center justify-center gap-1 py-2 text-sm text-gray-500 transition-colors hover:text-indigo-600"
          href="/credentials"
        >
          +{mockCredentials.length - 3} more credentials
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// Profile Skills Card
export function ProfileSkillsCard({ className }: Readonly<{ className?: string }>) {
  const verifiedSkills = mockTopSkills.filter((s) => s.verified);

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Target className="h-5 w-5 text-indigo-600" />
          Top Skills
        </h3>
        <span className="text-xs text-gray-500">
          {verifiedSkills.length}/{mockTopSkills.length} verified
        </span>
      </div>

      <div className="space-y-4">
        {mockTopSkills.slice(0, 4).map((skill) => (
          <SkillConfidenceMeter
            key={skill.name}
            confidence={skill.confidence}
            showLabel={false}
            size="sm"
            skill={skill.name}
            verified={skill.verified}
          />
        ))}
      </div>

      <Link
        className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
        href="/assessments"
      >
        <Zap className="h-4 w-4" />
        Verify more skills
      </Link>
    </div>
  );
}

// Upcoming Assessments Card
export function UpcomingAssessmentsCard({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <ClipboardCheck className="h-5 w-5 text-indigo-600" />
          Upcoming Assessments
        </h3>
        <Link className="text-sm text-indigo-600 hover:text-indigo-700" href="/assessments">
          View all
        </Link>
      </div>

      {mockUpcomingAssessments.length > 0 ? (
        <div className="space-y-3">
          {mockUpcomingAssessments.map((assessment) => (
            <Link
              key={assessment.id}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              href={`/assessments/${assessment.id}`}
            >
              <div className="rounded-lg bg-indigo-100 p-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{assessment.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>
                    {new Date(assessment.scheduledAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span>{assessment.duration} min</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <Calendar className="mx-auto mb-2 h-10 w-10 text-gray-300" />
          <p className="mb-3 text-sm text-gray-500">No upcoming assessments</p>
          <Link
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            href="/assessments"
          >
            Browse assessments
          </Link>
        </div>
      )}
    </div>
  );
}

// Quick Stats Card
export function QuickStatsCard({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-5 text-white',
        className
      )}
    >
      <h3 className="mb-4 font-semibold">Your Progress</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-white/10 p-3">
          <Award className="mb-1 h-5 w-5 opacity-80" />
          <p className="text-2xl font-bold">{mockCredentials.length}</p>
          <p className="text-xs opacity-80">Credentials</p>
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <CheckCircle2 className="mb-1 h-5 w-5 opacity-80" />
          <p className="text-2xl font-bold">{mockTopSkills.filter((s) => s.verified).length}</p>
          <p className="text-xs opacity-80">Verified Skills</p>
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <ClipboardCheck className="mb-1 h-5 w-5 opacity-80" />
          <p className="text-2xl font-bold">12</p>
          <p className="text-xs opacity-80">Assessments</p>
        </div>
        <div className="rounded-lg bg-white/10 p-3">
          <TrendingUp className="mb-1 h-5 w-5 opacity-80" />
          <p className="text-2xl font-bold">85%</p>
          <p className="text-xs opacity-80">Avg Score</p>
        </div>
      </div>
    </div>
  );
}

// Profile Sidebar (combines all cards)
export function ProfileSidebar({ className }: Readonly<{ className?: string }>) {
  return (
    <aside className={cn('space-y-6', className)}>
      <QuickStatsCard />
      <ProfileCredentialsCard />
      <ProfileSkillsCard />
      <UpcomingAssessmentsCard />
    </aside>
  );
}

export default ProfileSidebar;
