'use client';

import type { ReactNode } from 'react';

// CPO Suite Layout
// Default widget arrangement for CPO (Chief Product Officer) dashboard

interface CPOLayoutProps {
  readonly children: ReactNode;
}

export default function CPOLayout({ children }: Readonly<CPOLayoutProps>) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Suite Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CPO Command Center</h1>
            <p className="text-muted-foreground text-sm">
              Product health, user engagement & feature prioritization
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Time Range Selector */}
            <select className="rounded-md border px-3 py-1.5 text-sm">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
            </select>
            {/* Quarter Selector */}
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
