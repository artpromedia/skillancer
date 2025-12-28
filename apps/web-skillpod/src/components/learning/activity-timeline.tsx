'use client';

import { cn } from '@skillancer/ui';
import { BookOpen, Code, Award, CheckCircle2, Play, Trophy, Clock } from 'lucide-react';

interface Activity {
  id: string;
  type: 'progress' | 'completed' | 'started' | 'achievement' | 'project';
  title: string;
  subtitle: string;
  time: string;
  duration?: string;
  progress?: number;
  badge?: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  maxItems?: number;
}

export function ActivityTimeline({ activities, maxItems }: Readonly<ActivityTimelineProps>) {
  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'progress':
        return Play;
      case 'completed':
        return CheckCircle2;
      case 'started':
        return BookOpen;
      case 'achievement':
        return Trophy;
      case 'project':
        return Code;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'progress':
        return 'bg-blue-100 text-blue-600';
      case 'completed':
        return 'bg-green-100 text-green-600';
      case 'started':
        return 'bg-purple-100 text-purple-600';
      case 'achievement':
        return 'bg-amber-100 text-amber-600';
      case 'project':
        return 'bg-emerald-100 text-emerald-600';
    }
  };

  const getLineColor = (type: Activity['type']) => {
    switch (type) {
      case 'progress':
        return 'bg-blue-200';
      case 'completed':
        return 'bg-green-200';
      case 'started':
        return 'bg-purple-200';
      case 'achievement':
        return 'bg-amber-200';
      case 'project':
        return 'bg-emerald-200';
    }
  };

  return (
    <div className="space-y-0">
      {displayActivities.map((activity, idx) => {
        const Icon = getActivityIcon(activity.type);
        const isLast = idx === displayActivities.length - 1;

        return (
          <div key={activity.id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div
                className={cn('absolute bottom-0 left-5 top-10 w-0.5', getLineColor(activity.type))}
              />
            )}

            {/* Icon */}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                getActivityColor(activity.type)
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-gray-900">{activity.title}</h4>
                  <p className="text-sm text-gray-500">{activity.subtitle}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-gray-400">{activity.time}</span>
              </div>

              {/* Progress bar */}
              {activity.progress !== undefined && (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{activity.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${activity.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Duration */}
              {activity.duration && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {activity.duration}
                </div>
              )}

              {/* Badge */}
              {activity.badge && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <Award className="h-3 w-3" />
                  {activity.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityTimeline;
