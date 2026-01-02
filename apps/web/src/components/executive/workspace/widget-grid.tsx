/**
 * Widget Grid Component
 *
 * Draggable widget grid for executive workspace dashboard.
 * Supports customizable layouts and widget configurations.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle, Button } from '@skillancer/ui';
import {
  GripVertical,
  Settings,
  X,
  TrendingUp,
  Clock,
  Milestone,
  Activity,
  Code,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { useState, useCallback } from 'react';

// Types
interface WidgetPosition {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WidgetDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
  component: React.ComponentType<{ config?: Record<string, unknown> }>;
  defaultSize: { width: number; height: number };
}

interface WidgetGridProps {
  engagementId: string;
  enabledWidgets: string[];
  layout?: WidgetPosition[];
  onLayoutChange?: (layout: WidgetPosition[]) => void;
  isEditing?: boolean;
}

// Widget Components
function TimeSummaryWidget({ config }: { config?: Record<string, any> }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-blue-600">12h</p>
          <p className="text-muted-foreground text-sm">This Week</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-green-600">65h</p>
          <p className="text-muted-foreground text-sm">This Month</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-purple-600">180h</p>
          <p className="text-muted-foreground text-sm">Total</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-orange-600">20h</p>
          <p className="text-muted-foreground text-sm">Committed/Week</p>
        </div>
      </div>
    </div>
  );
}

function MilestonesWidget({ config }: { config?: Record<string, any> }) {
  const milestones = [
    { title: 'Q3 Tech Roadmap Review', due: 'Oct 15', status: 'in-progress' },
    { title: 'DevOps Pipeline Complete', due: 'Nov 1', status: 'upcoming' },
    { title: 'Team Hiring Plan', due: 'Sep 30', status: 'completed' },
  ];

  return (
    <div className="space-y-3 p-4">
      {milestones.map((m, i) => (
        <div key={i} className="bg-muted flex items-center justify-between rounded p-2">
          <div>
            <p className="text-sm font-medium">{m.title}</p>
            <p className="text-muted-foreground text-xs">Due: {m.due}</p>
          </div>
          <div
            className={`h-2 w-2 rounded-full ${
              m.status === 'completed'
                ? 'bg-green-500'
                : m.status === 'in-progress'
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function RecentActivityWidget({ config }: { config?: Record<string, any> }) {
  const activities = [
    { message: 'Logged 3 hours - Architecture review', time: '2h ago' },
    { message: 'Completed milestone: Team Hiring Plan', time: 'Yesterday' },
    { message: 'Added note: CI/CD decisions', time: '2 days ago' },
    { message: 'Scheduled standup meeting', time: '3 days ago' },
  ];

  return (
    <div className="space-y-3 p-4">
      {activities.map((a, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
          <div>
            <p className="text-sm">{a.message}</p>
            <p className="text-muted-foreground text-xs">{a.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TechHealthWidget({ config }: { config?: Record<string, any> }) {
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <span className="font-bold text-green-600">A</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">Code Quality</p>
        </div>
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <span className="font-bold text-yellow-600">B+</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">Tech Debt</p>
        </div>
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <span className="font-bold text-green-600">98%</span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">Uptime</p>
        </div>
      </div>
      <div className="mt-4 border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Last deploy</span>
          <span className="font-medium">2 hours ago</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Open PRs</span>
          <span className="font-medium">4</span>
        </div>
      </div>
    </div>
  );
}

function SprintProgressWidget({ config }: { config?: Record<string, any> }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Sprint 24</span>
        <span className="text-muted-foreground text-xs">Day 8 of 14</span>
      </div>
      <div className="mb-4 h-3 w-full rounded-full bg-gray-200">
        <div className="h-3 rounded-full bg-blue-600" style={{ width: '65%' }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted rounded p-2">
          <p className="text-lg font-bold">12</p>
          <p className="text-muted-foreground text-xs">Done</p>
        </div>
        <div className="bg-muted rounded p-2">
          <p className="text-lg font-bold">5</p>
          <p className="text-muted-foreground text-xs">In Progress</p>
        </div>
        <div className="bg-muted rounded p-2">
          <p className="text-lg font-bold">3</p>
          <p className="text-muted-foreground text-xs">Todo</p>
        </div>
      </div>
    </div>
  );
}

function TeamOverviewWidget({ config }: { config?: Record<string, any> }) {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <Users className="text-muted-foreground h-5 w-5" />
        <span className="font-medium">Engineering Team</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Team size</span>
          <span className="font-medium">8 engineers</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Open positions</span>
          <span className="font-medium">2</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg tenure</span>
          <span className="font-medium">14 months</span>
        </div>
      </div>
    </div>
  );
}

// Widget Registry
const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  'time-summary': {
    id: 'time-summary',
    name: 'Time Summary',
    icon: Clock,
    component: TimeSummaryWidget,
    defaultSize: { width: 2, height: 1 },
  },
  milestones: {
    id: 'milestones',
    name: 'Milestones',
    icon: Milestone,
    component: MilestonesWidget,
    defaultSize: { width: 2, height: 2 },
  },
  'recent-activity': {
    id: 'recent-activity',
    name: 'Recent Activity',
    icon: Activity,
    component: RecentActivityWidget,
    defaultSize: { width: 2, height: 2 },
  },
  'tech-health': {
    id: 'tech-health',
    name: 'Tech Health',
    icon: Code,
    component: TechHealthWidget,
    defaultSize: { width: 2, height: 2 },
  },
  'sprint-progress': {
    id: 'sprint-progress',
    name: 'Sprint Progress',
    icon: BarChart3,
    component: SprintProgressWidget,
    defaultSize: { width: 2, height: 2 },
  },
  'team-overview': {
    id: 'team-overview',
    name: 'Team Overview',
    icon: Users,
    component: TeamOverviewWidget,
    defaultSize: { width: 2, height: 1 },
  },
};

// Single Widget Component
function Widget({
  definition,
  isEditing,
  onRemove,
}: {
  definition: WidgetDefinition;
  isEditing?: boolean;
  onRemove?: () => void;
}) {
  const Icon = definition.icon;
  const WidgetComponent = definition.component;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {isEditing && <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />}
          <Icon className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-sm">{definition.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button className="h-6 w-6 p-0" size="sm" variant="ghost">
            <Settings className="h-3 w-3" />
          </Button>
          {isEditing && onRemove && (
            <Button className="h-6 w-6 p-0" size="sm" variant="ghost" onClick={onRemove}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <WidgetComponent />
      </CardContent>
    </Card>
  );
}

// Main Widget Grid Component
export function WidgetGrid({
  engagementId,
  enabledWidgets,
  layout,
  onLayoutChange,
  isEditing = false,
}: WidgetGridProps) {
  const [activeWidgets, setActiveWidgets] = useState(enabledWidgets);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setActiveWidgets((prev) => prev.filter((id) => id !== widgetId));
  }, []);

  const widgets = activeWidgets
    .map((id) => WIDGET_REGISTRY[id])
    .filter((w): w is WidgetDefinition => Boolean(w));

  if (widgets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-semibold">No Widgets Added</h3>
        <p className="text-muted-foreground mb-4">Customize your workspace by adding widgets.</p>
        <Button>Add Widgets</Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {widgets.map((widget) => (
        <div
          key={widget.id}
          className={
            widget.defaultSize.width === 2 && widget.defaultSize.height === 2 ? 'md:col-span-1' : ''
          }
        >
          <Widget
            definition={widget}
            isEditing={isEditing}
            onRemove={() => handleRemoveWidget(widget.id)}
          />
        </div>
      ))}
    </div>
  );
}
