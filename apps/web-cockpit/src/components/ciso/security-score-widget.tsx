'use client';

import { Shield, TrendingUp, TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface SecurityScoreWidgetProps {
  engagementId: string;
  data?: {
    score: number;
    previousScore: number;
    grade: string;
    components: {
      name: string;
      score: number;
      weight: number;
    }[];
  };
  isLoading?: boolean;
}

const gradeColors: Record<string, string> = {
  'A+': 'text-emerald-600',
  A: 'text-emerald-600',
  'A-': 'text-emerald-600',
  'B+': 'text-green-600',
  B: 'text-green-600',
  'B-': 'text-green-600',
  'C+': 'text-yellow-600',
  C: 'text-yellow-600',
  'C-': 'text-yellow-600',
  D: 'text-orange-600',
  F: 'text-red-600',
};

export function SecurityScoreWidget({ engagementId, data, isLoading }: SecurityScoreWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Security Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 rounded bg-gray-200" />
            <div className="h-4 w-2/3 rounded bg-gray-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = data?.score ?? 0;
  const previousScore = data?.previousScore ?? 0;
  const change = score - previousScore;
  const grade = data?.grade ?? 'N/A';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Security Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Score Circle */}
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90 transform">
              <circle cx="40" cy="40" fill="none" r="36" stroke="#e5e7eb" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                fill="none"
                r="36"
                stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                strokeDasharray={`${(score / 100) * 226} 226`}
                strokeLinecap="round"
                strokeWidth="8"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{score}</span>
            </div>
          </div>

          {/* Grade & Trend */}
          <div className="flex-1">
            <div className={`text-3xl font-bold ${gradeColors[grade] || 'text-gray-600'}`}>
              {grade}
            </div>
            <div className="flex items-center gap-1 text-sm">
              {change > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">+{change} pts</span>
                </>
              ) : change < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-red-600">{change} pts</span>
                </>
              ) : (
                <span className="text-muted-foreground">No change</span>
              )}
            </div>
          </div>
        </div>

        {/* Components */}
        <div className="mt-4 space-y-2">
          {data?.components?.map((component) => (
            <div key={component.name} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{component.name}</span>
              <span className="font-medium">{component.score}/100</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
