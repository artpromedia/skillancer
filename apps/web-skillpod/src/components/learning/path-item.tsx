'use client';

import { cn } from '@skillancer/ui';
import {
  Video,
  FileText,
  HelpCircle,
  Code,
  Briefcase,
  CheckCircle2,
  Play,
  Lock,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

interface PathItemData {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'quiz' | 'exercise' | 'project';
  duration: string;
  status: 'completed' | 'in-progress' | 'locked' | 'available';
}

interface PathItemProps {
  item: PathItemData;
  moduleId: string;
  pathId: string;
}

export function PathItem({ item, moduleId, pathId }: Readonly<PathItemProps>) {
  const getTypeIcon = (type: PathItemData['type']) => {
    switch (type) {
      case 'video':
        return Video;
      case 'reading':
        return FileText;
      case 'quiz':
        return HelpCircle;
      case 'exercise':
        return Code;
      case 'project':
        return Briefcase;
    }
  };

  const getTypeLabel = (type: PathItemData['type']) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'reading':
        return 'Reading';
      case 'quiz':
        return 'Quiz';
      case 'exercise':
        return 'Exercise';
      case 'project':
        return 'Project';
    }
  };

  const getTypeColor = (type: PathItemData['type']) => {
    switch (type) {
      case 'video':
        return 'text-blue-600 bg-blue-50';
      case 'reading':
        return 'text-amber-600 bg-amber-50';
      case 'quiz':
        return 'text-purple-600 bg-purple-50';
      case 'exercise':
        return 'text-green-600 bg-green-50';
      case 'project':
        return 'text-indigo-600 bg-indigo-50';
    }
  };

  const TypeIcon = getTypeIcon(item.type);

  const isClickable = item.status !== 'locked';

  const content = (
    <div
      className={cn(
        'flex items-center justify-between border-b border-gray-100 px-5 py-3 last:border-0',
        isClickable && 'cursor-pointer hover:bg-gray-100',
        item.status === 'locked' && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div className="flex w-6 justify-center">
          {item.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {item.status === 'in-progress' && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-indigo-500">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
            </div>
          )}
          {item.status === 'available' && (
            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
          )}
          {item.status === 'locked' && <Lock className="h-4 w-4 text-gray-400" />}
        </div>

        {/* Type Icon & Title */}
        <div className={cn('rounded p-1.5', getTypeColor(item.type))}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div>
          <p
            className={cn(
              'text-sm font-medium',
              item.status === 'locked' ? 'text-gray-400' : 'text-gray-900'
            )}
          >
            {item.title}
          </p>
          <p className="text-xs text-gray-400">
            {getTypeLabel(item.type)} • {item.duration}
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" />
          {item.duration}
        </span>
        {item.status === 'in-progress' && (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            Continue
          </span>
        )}
        {item.status === 'available' && (
          <span className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            <Play className="h-3 w-3" />
            Start
          </span>
        )}
        {item.status === 'completed' && <span className="text-xs text-green-600">✓ Done</span>}
      </div>
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/learn/paths/${pathId}/modules/${moduleId}/items/${item.id}`}>{content}</Link>
    );
  }

  return content;
}

export default PathItem;
