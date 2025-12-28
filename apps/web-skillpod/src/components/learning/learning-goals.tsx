'use client';

import { cn } from '@skillancer/ui';
import { Target, Plus, CheckCircle2, Edit2, Trash2, Calendar, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface Goal {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  target: number;
  current: number;
  unit: string;
  dueDate?: string;
  status: 'on-track' | 'behind' | 'completed' | 'overdue';
}

interface LearningGoalsProps {
  goals?: Goal[];
  onAddGoal?: () => void;
  compact?: boolean;
}

const defaultGoals: Goal[] = [
  {
    id: '1',
    title: 'Daily learning time',
    type: 'daily',
    target: 60,
    current: 45,
    unit: 'minutes',
    status: 'on-track',
  },
  {
    id: '2',
    title: 'Complete React course',
    type: 'weekly',
    target: 100,
    current: 65,
    unit: '%',
    dueDate: 'in 5 days',
    status: 'on-track',
  },
  {
    id: '3',
    title: 'Earn AWS certification',
    type: 'monthly',
    target: 1,
    current: 0,
    unit: 'certification',
    dueDate: 'Jun 30',
    status: 'behind',
  },
  {
    id: '4',
    title: 'Build 3 portfolio projects',
    type: 'custom',
    target: 3,
    current: 1,
    unit: 'projects',
    dueDate: 'Q2 2024',
    status: 'on-track',
  },
];

export function LearningGoals({
  goals = defaultGoals,
  onAddGoal,
  compact = false,
}: Readonly<LearningGoalsProps>) {
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const getStatusColor = (status: Goal['status']) => {
    switch (status) {
      case 'on-track':
        return 'text-green-600 bg-green-50';
      case 'behind':
        return 'text-amber-600 bg-amber-50';
      case 'completed':
        return 'text-blue-600 bg-blue-50';
      case 'overdue':
        return 'text-red-600 bg-red-50';
    }
  };

  const getStatusLabel = (status: Goal['status']) => {
    switch (status) {
      case 'on-track':
        return 'On Track';
      case 'behind':
        return 'Behind';
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
    }
  };

  const getProgressColor = (status: Goal['status']) => {
    switch (status) {
      case 'on-track':
        return 'bg-green-500';
      case 'behind':
        return 'bg-amber-500';
      case 'completed':
        return 'bg-blue-500';
      case 'overdue':
        return 'bg-red-500';
    }
  };

  const getTypeIcon = (type: Goal['type']) => {
    switch (type) {
      case 'daily':
        return '📅';
      case 'weekly':
        return '📆';
      case 'monthly':
        return '🗓️';
      case 'custom':
        return '🎯';
    }
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-gray-900">Goals</span>
          </div>
          <button className="rounded p-1 hover:bg-gray-100" onClick={onAddGoal}>
            <Plus className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-2">
          {goals.slice(0, 3).map((goal) => (
            <div key={goal.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full',
                  goal.status === 'completed' ? 'bg-green-500' : 'border-2 border-gray-300'
                )}
              >
                {goal.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-white" />}
              </div>
              <span className="flex-1 truncate text-sm text-gray-700">{goal.title}</span>
              <span className="text-xs text-gray-500">
                {goal.current}/{goal.target}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Learning Goals</h3>
        </div>
        <button
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
          onClick={onAddGoal}
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      <div className="space-y-3">
        {goals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const isExpanded = expandedGoal === goal.id;

          return (
            <div
              key={goal.id}
              className="overflow-hidden rounded-lg border border-gray-100 transition-colors hover:border-gray-200"
            >
              <button
                className="w-full p-3 text-left"
                onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getTypeIcon(goal.type)}</span>
                    <span className="font-medium text-gray-900">{goal.title}</span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      getStatusColor(goal.status)
                    )}
                  >
                    {getStatusLabel(goal.status)}
                  </span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        getProgressColor(goal.status)
                      )}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {goal.current}/{goal.target} {goal.unit}
                  </span>
                </div>

                {goal.dueDate && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    Due {goal.dueDate}
                  </div>
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-3 pb-3 pt-3">
                  <div className="flex items-center gap-2">
                    <button className="flex flex-1 items-center justify-center gap-1 rounded py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50">
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-1 rounded py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50">
                      <TrendingUp className="h-3.5 w-3.5" />
                      History
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-1 rounded py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">
              {goals.filter((g) => g.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {goals.filter((g) => g.status === 'on-track').length}
            </p>
            <p className="text-xs text-gray-500">On Track</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">
              {goals.filter((g) => g.status === 'behind' || g.status === 'overdue').length}
            </p>
            <p className="text-xs text-gray-500">Need Attention</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearningGoals;
