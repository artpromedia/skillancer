'use client';

import { cn } from '@skillancer/ui';
import { Calendar, Flame, Snowflake, Trophy, Zap } from 'lucide-react';

interface LearningStreakProps {
  compact?: boolean;
}

export function LearningStreak({ compact = false }: Readonly<LearningStreakProps>) {
  // Mock data
  const currentStreak = 12;
  const longestStreak = 28;
  const weeklyGoal = { current: 8, target: 10 };
  const streakFreezeAvailable = 2;

  // Generate last 12 weeks of activity (GitHub-style heatmap)
  const generateHeatmapData = () => {
    const weeks = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (w * 7 + (6 - d)));
        const intensity = Math.random();
        let level: 0 | 1 | 2 | 3 | 4;
        if (intensity < 0.1) level = 0;
        else if (intensity < 0.3) level = 1;
        else if (intensity < 0.5) level = 2;
        else if (intensity < 0.7) level = 3;
        else level = 4;
        week.push({
          date: date.toISOString().split('T')[0],
          level,
        });
      }
      weeks.push(week);
    }
    return weeks;
  };

  const heatmapData = generateHeatmapData();

  const levelColors = {
    0: 'bg-gray-100',
    1: 'bg-green-200',
    2: 'bg-green-400',
    3: 'bg-green-500',
    4: 'bg-green-600',
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
        <Flame className="h-5 w-5 text-orange-400" />
        <div>
          <p className="text-sm font-bold text-white">{currentStreak} days</p>
          <p className="text-xs text-white/70">streak</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-orange-100 p-2">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Learning Streak</h2>
            <p className="text-sm text-gray-500">Keep the momentum going!</p>
          </div>
        </div>
        {streakFreezeAvailable > 0 && (
          <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1">
            <Snowflake className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-700">{streakFreezeAvailable} freezes</span>
          </div>
        )}
      </div>

      {/* Current Streak */}
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <Flame className="h-8 w-8 text-orange-500" />
            <span className="text-5xl font-bold text-gray-900">{currentStreak}</span>
          </div>
          <p className="text-gray-500">day streak</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-lg font-bold text-gray-900">{longestStreak}</span>
          </div>
          <p className="text-xs text-gray-500">Longest Streak</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <div className="mb-1 flex items-center justify-center gap-1">
            <Zap className="h-4 w-4 text-indigo-500" />
            <span className="text-lg font-bold text-gray-900">
              {weeklyGoal.current}/{weeklyGoal.target}h
            </span>
          </div>
          <p className="text-xs text-gray-500">Weekly Goal</p>
        </div>
      </div>

      {/* Weekly Goal Progress */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-600">Weekly progress</span>
          <span className="font-medium text-gray-900">
            {Math.round((weeklyGoal.current / weeklyGoal.target) * 100)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
            style={{ width: `${Math.min((weeklyGoal.current / weeklyGoal.target) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Heatmap Calendar */}
      <div>
        <div className="mb-2 flex items-center gap-1">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500">Last 12 weeks</span>
        </div>
        <div className="flex gap-1">
          {heatmapData.map((week) => (
            <div key={week.map((d) => d.date).join('-')} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn('h-3 w-3 rounded-sm', levelColors[day.level])}
                  title={`${day.date}: Level ${day.level}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1">
          <span className="text-xs text-gray-400">Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div key={level} className={cn('h-3 w-3 rounded-sm', levelColors[level])} />
          ))}
          <span className="text-xs text-gray-400">More</span>
        </div>
      </div>

      {/* Milestone Alert */}
      {currentStreak > 0 && currentStreak % 7 === 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-1.5">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-900">🎉 Milestone reached!</p>
              <p className="text-sm text-amber-700">
                {currentStreak} day streak - Amazing consistency!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LearningStreak;
