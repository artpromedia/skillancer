import { DashboardLayout } from '@/components/layout/dashboard-layout';

import type { Metadata } from 'next';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'SkillPod - Skillancer',
  description: 'Skill Development and Verification Platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}
