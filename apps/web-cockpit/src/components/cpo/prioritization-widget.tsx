'use client';

/**
 * Prioritization Widget for CPO Dashboard
 * Displays prioritized features using RICE/ICE/Value-Effort framework
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { ListOrdered, ArrowUpDown, Zap, Target, Clock, DollarSign } from 'lucide-react';

interface PrioritizedFeature {
  id: string;
  name: string;
  score: number;
  rank: number;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  value?: number;
  status?: 'proposed' | 'scoped' | 'prioritized' | 'scheduled';
}

interface PrioritizationWidgetProps {
  engagementId: string;
  data?: {
    features: PrioritizedFeature[];
    framework: 'rice' | 'ice' | 'value_effort' | 'weighted' | 'custom';
    lastUpdated?: string;
  };
  className?: string;
}

// Demo data
const demoData = {
  features: [
    {
      id: '1',
      name: 'AI Auto-Complete',
      score: 892,
      rank: 1,
      reach: 5000,
      impact: 3,
      confidence: 80,
      effort: 2,
      status: 'scheduled' as const,
    },
    {
      id: '2',
      name: 'Bulk Export',
      score: 756,
      rank: 2,
      reach: 3000,
      impact: 2,
      confidence: 90,
      effort: 1,
      status: 'prioritized' as const,
    },
    {
      id: '3',
      name: 'Mobile Offline Mode',
      score: 650,
      rank: 3,
      reach: 2000,
      impact: 3,
      confidence: 70,
      effort: 3,
      status: 'scoped' as const,
    },
    {
      id: '4',
      name: 'Custom Dashboards',
      score: 520,
      rank: 4,
      reach: 4000,
      impact: 2,
      confidence: 60,
      effort: 4,
      status: 'proposed' as const,
    },
    {
      id: '5',
      name: 'Zapier Integration',
      score: 480,
      rank: 5,
      reach: 1500,
      impact: 2,
      confidence: 85,
      effort: 2,
      status: 'proposed' as const,
    },
  ],
  framework: 'rice' as const,
  lastUpdated: '2025-01-07T10:00:00Z',
};

const statusConfig = {
  proposed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Proposed' },
  scoped: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Scoped' },
  prioritized: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Prioritized' },
  scheduled: { bg: 'bg-green-100', text: 'text-green-600', label: 'Scheduled' },
};

const frameworkLabels = {
  rice: 'RICE Score',
  ice: 'ICE Score',
  value_effort: 'Value/Effort',
  weighted: 'Weighted',
  custom: 'Custom',
};

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const percentage = Math.min((score / maxScore) * 100, 100);
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function PrioritizationWidget({
  engagementId,
  data = demoData,
  className,
}: PrioritizationWidgetProps) {
  const maxScore = Math.max(...data.features.map((f) => f.score));

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <ListOrdered className="h-4 w-4" />
          Prioritization
        </CardTitle>
        <div className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
          <ArrowUpDown className="h-3 w-3" />
          <span>{frameworkLabels[data.framework]}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* RICE Legend */}
        {data.framework === 'rice' && (
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" /> Reach
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> Impact
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Confidence
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Effort
              </span>
            </div>
          </div>
        )}

        {/* Feature List */}
        <div className="space-y-2">
          {data.features.map((feature) => {
            const statusCfg = statusConfig[feature.status || 'proposed'];

            return (
              <div
                key={feature.id}
                className="flex items-center justify-between rounded-lg border p-2 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      feature.rank === 1
                        ? 'bg-amber-400 text-white'
                        : feature.rank === 2
                          ? 'bg-gray-300 text-gray-700'
                          : feature.rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {feature.rank}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{feature.name}</span>
                      {feature.status && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      )}
                    </div>

                    {/* RICE breakdown */}
                    {data.framework === 'rice' && (
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        <span>R:{feature.reach?.toLocaleString()}</span>
                        <span>I:{feature.impact}</span>
                        <span>C:{feature.confidence}%</span>
                        <span>E:{feature.effort}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ScoreBar maxScore={maxScore} score={feature.score} />
                  <span className="w-12 text-right text-sm font-bold">{feature.score}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Last Updated */}
        {data.lastUpdated && (
          <div className="text-muted-foreground mt-3 text-center text-xs">
            Updated {new Date(data.lastUpdated).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
