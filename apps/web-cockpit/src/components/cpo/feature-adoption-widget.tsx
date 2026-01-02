'use client';

/**
 * Feature Adoption Widget for CPO Dashboard
 * Displays adoption rates for recently launched features
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { Rocket, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface FeatureData {
  name: string;
  adoptionRate: number;
  activeUsers: number;
  trend: number;
  targetAdoption: number;
  launchDate?: string;
}

interface FeatureAdoptionWidgetProps {
  engagementId: string;
  data?: {
    features: FeatureData[];
    totalUsers: number;
  };
  className?: string;
}

// Demo data
const demoData = {
  features: [
    {
      name: 'AI Assistant',
      adoptionRate: 72,
      activeUsers: 113042,
      trend: 15.2,
      targetAdoption: 80,
      launchDate: '2025-12-01',
    },
    {
      name: 'Dark Mode',
      adoptionRate: 45,
      activeUsers: 70601,
      trend: 8.3,
      targetAdoption: 50,
      launchDate: '2025-11-15',
    },
    {
      name: 'Keyboard Shortcuts',
      adoptionRate: 23,
      activeUsers: 36085,
      trend: 3.1,
      targetAdoption: 40,
      launchDate: '2025-12-10',
    },
    {
      name: 'Export to PDF',
      adoptionRate: 38,
      activeUsers: 59619,
      trend: -2.4,
      targetAdoption: 45,
      launchDate: '2025-10-20',
    },
  ],
  totalUsers: 156892,
};

function AdoptionBar({
  current,
  target,
  color,
}: {
  current: number;
  target: number;
  color: string;
}) {
  const isOnTrack = current >= target * 0.9;

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
      {/* Current adoption */}
      <div
        className={cn('absolute left-0 top-0 h-full rounded-full transition-all', color)}
        style={{ width: `${Math.min(current, 100)}%` }}
      />
      {/* Target marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-gray-400"
        style={{ left: `${target}%` }}
        title={`Target: ${target}%`}
      />
    </div>
  );
}

export function FeatureAdoptionWidget({
  engagementId,
  data = demoData,
  className,
}: FeatureAdoptionWidgetProps) {
  const avgAdoption =
    data.features.reduce((sum, f) => sum + f.adoptionRate, 0) / data.features.length;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Rocket className="h-4 w-4" />
          Feature Adoption
        </CardTitle>
        <div className="bg-muted rounded-md px-2 py-1 text-xs">
          <span className="text-muted-foreground">Avg: </span>
          <span className="font-medium">{avgAdoption.toFixed(0)}%</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.features.map((feature, index) => {
            const isOnTrack = feature.adoptionRate >= feature.targetAdoption * 0.9;
            const color = isOnTrack ? 'bg-green-500' : 'bg-amber-500';

            return (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{feature.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{feature.adoptionRate}%</span>
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-xs',
                        feature.trend >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {feature.trend >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {feature.trend >= 0 ? '+' : ''}
                      {feature.trend.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <AdoptionBar
                  color={color}
                  current={feature.adoptionRate}
                  target={feature.targetAdoption}
                />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{feature.activeUsers.toLocaleString()} users</span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Target: {feature.targetAdoption}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
