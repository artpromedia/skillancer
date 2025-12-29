'use client';

import Link from 'next/link';

const reportTypes = [
  {
    id: 'user-growth',
    name: 'User Growth',
    description: 'Signups, retention, churn analysis',
    icon: '👥',
    category: 'users',
  },
  {
    id: 'revenue-gmv',
    name: 'Revenue & GMV',
    description: 'Revenue, transactions, fees analysis',
    icon: '💰',
    category: 'financial',
  },
  {
    id: 'marketplace-health',
    name: 'Marketplace Health',
    description: 'Job fill rates, match quality, time-to-hire',
    icon: '📊',
    category: 'marketplace',
  },
  {
    id: 'trust-safety',
    name: 'Trust & Safety',
    description: 'Disputes, fraud, moderation metrics',
    icon: '🛡️',
    category: 'safety',
  },
  {
    id: 'skillpod-usage',
    name: 'SkillPod Usage',
    description: 'Session analytics, resource utilization',
    icon: '🖥️',
    category: 'skillpod',
  },
  {
    id: 'verification',
    name: 'Verification Metrics',
    description: 'Skill verification completion rates',
    icon: '✅',
    category: 'users',
  },
];

const scheduledReports = [
  {
    name: 'Weekly Executive Summary',
    schedule: 'Every Monday 8am',
    lastRun: '2024-01-15',
    recipients: 3,
  },
  { name: 'Daily Revenue Report', schedule: 'Daily 6am', lastRun: '2024-01-15', recipients: 5 },
  { name: 'Monthly User Growth', schedule: '1st of month', lastRun: '2024-01-01', recipients: 8 },
];

const recentDownloads = [
  { name: 'Q4 2023 Revenue Analysis.xlsx', date: '2024-01-14', size: '2.4 MB' },
  { name: 'User Cohort Analysis.csv', date: '2024-01-12', size: '850 KB' },
  { name: 'Trust & Safety Monthly.pdf', date: '2024-01-10', size: '1.2 MB' },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate insights and export platform data</p>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            href="/reports/realtime"
          >
            Real-time Metrics
          </Link>
          <Link
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            href="/reports/builder"
          >
            Custom Report Builder
          </Link>
        </div>
      </div>

      {/* Report Types */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Standard Reports</h2>
        <div className="grid grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <Link
              key={report.id}
              className="rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
              href={`/reports/${report.id}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{report.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-900">{report.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{report.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Scheduled Reports */}
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Scheduled Reports</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              + New Schedule
            </button>
          </div>
          <div className="space-y-3">
            {scheduledReports.map((report, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div>
                  <p className="font-medium text-gray-900">{report.name}</p>
                  <p className="text-sm text-gray-500">{report.schedule}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{report.recipients} recipients</p>
                  <p className="text-xs text-gray-500">Last: {report.lastRun}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Download Center */}
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Download Center</h2>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentDownloads.map((file, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {file.date} • {file.size}
                    </p>
                  </div>
                </div>
                <button className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium text-gray-900">Quick Stats (Last 30 Days)</h2>
        <div className="grid grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">12,453</div>
            <div className="text-sm text-gray-500">New Users</div>
            <div className="text-xs text-green-600">+15.2%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">$2.4M</div>
            <div className="text-sm text-gray-500">GMV</div>
            <div className="text-xs text-green-600">+8.7%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">3,210</div>
            <div className="text-sm text-gray-500">Jobs Posted</div>
            <div className="text-xs text-green-600">+12.1%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">89%</div>
            <div className="text-sm text-gray-500">Fill Rate</div>
            <div className="text-xs text-green-600">+2.3%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">4.8</div>
            <div className="text-sm text-gray-500">Avg Rating</div>
            <div className="text-xs text-gray-400">No change</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">2.1%</div>
            <div className="text-sm text-gray-500">Dispute Rate</div>
            <div className="text-xs text-green-600">-0.3%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
