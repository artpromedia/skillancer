'use client';

import { ClipboardCheck, Plus, AlertTriangle } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface ComplianceFramework {
  id: string;
  framework: string;
  progress: number;
  targetDate: string;
  gapCount: number;
  status: 'on-track' | 'at-risk' | 'behind';
}

interface ComplianceRoadmapWidgetProps {
  engagementId: string;
  data?: {
    frameworks: ComplianceFramework[];
    overallScore: number;
  };
  isLoading?: boolean;
}

const frameworkLabels: Record<string, string> = {
  SOC2_TYPE1: 'SOC 2 Type I',
  SOC2_TYPE2: 'SOC 2 Type II',
  HIPAA: 'HIPAA',
  PCI_DSS: 'PCI-DSS',
  ISO27001: 'ISO 27001',
  GDPR: 'GDPR',
  NIST_CSF: 'NIST CSF',
  CIS_CONTROLS: 'CIS Controls',
};

const statusColors: Record<string, string> = {
  'on-track': 'bg-green-100 text-green-800',
  'at-risk': 'bg-yellow-100 text-yellow-800',
  behind: 'bg-red-100 text-red-800',
};

export function ComplianceRoadmapWidget({
  engagementId,
  data,
  isLoading,
}: ComplianceRoadmapWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5" />
            Compliance Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const frameworks = data?.frameworks || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5" />
            Compliance Roadmap
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            Add Framework
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {frameworks.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <ClipboardCheck className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>No compliance frameworks configured</p>
            <Button className="mt-2" size="sm" variant="outline">
              Add Framework
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {frameworks.map((framework) => (
              <div key={framework.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {frameworkLabels[framework.framework] || framework.framework}
                    </span>
                    <Badge className={statusColors[framework.status]} variant="secondary">
                      {framework.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    Due: {new Date(framework.targetDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      framework.progress >= 80
                        ? 'bg-green-500'
                        : framework.progress >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${framework.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{framework.progress}% complete</span>
                  {framework.gapCount > 0 && (
                    <div className="flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{framework.gapCount} gaps</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overall Score */}
        {data?.overallScore !== undefined && frameworks.length > 0 && (
          <div className="mt-4 border-t pt-4 text-center">
            <div className="text-muted-foreground text-sm">Overall Compliance Score</div>
            <div className="text-2xl font-bold">{data.overallScore}%</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
