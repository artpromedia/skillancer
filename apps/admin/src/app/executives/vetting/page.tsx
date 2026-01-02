'use client';

import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Search,
  ChevronRight,
  Calendar,
  FileText,
  UserCheck,
  Shield,
} from 'lucide-react';
import { useState } from 'react';

// Types
type VettingStage =
  | 'APPLICATION'
  | 'AUTOMATED_SCREENING'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'REFERENCE_CHECK'
  | 'BACKGROUND_CHECK'
  | 'FINAL_REVIEW';

type VettingStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

interface ExecutiveInVetting {
  id: string;
  name: string;
  email: string;
  executiveType: string;
  headline: string;
  stage: VettingStage;
  status: VettingStatus;
  score: number | null;
  daysInStage: number;
  appliedAt: string;
  linkedinVerified: boolean;
  referencesCompleted: number;
  referencesRequired: number;
}

// Mock data
const mockExecutives: ExecutiveInVetting[] = [
  {
    id: 'exec_1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    executiveType: 'FRACTIONAL_CTO',
    headline: 'Former CTO at Series B Startup | 15 Years Tech Leadership',
    stage: 'INTERVIEW_SCHEDULED',
    status: 'IN_REVIEW',
    score: 78,
    daysInStage: 2,
    appliedAt: '2024-01-25',
    linkedinVerified: true,
    referencesCompleted: 0,
    referencesRequired: 3,
  },
  {
    id: 'exec_2',
    name: 'Michael Torres',
    email: 'michael@example.com',
    executiveType: 'FRACTIONAL_CFO',
    headline: 'Ex-Goldman Sachs | CFO for 3 Startups',
    stage: 'REFERENCE_CHECK',
    status: 'IN_REVIEW',
    score: 85,
    daysInStage: 5,
    appliedAt: '2024-01-18',
    linkedinVerified: true,
    referencesCompleted: 2,
    referencesRequired: 3,
  },
  {
    id: 'exec_3',
    name: 'Jennifer Wu',
    email: 'jennifer@example.com',
    executiveType: 'FRACTIONAL_CMO',
    headline: 'Growth Marketing Executive | B2B SaaS Specialist',
    stage: 'AUTOMATED_SCREENING',
    status: 'IN_REVIEW',
    score: 62,
    daysInStage: 1,
    appliedAt: '2024-01-28',
    linkedinVerified: false,
    referencesCompleted: 0,
    referencesRequired: 3,
  },
  {
    id: 'exec_4',
    name: 'David Kim',
    email: 'david@example.com',
    executiveType: 'FRACTIONAL_COO',
    headline: 'Operations Leader | Scaled 3 Companies to IPO',
    stage: 'BACKGROUND_CHECK',
    status: 'IN_REVIEW',
    score: 91,
    daysInStage: 3,
    appliedAt: '2024-01-10',
    linkedinVerified: true,
    referencesCompleted: 3,
    referencesRequired: 3,
  },
  {
    id: 'exec_5',
    name: 'Amanda Johnson',
    email: 'amanda@example.com',
    executiveType: 'FRACTIONAL_CHRO',
    headline: 'People & Culture Executive | Tech & Healthcare',
    stage: 'FINAL_REVIEW',
    status: 'IN_REVIEW',
    score: 88,
    daysInStage: 1,
    appliedAt: '2024-01-05',
    linkedinVerified: true,
    referencesCompleted: 3,
    referencesRequired: 3,
  },
];

const STAGE_CONFIG: Record<
  VettingStage,
  { label: string; color: string; icon: React.ElementType }
> = {
  APPLICATION: { label: 'Application', color: 'bg-gray-100 text-gray-700', icon: FileText },
  AUTOMATED_SCREENING: { label: 'Screening', color: 'bg-blue-100 text-blue-700', icon: Search },
  INTERVIEW_SCHEDULED: {
    label: 'Interview',
    color: 'bg-purple-100 text-purple-700',
    icon: Calendar,
  },
  INTERVIEW_COMPLETED: {
    label: 'Interview Done',
    color: 'bg-indigo-100 text-indigo-700',
    icon: CheckCircle,
  },
  REFERENCE_CHECK: { label: 'References', color: 'bg-yellow-100 text-yellow-700', icon: UserCheck },
  BACKGROUND_CHECK: { label: 'Background', color: 'bg-orange-100 text-orange-700', icon: Shield },
  FINAL_REVIEW: { label: 'Final Review', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

const EXECUTIVE_TYPE_LABELS: Record<string, string> = {
  FRACTIONAL_CTO: 'CTO',
  FRACTIONAL_CFO: 'CFO',
  FRACTIONAL_CMO: 'CMO',
  FRACTIONAL_COO: 'COO',
  FRACTIONAL_CHRO: 'CHRO',
  FRACTIONAL_CISO: 'CISO',
  FRACTIONAL_CPO: 'CPO',
  FRACTIONAL_CRO: 'CRO',
  BOARD_ADVISOR: 'Advisor',
  INTERIM_EXECUTIVE: 'Interim',
};

function StageBadge({ stage }: { stage: VettingStage }) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;

  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`font-semibold ${color}`}>{score}</span>;
}

export default function AdminVettingPage() {
  const [stageFilter, setStageFilter] = useState<VettingStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [executives] = useState<ExecutiveInVetting[]>(mockExecutives);

  const filteredExecutives = executives.filter((exec) => {
    const matchesStage = stageFilter === 'all' || exec.stage === stageFilter;
    const matchesSearch =
      exec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exec.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStage && matchesSearch;
  });

  // Count by stage
  const stageCounts = executives.reduce(
    (acc, exec) => {
      acc[exec.stage] = (acc[exec.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Executive Vetting Pipeline</h1>
              <p className="mt-1 text-sm text-gray-500">
                {executives.filter((e) => e.status === 'IN_REVIEW').length} executives in review
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Stage Overview Cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {Object.entries(STAGE_CONFIG).map(([stage, config]) => {
            const Icon = config.icon;
            const count = stageCounts[stage] || 0;
            return (
              <button
                key={stage}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  stageFilter === stage
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setStageFilter(stage as VettingStage)}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="text-lg font-bold text-gray-900">{count}</span>
                </div>
                <p className="text-xs text-gray-500">{config.label}</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500"
              placeholder="Search executives..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-4 py-2"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as VettingStage | 'all')}
          >
            <option value="all">All Stages</option>
            {Object.entries(STAGE_CONFIG).map(([stage, config]) => (
              <option key={stage} value={stage}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Executives Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Executive
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Days
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  References
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExecutives.map((exec) => (
                <tr key={exec.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 font-semibold text-white">
                        {exec.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{exec.name}</span>
                          {exec.linkedinVerified && (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <p className="max-w-xs truncate text-sm text-gray-500">{exec.headline}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700">
                      {EXECUTIVE_TYPE_LABELS[exec.executiveType] || exec.executiveType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StageBadge stage={exec.stage} />
                  </td>
                  <td className="px-6 py-4">
                    <ScoreBadge score={exec.score} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Clock
                        className={`h-4 w-4 ${exec.daysInStage > 5 ? 'text-red-500' : 'text-gray-400'}`}
                      />
                      <span
                        className={
                          exec.daysInStage > 5 ? 'font-medium text-red-600' : 'text-gray-600'
                        }
                      >
                        {exec.daysInStage}d
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600">
                      {exec.referencesCompleted}/{exec.referencesRequired}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      href={`/executives/vetting/${exec.id}`}
                    >
                      View <ChevronRight className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredExecutives.length === 0 && (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No executives match your filters</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
