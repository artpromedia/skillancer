'use client';

import type { ReactNode } from 'react';

// CISO Suite Layout
// Default widget arrangement for CISO dashboard

interface CISOLayoutProps {
  children: ReactNode;
}

export default function CISOLayout({ children }: CISOLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Suite Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CISO Command Center</h1>
            <p className="text-muted-foreground text-sm">
              Security posture, compliance status & threat visibility
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select className="rounded-md border px-3 py-1.5 text-sm">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>This Month</option>
              <option>Last Quarter</option>
            </select>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}

// Default widget configuration for CISO suite
export const cisoDefaultWidgets = {
  layout: [
    // Row 1: Key Metrics (3 equal columns)
    {
      row: 1,
      columns: [
        { widget: 'security-score', span: 4 },
        { widget: 'vulnerabilities', span: 4 },
        { widget: 'compliance-status', span: 4 },
      ],
    },
    // Row 2: Threats & Incidents (2 equal columns)
    {
      row: 2,
      columns: [
        { widget: 'active-incidents', span: 6 },
        { widget: 'recent-alerts', span: 6 },
      ],
    },
    // Row 3: Compliance Roadmap (full width)
    {
      row: 3,
      columns: [{ widget: 'compliance-roadmap', span: 12 }],
    },
    // Row 4: Risk (2 equal columns)
    {
      row: 4,
      columns: [
        { widget: 'risk-matrix', span: 6 },
        { widget: 'top-risks', span: 6 },
      ],
    },
  ],
  widgets: {
    'security-score': {
      type: 'security-score',
      title: 'Security Score',
      dataSources: ['qualys', 'tenable', 'crowdstrike', 'aws-security'],
      refreshInterval: 300,
    },
    vulnerabilities: {
      type: 'vulnerability-summary',
      title: 'Vulnerabilities',
      dataSources: ['qualys', 'tenable'],
      refreshInterval: 300,
    },
    'compliance-status': {
      type: 'compliance-status',
      title: 'Compliance Status',
      dataSources: ['internal'],
      refreshInterval: 600,
    },
    'active-incidents': {
      type: 'active-incidents',
      title: 'Active Incidents',
      dataSources: ['internal'],
      refreshInterval: 60,
    },
    'recent-alerts': {
      type: 'recent-alerts',
      title: 'Recent Alerts',
      dataSources: ['splunk', 'datadog-security', 'crowdstrike'],
      refreshInterval: 60,
    },
    'compliance-roadmap': {
      type: 'compliance-roadmap',
      title: 'Compliance Roadmap',
      dataSources: ['internal'],
      refreshInterval: 600,
    },
    'risk-matrix': {
      type: 'risk-matrix',
      title: 'Risk Matrix',
      dataSources: ['internal'],
      refreshInterval: 300,
    },
    'top-risks': {
      type: 'top-risks',
      title: 'Top Risks',
      dataSources: ['internal'],
      refreshInterval: 300,
    },
  },
};
