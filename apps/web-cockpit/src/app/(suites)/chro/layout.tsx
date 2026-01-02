'use client';

import type { ReactNode } from 'react';

// CHRO Suite Layout
// Default widget arrangement for CHRO dashboard

interface CHROLayoutProps {
  children: ReactNode;
}

export default function CHROLayout({ children }: CHROLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Suite Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CHRO Command Center</h1>
            <p className="text-muted-foreground text-sm">
              Workforce health, recruiting, engagement & HR compliance
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

// Default widget configuration for CHRO suite
export const chroDefaultWidgets = {
  layout: [
    // Row 1: Key Metrics (3 equal columns)
    {
      row: 1,
      columns: [
        { widget: 'headcount', span: 4 },
        { widget: 'enps', span: 4 },
        { widget: 'open-roles', span: 4 },
      ],
    },
    // Row 2: Recruiting (2 equal columns)
    {
      row: 2,
      columns: [
        { widget: 'recruiting-pipeline', span: 6 },
        { widget: 'upcoming-actions', span: 6 },
      ],
    },
    // Row 3: Workforce Composition (full width)
    {
      row: 3,
      columns: [{ widget: 'workforce-composition', span: 12 }],
    },
    // Row 4: Planning & Compliance (2 equal columns)
    {
      row: 4,
      columns: [
        { widget: 'headcount-plan', span: 6 },
        { widget: 'compliance-status', span: 6 },
      ],
    },
  ],
  widgets: {
    headcount: {
      title: 'Headcount Overview',
      description: 'Total headcount, by department, by location, trend over time',
      dataSources: ['bamboohr', 'gusto', 'rippling'],
      refreshInterval: 3600000, // 1 hour
    },
    enps: {
      title: 'Employee NPS',
      description: 'eNPS score, trend, promoters/passives/detractors breakdown',
      dataSources: ['culture-amp', 'lattice'],
      refreshInterval: 86400000, // 24 hours
    },
    'open-roles': {
      title: 'Open Roles',
      description: 'Open positions, urgent roles, average days open',
      dataSources: ['greenhouse', 'lever'],
      refreshInterval: 1800000, // 30 minutes
    },
    'recruiting-pipeline': {
      title: 'Recruiting Pipeline',
      description: 'Candidates by stage, conversion rates, funnel visualization',
      dataSources: ['greenhouse', 'lever'],
      refreshInterval: 1800000, // 30 minutes
    },
    'upcoming-actions': {
      title: 'Upcoming HR Actions',
      description: 'Reviews, benefits renewal, compliance training, deadlines',
      dataSources: ['internal'],
      refreshInterval: 3600000, // 1 hour
    },
    'workforce-composition': {
      title: 'Workforce Composition',
      description: 'Department breakdown, location distribution, level distribution',
      dataSources: ['bamboohr', 'gusto', 'rippling'],
      refreshInterval: 86400000, // 24 hours
    },
    'headcount-plan': {
      title: 'Headcount Plan',
      description: 'Planned vs actual headcount, quarterly targets, variance',
      dataSources: ['internal'],
      refreshInterval: 86400000, // 24 hours
    },
    'compliance-status': {
      title: 'HR Compliance Status',
      description: 'Compliance score, overdue items, upcoming deadlines',
      dataSources: ['internal'],
      refreshInterval: 3600000, // 1 hour
    },
  },
};
