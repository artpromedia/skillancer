/**
 * Dashboard Layout
 *
 * Forces dynamic rendering for all dashboard routes since they require
 * server-side authentication (cookies).
 */

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return children;
}
