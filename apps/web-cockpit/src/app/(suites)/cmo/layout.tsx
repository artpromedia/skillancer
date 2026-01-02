'use client';

import type { ReactNode } from 'react';

// CMO Suite Layout
// Default widget arrangement for CMO dashboard

interface CMOLayoutProps {
  children: ReactNode;
}

export default function CMOLayout({ children }: CMOLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Suite Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CMO Command Center</h1>
            <p className="text-muted-foreground text-sm">
              Marketing performance, attribution & pipeline impact
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

// Default widget configuration for CMO suite
export const cmoDefaultWidgets = {
  layout: [
    // Row 1: Key Metrics (3 equal columns)
    {
      row: 1,
      columns: [
        { widget: 'mql', span: 4 },
        { widget: 'cac', span: 4 },
        { widget: 'pipeline', span: 4 },
      ],
    },
    // Row 2: Channel Performance (full width)
    {
      row: 2,
      columns: [{ widget: 'channel-performance', span: 12 }],
    },
    // Row 3: Campaigns & Content (2 equal columns)
    {
      row: 3,
      columns: [
        { widget: 'active-campaigns', span: 6 },
        { widget: 'content-calendar', span: 6 },
      ],
    },
    // Row 4: Attribution (full width)
    {
      row: 4,
      columns: [{ widget: 'attribution', span: 12 }],
    },
  ],
  widgets: {
    mql: {
      type: 'mql',
      title: 'Marketing Qualified Leads',
      dataSources: ['hubspot', 'salesforce'],
      refreshInterval: 300,
    },
    cac: {
      type: 'cac',
      title: 'Customer Acquisition Cost',
      dataSources: ['meta-ads', 'google-ads', 'linkedin-ads', 'salesforce'],
      refreshInterval: 300,
    },
    pipeline: {
      type: 'pipeline',
      title: 'Marketing Pipeline',
      dataSources: ['salesforce', 'hubspot'],
      refreshInterval: 300,
    },
    'channel-performance': {
      type: 'channel-performance',
      title: 'Channel Performance',
      dataSources: ['google-analytics', 'meta-ads', 'google-ads', 'linkedin-ads'],
      refreshInterval: 300,
    },
    'active-campaigns': {
      type: 'active-campaigns',
      title: 'Active Campaigns',
      dataSources: ['meta-ads', 'google-ads', 'hubspot'],
      refreshInterval: 300,
    },
    'content-calendar': {
      type: 'content-calendar',
      title: 'Content Calendar',
      dataSources: ['internal'],
      refreshInterval: 60,
    },
    attribution: {
      type: 'attribution',
      title: 'Multi-touch Attribution',
      dataSources: ['google-analytics', 'salesforce'],
      refreshInterval: 600,
    },
  },
};
