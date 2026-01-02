'use client';

/**
 * Feature Roadmap Widget for CPO Dashboard
 * Displays current quarter roadmap with feature status
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { Map, ChevronRight, CheckCircle2, Clock, AlertTriangle, Circle } from 'lucide-react';

interface RoadmapFeature {
  id: string;
  name: string;
  status: 'planned' | 'in_progress' | 'launched' | 'blocked';
  progress?: number;
  quarter?: string;
  theme?: string;
  owner?: string;
}

interface FeatureRoadmapWidgetProps {
  engagementId: string;
  data?: {
    features: RoadmapFeature[];
    summary: {
      total: number;
      planned: number;
      inProgress: number;
      launched: number;
      blocked: number;
    };
    currentQuarter: string;
    themes?: Array<{ name: string; featureCount: number }>;
  };
  className?: string;
}

// Demo data
const demoData = {
  features: [
    { id: '1', name: 'AI-Powered Search', status: 'launched' as const, progress: 100, theme: 'AI' },
    {
      id: '2',
      name: 'Team Collaboration',
      status: 'in_progress' as const,
      progress: 65,
      theme: 'Collaboration',
    },
    {
      id: '3',
      name: 'Mobile App V2',
      status: 'in_progress' as const,
      progress: 40,
      theme: 'Mobile',
    },
    {
      id: '4',
      name: 'Advanced Analytics',
      status: 'blocked' as const,
      progress: 20,
      theme: 'Analytics',
    },
    {
      id: '5',
      name: 'API Rate Limiting',
      status: 'planned' as const,
      progress: 0,
      theme: 'Platform',
    },
    {
      id: '6',
      name: 'SSO Integration',
      status: 'planned' as const,
      progress: 0,
      theme: 'Security',
    },
  ],
  summary: {
    total: 6,
    planned: 2,
    inProgress: 2,
    launched: 1,
    blocked: 1,
  },
  currentQuarter: 'Q1 2026',
  themes: [
    { name: 'AI', featureCount: 1 },
    { name: 'Collaboration', featureCount: 1 },
    { name: 'Mobile', featureCount: 1 },
    { name: 'Platform', featureCount: 2 },
  ],
};

const statusConfig = {
  planned: {
    icon: Circle,
    color: 'text-gray-400',
    bg: 'bg-gray-100',
    label: 'Planned',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-100',
    label: 'In Progress',
  },
  launched: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-100',
    label: 'Launched',
  },
  blocked: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-100',
    label: 'Blocked',
  },
};

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-gray-300'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function FeatureRoadmapWidget({
  engagementId,
  data = demoData,
  className,
}: FeatureRoadmapWidgetProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Map className="h-4 w-4" />
          Feature Roadmap
        </CardTitle>
        <div className="text-muted-foreground text-xs">{data.currentQuarter}</div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Planned', value: data.summary.planned, color: 'text-gray-600' },
            { label: 'In Progress', value: data.summary.inProgress, color: 'text-blue-600' },
            { label: 'Launched', value: data.summary.launched, color: 'text-green-600' },
            { label: 'Blocked', value: data.summary.blocked, color: 'text-red-600' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-muted-foreground text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Feature List */}
        <div className="space-y-2">
          {data.features.slice(0, 5).map((feature) => {
            const config = statusConfig[feature.status];
            const StatusIcon = config.icon;

            return (
              <div
                key={feature.id}
                className="group flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-gray-50"
              >
                <div className={cn('rounded-full p-1', config.bg)}>
                  <StatusIcon className={cn('h-3 w-3', config.color)} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{feature.name}</span>
                    {feature.theme && (
                      <span className="text-muted-foreground text-xs">{feature.theme}</span>
                    )}
                  </div>
                  <ProgressBar progress={feature.progress || 0} />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
              </div>
            );
          })}
        </div>

        {/* View All Link */}
        {data.features.length > 5 && (
          <div className="mt-3 text-center">
            <button className="text-sm text-blue-600 hover:underline">
              View all {data.summary.total} features
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
