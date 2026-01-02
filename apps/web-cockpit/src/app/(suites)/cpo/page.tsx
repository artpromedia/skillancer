'use client';

import { DAUWAUMAUWidget } from '../../../components/cpo/dau-wau-mau-widget';
import { FeatureAdoptionWidget } from '../../../components/cpo/feature-adoption-widget';
import { ExperimentsWidget } from '../../../components/cpo/experiments-widget';
import { FeatureRoadmapWidget } from '../../../components/cpo/feature-roadmap-widget';
import { UserFeedbackWidget } from '../../../components/cpo/user-feedback-widget';
import { PrioritizationWidget } from '../../../components/cpo/prioritization-widget';
import { ResearchInsightsWidget } from '../../../components/cpo/research-insights-widget';
import { RecentPRDsWidget } from '../../../components/cpo/recent-prds-widget';

// CPO Dashboard Page
// Displays all CPO-specific widgets in a responsive grid layout

export default function CPODashboardPage() {
  // In a real implementation, these would come from engagement context
  const engagementId = 'demo-engagement';

  return (
    <div className="space-y-6">
      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DAUWAUMAUWidget engagementId={engagementId} />
        <FeatureAdoptionWidget engagementId={engagementId} />
        <ExperimentsWidget engagementId={engagementId} />
      </div>

      {/* Row 2: Roadmap & Feedback */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FeatureRoadmapWidget engagementId={engagementId} />
        <UserFeedbackWidget engagementId={engagementId} />
      </div>

      {/* Row 3: Prioritization (Full Width) */}
      <div className="grid grid-cols-1 gap-6">
        <PrioritizationWidget engagementId={engagementId} />
      </div>

      {/* Row 4: Research & PRDs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResearchInsightsWidget engagementId={engagementId} />
        <RecentPRDsWidget engagementId={engagementId} />
      </div>
    </div>
  );
}
