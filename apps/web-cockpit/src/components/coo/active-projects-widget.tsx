'use client';

import { FolderKanban, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface Project {
  id: string;
  name: string;
  status: 'on-track' | 'at-risk' | 'behind' | 'completed';
  progress: number;
  dueDate?: string;
  owner?: string;
  source: string; // 'asana', 'monday', 'linear', 'jira'
}

interface ActiveProjectsWidgetProps {
  engagementId: string;
  data?: {
    projects: Project[];
    summary: {
      total: number;
      onTrack: number;
      atRisk: number;
      behind: number;
      completedThisMonth: number;
    };
  };
  isLoading?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'on-track': {
    label: 'On Track',
    color: 'bg-green-500',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  'at-risk': {
    label: 'At Risk',
    color: 'bg-yellow-500',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  behind: { label: 'Behind', color: 'bg-red-500', icon: <AlertTriangle className="h-3 w-3" /> },
  completed: { label: 'Done', color: 'bg-blue-500', icon: <CheckCircle className="h-3 w-3" /> },
};

const sourceColors: Record<string, string> = {
  asana: 'bg-pink-100 text-pink-800',
  monday: 'bg-purple-100 text-purple-800',
  linear: 'bg-indigo-100 text-indigo-800',
  jira: 'bg-blue-100 text-blue-800',
};

export function ActiveProjectsWidget({ engagementId, data, isLoading }: ActiveProjectsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="h-5 w-5" />
            Active Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const projects = data?.projects || [];
  const summary = data?.summary || {
    total: 0,
    onTrack: 0,
    atRisk: 0,
    behind: 0,
    completedThisMonth: 0,
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-5 w-5" />
          Active Projects
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-4 flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-muted-foreground text-xs">Active</div>
          </div>
          <div className="flex flex-1 gap-2">
            {summary.atRisk > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800" variant="secondary">
                {summary.atRisk} at risk
              </Badge>
            )}
            {summary.behind > 0 && (
              <Badge className="bg-red-100 text-red-800" variant="secondary">
                {summary.behind} behind
              </Badge>
            )}
            {summary.completedThisMonth > 0 && (
              <Badge className="bg-green-100 text-green-800" variant="secondary">
                {summary.completedThisMonth} done
              </Badge>
            )}
          </div>
        </div>

        {/* Project List */}
        {projects.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center">
            <FolderKanban className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No active projects</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => {
              const config = statusConfig[project.status];
              return (
                <div
                  key={project.id}
                  className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${config.color}`} />
                    <span className="flex-1 truncate font-medium">{project.name}</span>
                    <Badge className={sourceColors[project.source]} variant="secondary">
                      {project.source}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${config.color}`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>{project.progress}% complete</span>
                    <div className="flex items-center gap-2">
                      {project.dueDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(project.dueDate)}</span>
                        </div>
                      )}
                      {project.owner && <span>{project.owner}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
