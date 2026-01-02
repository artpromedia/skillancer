'use client';

import type { ReactNode } from 'react';

// COO Suite Layout
// Default widget arrangement for COO dashboard

interface COOLayoutProps {
  children: ReactNode;
}

export default function COOLayout({ children }: COOLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Suite Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">COO Command Center</h1>
            <p className="text-muted-foreground text-sm">
              Operational health, team effectiveness & OKR progress
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select className="rounded-md border px-3 py-1.5 text-sm">
              <option>Q1 2026</option>
              <option>Q4 2025</option>
              <option>Q3 2025</option>
            </select>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}

// Default widget configuration for COO suite
export const cooDefaultWidgets = {
  layout: [
    // Row 1: Key Metrics (3 equal columns)
    {
      row: 1,
      columns: [
        { widget: 'okr-progress', span: 4 },
        { widget: 'team-capacity', span: 4 },
        { widget: 'active-projects', span: 4 },
      ],
    },
    // Row 2: Priorities & Blockers (2 equal columns)
    {
      row: 2,
      columns: [
        { widget: 'priorities', span: 6 },
        { widget: 'blocked-items', span: 6 },
      ],
    },
    // Row 3: Detailed OKRs (full width)
    {
      row: 3,
      columns: [{ widget: 'quarterly-okrs', span: 12 }],
    },
    // Row 4: Actions & Meetings (2 equal columns)
    {
      row: 4,
      columns: [
        { widget: 'action-items', span: 6 },
        { widget: 'upcoming-meetings', span: 6 },
      ],
    },
  ],
  widgets: {
    'okr-progress': {
      type: 'okr-progress',
      title: 'OKR Progress',
      dataSources: ['internal'],
      refreshInterval: 300,
    },
    'team-capacity': {
      type: 'team-capacity',
      title: 'Team Capacity',
      dataSources: ['internal', 'asana', 'linear'],
      refreshInterval: 300,
    },
    'active-projects': {
      type: 'active-projects',
      title: 'Active Projects',
      dataSources: ['asana', 'monday', 'linear', 'jira'],
      refreshInterval: 300,
    },
    priorities: {
      type: 'priorities',
      title: "This Week's Priorities",
      dataSources: ['internal'],
      refreshInterval: 60,
    },
    'blocked-items': {
      type: 'blocked-items',
      title: 'Blocked Items',
      dataSources: ['asana', 'monday', 'linear', 'jira', 'internal'],
      refreshInterval: 60,
    },
    'quarterly-okrs': {
      type: 'quarterly-okrs',
      title: 'Quarterly OKRs',
      dataSources: ['internal'],
      refreshInterval: 300,
    },
    'action-items': {
      type: 'action-items',
      title: 'Action Items',
      dataSources: ['internal'],
      refreshInterval: 60,
    },
    'upcoming-meetings': {
      type: 'upcoming-meetings',
      title: 'Upcoming Meetings',
      dataSources: ['google-calendar', 'internal'],
      refreshInterval: 300,
    },
  },
};
