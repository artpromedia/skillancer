'use client';

import { cn } from '@skillancer/ui';
import { CheckCircle2, Circle, Lock, Play } from 'lucide-react';

interface PathModuleItem {
  id: string;
  status: 'completed' | 'in-progress' | 'locked' | 'available';
}

interface PathModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  itemCount: number;
  type: 'course' | 'project' | 'assessment' | 'certification';
  status: 'completed' | 'in-progress' | 'locked' | 'available';
  items: PathModuleItem[];
}

interface PathRoadmapProps {
  modules: PathModule[];
}

export function PathRoadmap({ modules }: Readonly<PathRoadmapProps>) {
  const getStatusColor = (status: PathModule['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500';
      case 'in-progress':
        return 'bg-indigo-500 border-indigo-500';
      case 'available':
        return 'bg-white border-gray-300';
      case 'locked':
        return 'bg-gray-100 border-gray-200';
    }
  };

  const getLineColor = (status: PathModule['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-gradient-to-b from-green-500 to-gray-200';
      default:
        return 'bg-gray-200';
    }
  };

  const getTypeEmoji = (type: PathModule['type']) => {
    switch (type) {
      case 'course':
        return '📚';
      case 'project':
        return '🛠️';
      case 'assessment':
        return '📝';
      case 'certification':
        return '🎓';
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-6 font-semibold text-gray-900">Learning Roadmap</h3>

      <div className="relative">
        {modules.map((module, index) => {
          const isLast = index === modules.length - 1;
          return (
            <div key={module.id} className="flex gap-4 pb-6">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                {/* Node */}
                <div
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2',
                    getStatusColor(module.status)
                  )}
                >
                  {module.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-white" />}
                  {module.status === 'in-progress' && (
                    <Play className="h-5 w-5 fill-white text-white" />
                  )}
                  {module.status === 'available' && <Circle className="h-5 w-5 text-gray-300" />}
                  {module.status === 'locked' && <Lock className="h-4 w-4 text-gray-400" />}
                </div>
                {/* Line */}
                {!isLast && (
                  <div className={cn('-mt-1 w-0.5 flex-1', getLineColor(module.status))} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getTypeEmoji(module.type)}</span>
                      <h4
                        className={cn(
                          'font-medium',
                          module.status === 'locked' ? 'text-gray-400' : 'text-gray-900'
                        )}
                      >
                        {module.title}
                      </h4>
                    </div>
                    <p
                      className={cn(
                        'mt-0.5 text-sm',
                        module.status === 'locked' ? 'text-gray-400' : 'text-gray-500'
                      )}
                    >
                      {module.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        'text-sm',
                        module.status === 'locked' ? 'text-gray-400' : 'text-gray-600'
                      )}
                    >
                      {module.duration}
                    </p>
                    <p className="text-xs text-gray-400">{module.itemCount} items</p>
                  </div>
                </div>

                {/* Progress bar for in-progress module */}
                {module.status === 'in-progress' && module.items.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-gray-500">Module Progress</span>
                      <span className="font-medium text-indigo-600">
                        {module.items.filter((i) => i.status === 'completed').length}/
                        {module.items.length}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${(module.items.filter((i) => i.status === 'completed').length / module.items.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Completed badge */}
                {module.status === 'completed' && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          Completed
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-indigo-500" />
          In Progress
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border border-gray-300 bg-white" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border border-gray-200 bg-gray-100" />
          Locked
        </div>
      </div>
    </div>
  );
}

export default PathRoadmap;
