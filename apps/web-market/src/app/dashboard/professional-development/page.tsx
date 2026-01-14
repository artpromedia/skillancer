/**
 * Teacher Professional Development Tracking Dashboard
 *
 * Features:
 * - PD hours tracking
 * - Certification management
 * - Activity logging
 * - Goal setting
 */

'use client';

import {
  GraduationCap,
  Clock,
  Award,
  Target,
  Calendar,
  BookOpen,
  Users,
  Video,
  FileText,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface PDProgress {
  completedHours: number;
  requiredHours: number;
  activitiesCount: number;
  yearStart: string;
  yearEnd: string;
}

interface PDActivity {
  id: string;
  title: string;
  category: string;
  activityType: string;
  hours: number;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'VERIFIED';
  provider?: string;
}

interface Certification {
  id: string;
  name: string;
  type: string;
  expirationDate?: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  renewalPDHours?: number;
}

interface PDGoal {
  id: string;
  title: string;
  category: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED';
}

interface CategoryBreakdown {
  category: string;
  hours: number;
  count: number;
  color: string;
}

// =============================================================================
// Mock Data
// =============================================================================

const mockProgress: PDProgress = {
  completedHours: 22.5,
  requiredHours: 30,
  activitiesCount: 8,
  yearStart: '2025-07-01',
  yearEnd: '2026-06-30',
};

const mockActivities: PDActivity[] = [
  {
    id: '1',
    title: 'Differentiated Instruction Workshop',
    category: 'INSTRUCTIONAL_STRATEGIES',
    activityType: 'WORKSHOP',
    hours: 6,
    date: '2025-12-15',
    status: 'VERIFIED',
    provider: 'District PD Center',
  },
  {
    id: '2',
    title: 'Technology Integration Webinar',
    category: 'TECHNOLOGY',
    activityType: 'WEBINAR',
    hours: 2,
    date: '2025-12-10',
    status: 'COMPLETED',
    provider: 'EdTech Alliance',
  },
  {
    id: '3',
    title: 'SEL Strategies Book Study',
    category: 'SOCIAL_EMOTIONAL_LEARNING',
    activityType: 'BOOK_STUDY',
    hours: 4,
    date: '2025-11-20',
    status: 'VERIFIED',
  },
  {
    id: '4',
    title: 'Data-Driven Instruction Course',
    category: 'DATA_LITERACY',
    activityType: 'COURSE',
    hours: 8,
    date: '2025-10-01',
    status: 'VERIFIED',
    provider: 'University of Education',
  },
  {
    id: '5',
    title: 'Classroom Management PLC',
    category: 'CLASSROOM_MANAGEMENT',
    activityType: 'PROFESSIONAL_LEARNING_COMMUNITY',
    hours: 2.5,
    date: '2025-09-15',
    status: 'COMPLETED',
  },
];

const mockCertifications: Certification[] = [
  {
    id: '1',
    name: 'Professional Teaching License',
    type: 'TEACHING_LICENSE',
    expirationDate: '2027-06-30',
    status: 'ACTIVE',
    renewalPDHours: 30,
  },
  {
    id: '2',
    name: 'ESL Endorsement',
    type: 'ESL_ELL',
    expirationDate: '2026-03-15',
    status: 'EXPIRING_SOON',
    renewalPDHours: 15,
  },
  {
    id: '3',
    name: 'Reading Specialist',
    type: 'READING_SPECIALIST',
    status: 'ACTIVE',
  },
];

const mockGoals: PDGoal[] = [
  {
    id: '1',
    title: 'Complete technology certification',
    category: 'TECHNOLOGY',
    progress: 60,
    status: 'IN_PROGRESS',
  },
  {
    id: '2',
    title: 'Attend 2 SEL workshops',
    category: 'SOCIAL_EMOTIONAL_LEARNING',
    progress: 50,
    status: 'IN_PROGRESS',
  },
  {
    id: '3',
    title: 'Complete data literacy course',
    category: 'DATA_LITERACY',
    progress: 100,
    status: 'ACHIEVED',
  },
];

const categoryBreakdown: CategoryBreakdown[] = [
  { category: 'Instructional Strategies', hours: 6, count: 1, color: '#3B82F6' },
  { category: 'Technology', hours: 2, count: 1, color: '#8B5CF6' },
  { category: 'SEL', hours: 4, count: 1, color: '#EC4899' },
  { category: 'Data Literacy', hours: 8, count: 1, color: '#10B981' },
  { category: 'Classroom Management', hours: 2.5, count: 1, color: '#F59E0B' },
];

// =============================================================================
// Components
// =============================================================================

function ProgressOverview({ progress }: { progress: PDProgress }) {
  const progressPercent = Math.round((progress.completedHours / progress.requiredHours) * 100);
  const hoursRemaining = progress.requiredHours - progress.completedHours;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            PD Hours Progress
          </h2>
          <p className="text-sm text-gray-500">
            {new Date(progress.yearStart).toLocaleDateString()} -{' '}
            {new Date(progress.yearEnd).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {progress.completedHours}
          </span>
          <span className="text-gray-500"> / {progress.requiredHours} hours</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${
              progressPercent >= 100
                ? 'bg-green-500'
                : progressPercent >= 75
                  ? 'bg-blue-500'
                  : progressPercent >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">{progressPercent}% complete</span>
          <span className="text-gray-500">
            {hoursRemaining > 0 ? `${hoursRemaining} hours remaining` : 'Goal met!'}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900/50">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {progress.activitiesCount}
          </p>
          <p className="text-xs text-gray-500">Activities</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900/50">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockCertifications.length}
          </p>
          <p className="text-xs text-gray-500">Certifications</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900/50">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {mockGoals.filter((g) => g.status === 'ACHIEVED').length}/{mockGoals.length}
          </p>
          <p className="text-xs text-gray-500">Goals Met</p>
        </div>
      </div>
    </div>
  );
}

function CategoryChart({ breakdown }: { breakdown: CategoryBreakdown[] }) {
  const totalHours = breakdown.reduce((sum, c) => sum + c.hours, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="font-semibold text-gray-900 dark:text-white">Hours by Category</h3>

      <div className="mt-4 space-y-3">
        {breakdown.map((cat) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{cat.category}</span>
              <span className="font-medium text-gray-900 dark:text-white">{cat.hours}h</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(cat.hours / totalHours) * 100}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationCard({ certification }: { certification: Certification }) {
  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    EXPIRING_SOON: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{certification.name}</h4>
            <p className="text-xs text-gray-500">{certification.type.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${statusColors[certification.status]}`}>
          {certification.status.replace(/_/g, ' ')}
        </span>
      </div>

      {certification.expirationDate && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            Expires: {new Date(certification.expirationDate).toLocaleDateString()}
          </span>
          {certification.renewalPDHours && (
            <span className="text-gray-500">({certification.renewalPDHours}h for renewal)</span>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: PDActivity }) {
  const typeIcons: Record<string, React.ReactNode> = {
    WORKSHOP: <Users className="h-4 w-4" />,
    WEBINAR: <Video className="h-4 w-4" />,
    COURSE: <BookOpen className="h-4 w-4" />,
    BOOK_STUDY: <FileText className="h-4 w-4" />,
    PROFESSIONAL_LEARNING_COMMUNITY: <Users className="h-4 w-4" />,
  };

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    VERIFIED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {typeIcons[activity.activityType] ?? <BookOpen className="h-4 w-4" />}
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{activity.title}</h4>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{activity.category.replace(/_/g, ' ')}</span>
            <span>•</span>
            <span>{new Date(activity.date).toLocaleDateString()}</span>
            {activity.provider && (
              <>
                <span>•</span>
                <span>{activity.provider}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium text-gray-900 dark:text-white">{activity.hours}h</span>
        <span className={`rounded-full px-2 py-1 text-xs ${statusColors[activity.status]}`}>
          {activity.status}
        </span>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: PDGoal }) {
  const statusIcons = {
    NOT_STARTED: <Clock className="h-4 w-4 text-gray-400" />,
    IN_PROGRESS: <TrendingUp className="h-4 w-4 text-blue-500" />,
    ACHIEVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {statusIcons[goal.status]}
          <h4 className="font-medium text-gray-900 dark:text-white">{goal.title}</h4>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${
              goal.status === 'ACHIEVED' ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">{goal.progress}% complete</p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function ProfessionalDevelopmentPage() {
  const [showLogModal, setShowLogModal] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Professional Development
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track your PD hours, certifications, and growth goals
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowLogModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-5 w-5" />
          Log Activity
        </button>
      </div>

      {/* Alert for expiring certification */}
      {mockCertifications.some((c) => c.status === 'EXPIRING_SOON') && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Certification expiring soon
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Your ESL Endorsement expires on March 15, 2026. Complete 15 PD hours to renew.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          <ProgressOverview progress={mockProgress} />

          {/* Activities */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activities
              </h2>
              <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
            <div className="space-y-3">
              {mockActivities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <CategoryChart breakdown={categoryBreakdown} />

          {/* Certifications */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Certifications</h3>
              <button className="text-sm text-blue-600 hover:underline">Add</button>
            </div>
            <div className="mt-4 space-y-3">
              {mockCertifications.map((cert) => (
                <CertificationCard key={cert.id} certification={cert} />
              ))}
            </div>
          </div>

          {/* Goals */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Goals</h3>
              <button className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {mockGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
