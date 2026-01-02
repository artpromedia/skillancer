'use client';

/**
 * Experiments Widget for CPO Dashboard
 * Displays running A/B tests and experiment results
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { FlaskConical, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';

interface ExperimentData {
  id: string;
  name: string;
  status: 'running' | 'significant' | 'inconclusive' | 'winner';
  daysRunning: number;
  primaryMetric: {
    name: string;
    lift: number;
    confidence: number;
  };
  source?: string;
}

interface ExperimentsWidgetProps {
  engagementId: string;
  data?: {
    experiments: ExperimentData[];
    summary: {
      running: number;
      needsAttention: number;
      recentWinners: number;
    };
  };
  className?: string;
}

// Demo data
const demoData = {
  experiments: [
    {
      id: '1',
      name: 'New Checkout Flow',
      status: 'significant' as const,
      daysRunning: 14,
      primaryMetric: { name: 'Conversion Rate', lift: 12.3, confidence: 97 },
      source: 'launchdarkly',
    },
    {
      id: '2',
      name: 'Onboarding V2',
      status: 'running' as const,
      daysRunning: 7,
      primaryMetric: { name: 'Activation Rate', lift: 5.8, confidence: 82 },
      source: 'statsig',
    },
    {
      id: '3',
      name: 'Pricing Page CTA',
      status: 'winner' as const,
      daysRunning: 21,
      primaryMetric: { name: 'CTR', lift: 18.5, confidence: 99 },
      source: 'posthog',
    },
    {
      id: '4',
      name: 'Email Subject Lines',
      status: 'inconclusive' as const,
      daysRunning: 28,
      primaryMetric: { name: 'Open Rate', lift: 2.1, confidence: 65 },
      source: 'statsig',
    },
  ],
  summary: {
    running: 4,
    needsAttention: 1,
    recentWinners: 2,
  },
};

function StatusBadge({ status }: { status: ExperimentData['status'] }) {
  const config = {
    running: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Running' },
    significant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Significant' },
    inconclusive: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Inconclusive' },
    winner: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Winner' },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', bg, text)}>{label}</span>
  );
}

export function ExperimentsWidget({
  engagementId,
  data = demoData,
  className,
}: ExperimentsWidgetProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <FlaskConical className="h-4 w-4" />
          Active Experiments
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-blue-500" />
            <span>{data.summary.running}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            <span>{data.summary.needsAttention}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>{data.summary.recentWinners}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.experiments.map((experiment) => (
            <div
              key={experiment.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{experiment.name}</span>
                  <StatusBadge status={experiment.status} />
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{experiment.primaryMetric.name}</span>
                  <span>•</span>
                  <span>{experiment.daysRunning} days</span>
                  {experiment.source && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{experiment.source}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-bold',
                    experiment.primaryMetric.lift >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  <TrendingUp className="h-3 w-3" />
                  {experiment.primaryMetric.lift >= 0 ? '+' : ''}
                  {experiment.primaryMetric.lift.toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-xs">
                  {experiment.primaryMetric.confidence}% confidence
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
