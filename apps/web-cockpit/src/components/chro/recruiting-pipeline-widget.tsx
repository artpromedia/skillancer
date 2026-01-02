'use client';

import { GitBranch, Users, ArrowRight, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface RecruitingPipelineWidgetProps {
  data?: {
    stages: Array<{
      name: string;
      count: number;
      conversionRate: number;
    }>;
    totalCandidates: number;
    weeklyChange: number;
    avgTimeToHire: number;
    offerAcceptanceRate: number;
  };
  isLoading?: boolean;
  onStageClick?: (stageName: string) => void;
}

const stageColors: Record<string, string> = {
  Applied: 'bg-gray-500',
  Screening: 'bg-blue-400',
  Interview: 'bg-blue-500',
  Technical: 'bg-purple-500',
  'Final Round': 'bg-indigo-500',
  Offer: 'bg-green-500',
  Hired: 'bg-green-600',
};

export function RecruitingPipelineWidget({
  data,
  isLoading,
  onStageClick,
}: RecruitingPipelineWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Recruiting Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-muted h-24 flex-1 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Recruiting Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No pipeline data. Connect your ATS to visualize the recruiting funnel.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.stages.map((s) => s.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Recruiting Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{data.totalCandidates}</p>
            <p className="text-muted-foreground text-xs">Total Candidates</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">+{data.weeklyChange}</p>
            <p className="text-muted-foreground text-xs">This Week</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.avgTimeToHire}d</p>
            <p className="text-muted-foreground text-xs">Avg Time to Hire</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.offerAcceptanceRate}%</p>
            <p className="text-muted-foreground text-xs">Offer Accept Rate</p>
          </div>
        </div>

        {/* Funnel Visualization */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Pipeline Stages</h4>
          <div className="flex items-end gap-1">
            {data.stages.map((stage, index) => {
              const height = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              const color = stageColors[stage.name] || 'bg-blue-500';

              return (
                <div key={stage.name} className="flex flex-1 flex-col items-center">
                  <div
                    className={`w-full ${color} cursor-pointer rounded-t transition-all hover:opacity-80`}
                    style={{ height: `${Math.max(height, 10)}px`, minHeight: '20px' }}
                    onClick={() => onStageClick?.(stage.name)}
                  >
                    <span className="flex h-full items-center justify-center text-xs font-medium text-white">
                      {stage.count}
                    </span>
                  </div>
                  <p className="mt-2 text-center text-xs font-medium">{stage.name}</p>
                  {index < data.stages.length - 1 && (
                    <p className="text-muted-foreground text-xs">{stage.conversionRate}%</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Conversion Flow */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Conversion</span>
            <span className="flex items-center gap-2 font-medium">
              <TrendingUp className="h-4 w-4 text-green-600" />
              {data.stages.length > 0 && data.stages[0].count > 0
                ? Math.round(
                    (data.stages[data.stages.length - 1]?.count / data.stages[0].count) * 100
                  )
                : 0}
              % Applied → Hired
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
