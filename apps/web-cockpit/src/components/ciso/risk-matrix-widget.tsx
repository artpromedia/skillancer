'use client';

import { Grid3X3, AlertTriangle } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface Risk {
  id: string;
  title: string;
  status: string;
}

interface RiskMatrixCell {
  likelihood: number;
  impact: number;
  risks: Risk[];
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RiskMatrixWidgetProps {
  engagementId: string;
  data?: {
    matrix: RiskMatrixCell[][];
    summary: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  isLoading?: boolean;
  onCellClick?: (likelihood: number, impact: number) => void;
}

const severityColors: Record<string, string> = {
  low: 'bg-green-100 hover:bg-green-200',
  medium: 'bg-yellow-100 hover:bg-yellow-200',
  high: 'bg-orange-100 hover:bg-orange-200',
  critical: 'bg-red-100 hover:bg-red-200',
};

const severityBadgeColors: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export function RiskMatrixWidget({
  engagementId,
  data,
  isLoading,
  onCellClick,
}: RiskMatrixWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3X3 className="h-5 w-5" />
            Risk Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-gray-100" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default empty matrix if no data
  const matrix = data?.matrix || generateEmptyMatrix();
  const summary = data?.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3X3 className="h-5 w-5" />
            Risk Matrix
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{summary.total} risks</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Matrix Grid */}
          <div className="flex-1">
            <div className="flex">
              {/* Y-axis label */}
              <div className="mr-2 flex w-8 flex-col items-center justify-center">
                <span className="text-muted-foreground rotate-[-90deg] whitespace-nowrap text-xs">
                  Impact →
                </span>
              </div>

              <div className="flex-1">
                {/* Matrix */}
                <div className="grid grid-cols-5 gap-1">
                  {matrix.map((row, rowIndex) =>
                    row.map((cell) => (
                      <div
                        key={`${cell.likelihood}-${cell.impact}`}
                        className={`flex h-12 cursor-pointer items-center justify-center rounded transition-colors ${
                          severityColors[cell.severity]
                        }`}
                        title={`Likelihood: ${cell.likelihood}, Impact: ${cell.impact}`}
                        onClick={() => onCellClick?.(cell.likelihood, cell.impact)}
                      >
                        {cell.count > 0 && <span className="text-lg font-bold">{cell.count}</span>}
                      </div>
                    ))
                  )}
                </div>

                {/* X-axis label */}
                <div className="mt-2 text-center">
                  <span className="text-muted-foreground text-xs">Likelihood →</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="w-32 space-y-2">
            <h4 className="mb-3 text-sm font-medium">By Severity</h4>
            {summary.critical > 0 && (
              <div className="flex items-center justify-between">
                <Badge className={severityBadgeColors.critical}>Critical</Badge>
                <span className="font-medium">{summary.critical}</span>
              </div>
            )}
            {summary.high > 0 && (
              <div className="flex items-center justify-between">
                <Badge className={severityBadgeColors.high}>High</Badge>
                <span className="font-medium">{summary.high}</span>
              </div>
            )}
            {summary.medium > 0 && (
              <div className="flex items-center justify-between">
                <Badge className={severityBadgeColors.medium}>Medium</Badge>
                <span className="font-medium">{summary.medium}</span>
              </div>
            )}
            {summary.low > 0 && (
              <div className="flex items-center justify-between">
                <Badge className={severityBadgeColors.low}>Low</Badge>
                <span className="font-medium">{summary.low}</span>
              </div>
            )}
            {summary.total === 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">No risks</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function generateEmptyMatrix(): RiskMatrixCell[][] {
  const matrix: RiskMatrixCell[][] = [];
  for (let impact = 5; impact >= 1; impact--) {
    const row: RiskMatrixCell[] = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      const score = likelihood * impact;
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (score >= 20) severity = 'critical';
      else if (score >= 12) severity = 'high';
      else if (score >= 6) severity = 'medium';
      else severity = 'low';

      row.push({
        likelihood,
        impact,
        risks: [],
        count: 0,
        severity,
      });
    }
    matrix.push(row);
  }
  return matrix;
}
