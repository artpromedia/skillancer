'use client';

import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  Briefcase,
  MapPin,
  Linkedin,
  Mail,
  Phone,
  Shield,
  FileText,
  MessageSquare,
  Star,
  ChevronRight,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

// Types
interface ExecutiveDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  executiveType: string;
  headline: string;
  bio: string;
  yearsExecutiveExp: number;
  totalYearsExp: number;
  linkedinUrl: string;
  linkedinVerified: boolean;
  timezone: string;
  vettingStatus: string;
  vettingStage: string;
  vettingScore: number;
  appliedAt: string;
  industries: string[];
  specializations: string[];
  history: Array<{
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string | null;
    verified: boolean;
  }>;
  references: Array<{
    id: string;
    name: string;
    title: string;
    company: string;
    relationship: string;
    status: string;
    rating: number | null;
    wouldRecommend: boolean | null;
  }>;
  interviews: Array<{
    id: string;
    type: string;
    scheduledAt: string;
    status: string;
    score: number | null;
    recommendation: string | null;
  }>;
  backgroundCheck: {
    status: string;
    initiatedAt: string | null;
    completedAt: string | null;
    result: string | null;
  };
}

// Mock data
const mockExecutive: ExecutiveDetail = {
  id: 'exec_1',
  name: 'Sarah Chen',
  email: 'sarah.chen@example.com',
  phone: '+1 (555) 123-4567',
  executiveType: 'FRACTIONAL_CTO',
  headline: 'Former CTO at Series B Startup | 15 Years Tech Leadership',
  bio: 'Technology executive with 15+ years of experience building and scaling engineering teams. Led technical strategy for 3 successful exits. Passionate about helping startups navigate technical challenges and build world-class engineering cultures.',
  yearsExecutiveExp: 12,
  totalYearsExp: 18,
  linkedinUrl: 'https://linkedin.com/in/sarahchen',
  linkedinVerified: true,
  timezone: 'America/Los_Angeles',
  vettingStatus: 'IN_REVIEW',
  vettingStage: 'REFERENCE_CHECK',
  vettingScore: 82,
  appliedAt: '2024-01-15T10:30:00Z',
  industries: ['SaaS', 'FinTech', 'Healthcare'],
  specializations: [
    'Engineering Leadership',
    'Technical Strategy',
    'Platform Architecture',
    'Team Scaling',
  ],
  history: [
    {
      id: 'h1',
      title: 'Chief Technology Officer',
      company: 'TechScale Inc',
      startDate: '2020-03',
      endDate: '2024-01',
      verified: true,
    },
    {
      id: 'h2',
      title: 'VP of Engineering',
      company: 'DataFlow Systems',
      startDate: '2016-06',
      endDate: '2020-02',
      verified: true,
    },
    {
      id: 'h3',
      title: 'Engineering Director',
      company: 'CloudFirst',
      startDate: '2012-01',
      endDate: '2016-05',
      verified: false,
    },
  ],
  references: [
    {
      id: 'r1',
      name: 'John Smith',
      title: 'CEO',
      company: 'TechScale Inc',
      relationship: 'REPORTED_TO',
      status: 'COMPLETED',
      rating: 9,
      wouldRecommend: true,
    },
    {
      id: 'r2',
      name: 'Lisa Park',
      title: 'COO',
      company: 'TechScale Inc',
      relationship: 'PEER',
      status: 'COMPLETED',
      rating: 8,
      wouldRecommend: true,
    },
    {
      id: 'r3',
      name: 'Mike Johnson',
      title: 'VP Product',
      company: 'DataFlow Systems',
      relationship: 'PEER',
      status: 'PENDING',
      rating: null,
      wouldRecommend: null,
    },
  ],
  interviews: [
    {
      id: 'i1',
      type: 'SCREENING',
      scheduledAt: '2024-01-18T15:00:00Z',
      status: 'COMPLETED',
      score: 85,
      recommendation: 'YES',
    },
  ],
  backgroundCheck: {
    status: 'NOT_STARTED',
    initiatedAt: null,
    completedAt: null,
    result: null,
  },
};

const STAGE_ORDER = [
  'APPLICATION',
  'AUTOMATED_SCREENING',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'REFERENCE_CHECK',
  'BACKGROUND_CHECK',
  'FINAL_REVIEW',
  'COMPLETE',
];

function StageTimeline({ currentStage }: { currentStage: string }) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.slice(0, -1).map((stage, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={stage} className="flex items-center">
            <div
              className={`h-3 w-3 rounded-full ${
                isComplete ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
            {index < STAGE_ORDER.length - 2 && (
              <div className={`h-0.5 w-6 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExecutiveVettingDetailPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<
    'profile' | 'history' | 'interviews' | 'references' | 'background'
  >('profile');
  const executive = mockExecutive;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <a
            className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            href="/executives/vetting"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pipeline
          </a>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-2xl font-bold text-white">
                {executive.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{executive.name}</h1>
                  {executive.linkedinVerified && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      <Linkedin className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-gray-600">{executive.headline}</p>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {executive.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {executive.timezone}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">Vetting Score:</span>
                <span className="text-2xl font-bold text-green-600">{executive.vettingScore}</span>
              </div>
              <StageTimeline currentStage={executive.vettingStage} />
            </div>
          </div>

          {/* Tabs */}
          <div className="-mb-px mt-6 flex gap-1 border-b border-gray-200">
            {[
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'history', label: 'History', icon: Briefcase },
              { id: 'interviews', label: 'Interviews', icon: Calendar },
              { id: 'references', label: 'References', icon: MessageSquare },
              { id: 'background', label: 'Background', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {activeTab === 'profile' && (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">About</h3>
                  <p className="text-gray-600">{executive.bio}</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Experience</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Executive Experience</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {executive.yearsExecutiveExp} years
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Experience</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {executive.totalYearsExp} years
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Expertise</h3>
                  <div className="mb-4">
                    <p className="mb-2 text-sm text-gray-500">Industries</p>
                    <div className="flex flex-wrap gap-2">
                      {executive.industries.map((ind) => (
                        <span
                          key={ind}
                          className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-gray-500">Specializations</p>
                    <div className="flex flex-wrap gap-2">
                      {executive.specializations.map((spec) => (
                        <span
                          key={spec}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Executive History</h3>
                <div className="space-y-4">
                  {executive.history.map((pos) => (
                    <div
                      key={pos.id}
                      className="flex items-start justify-between rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{pos.title}</h4>
                          {pos.verified && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="text-gray-600">{pos.company}</p>
                        <p className="text-sm text-gray-500">
                          {pos.startDate} - {pos.endDate || 'Present'}
                        </p>
                      </div>
                      {!pos.verified && (
                        <button className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">
                          Verify
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'interviews' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Interviews</h3>
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                    Schedule Interview
                  </button>
                </div>
                {executive.interviews.length > 0 ? (
                  <div className="space-y-4">
                    {executive.interviews.map((interview) => (
                      <div key={interview.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {interview.type} Interview
                          </span>
                          <span
                            className={`rounded px-2 py-1 text-xs ${
                              interview.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {interview.status}
                          </span>
                        </div>
                        <p className="mb-2 text-sm text-gray-500">
                          {new Date(interview.scheduledAt).toLocaleString()}
                        </p>
                        {interview.score && (
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              Score: <strong>{interview.score}</strong>
                            </span>
                            <span>
                              Recommendation: <strong>{interview.recommendation}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-gray-500">No interviews scheduled yet</p>
                )}
              </div>
            )}

            {activeTab === 'references' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  References ({executive.references.filter((r) => r.status === 'COMPLETED').length}
                  /3 completed)
                </h3>
                <div className="space-y-4">
                  {executive.references.map((ref) => (
                    <div key={ref.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{ref.name}</h4>
                          <p className="text-gray-600">
                            {ref.title} at {ref.company}
                          </p>
                          <p className="text-sm text-gray-500">{ref.relationship}</p>
                        </div>
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            ref.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {ref.status}
                        </span>
                      </div>
                      {ref.status === 'COMPLETED' && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              Rating: {ref.rating}/10
                            </span>
                            <span className="flex items-center gap-1">
                              {ref.wouldRecommend ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              Would Recommend: {ref.wouldRecommend ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'background' && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Background Check</h3>
                {executive.backgroundCheck.status === 'NOT_STARTED' ? (
                  <div className="py-8 text-center">
                    <Shield className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                    <p className="mb-4 text-gray-500">Background check not yet initiated</p>
                    <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                      Initiate Background Check
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Status: {executive.backgroundCheck.status}
                      </span>
                      {executive.backgroundCheck.result && (
                        <span
                          className={`rounded px-3 py-1 ${
                            executive.backgroundCheck.result === 'CLEAR'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {executive.backgroundCheck.result}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Actions</h3>
              <div className="space-y-3">
                <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Advance Stage
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50">
                  <XCircle className="h-4 w-4" />
                  Reject Application
                </button>
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50">
                  <Mail className="h-4 w-4" />
                  Send Message
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Internal Notes</h3>
              <textarea
                className="h-32 w-full resize-none rounded-lg border border-gray-300 p-3"
                placeholder="Add notes about this executive..."
              />
              <button className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800">
                Save Note
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Timeline</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Screening Passed</p>
                    <p className="text-xs text-gray-500">Jan 17, 2024</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Application Received</p>
                    <p className="text-xs text-gray-500">Jan 15, 2024</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
