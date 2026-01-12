'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';

import { DAUWAUMAUWidget } from '../../../components/cpo/dau-wau-mau-widget';
import { FeatureAdoptionWidget } from '../../../components/cpo/feature-adoption-widget';
import { ExperimentsWidget } from '../../../components/cpo/experiments-widget';
import { FeatureRoadmapWidget } from '../../../components/cpo/feature-roadmap-widget';
import { UserFeedbackWidget } from '../../../components/cpo/user-feedback-widget';
import { PrioritizationWidget } from '../../../components/cpo/prioritization-widget';
import { ResearchInsightsWidget } from '../../../components/cpo/research-insights-widget';
import { RecentPRDsWidget } from '../../../components/cpo/recent-prds-widget';
import { cpoApi } from '../../../lib/api/cpo';

// CPO Dashboard Page
// Displays all CPO-specific widgets in a responsive grid layout

export default function CPODashboardPage() {
  // In a real implementation, this would come from engagement context
  const engagementId = 'demo-engagement';

  // Fetch all dashboard data
  const {
    data: dashboardData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cpo-dashboard', engagementId],
    queryFn: () => cpoApi.getDashboardData(engagementId),
    // Retry configuration for better UX
    retry: 2,
    retryDelay: 1000,
    // Stale time of 1 minute since dashboard data updates frequently
    staleTime: 60 * 1000,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Failed to load dashboard</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DAUWAUMAUWidget engagementId={engagementId} data={dashboardData?.userMetrics} />
        <FeatureAdoptionWidget engagementId={engagementId} data={dashboardData?.featureAdoption} />
        <ExperimentsWidget engagementId={engagementId} data={dashboardData?.experiments} />
      </div>

      {/* Row 2: Roadmap & Feedback */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FeatureRoadmapWidget engagementId={engagementId} data={dashboardData?.roadmap} />
        <UserFeedbackWidget engagementId={engagementId} data={dashboardData?.feedback} />
      </div>

      {/* Row 3: Prioritization (Full Width) */}
      <div className="grid grid-cols-1 gap-6">
        <PrioritizationWidget engagementId={engagementId} data={dashboardData?.prioritization} />
      </div>

      {/* Row 4: Research & PRDs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResearchInsightsWidget engagementId={engagementId} data={dashboardData?.research} />
        <RecentPRDsWidget engagementId={engagementId} data={dashboardData?.prds} />
      </div>
    </div>
  );
}
