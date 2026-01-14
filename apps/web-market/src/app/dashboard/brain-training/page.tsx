/**
 * Brain Training Dashboard
 *
 * Cognitive training module for improving:
 * - Memory
 * - Attention
 * - Problem Solving
 * - Processing Speed
 */

'use client';

import {
  Brain,
  Target,
  Puzzle,
  Zap,
  BookOpen,
  RefreshCw,
  Map,
  Flame,
  Trophy,
  Clock,
  Play,
  TrendingUp,
  Calendar,
  Award,
  Star,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface Category {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  level: number;
  xp: number;
  exerciseCount: number;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  isPremium: boolean;
}

interface ProgressStats {
  level: number;
  xp: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  todayMinutes: number;
  weekSessions: number;
  dailyGoal: number;
  weeklyGoal: number;
}

// =============================================================================
// Mock Data
// =============================================================================

const categories: Category[] = [
  {
    id: 'MEMORY',
    name: 'Memory',
    description: 'Improve working memory and recall',
    icon: <Brain className="h-6 w-6" />,
    color: '#8B5CF6',
    level: 3,
    xp: 450,
    exerciseCount: 8,
  },
  {
    id: 'ATTENTION',
    name: 'Attention',
    description: 'Enhance focus and concentration',
    icon: <Target className="h-6 w-6" />,
    color: '#3B82F6',
    level: 2,
    xp: 280,
    exerciseCount: 6,
  },
  {
    id: 'PROBLEM_SOLVING',
    name: 'Problem Solving',
    description: 'Develop logical reasoning',
    icon: <Puzzle className="h-6 w-6" />,
    color: '#10B981',
    level: 4,
    xp: 620,
    exerciseCount: 7,
  },
  {
    id: 'SPEED',
    name: 'Speed',
    description: 'Boost processing speed',
    icon: <Zap className="h-6 w-6" />,
    color: '#EF4444',
    level: 2,
    xp: 190,
    exerciseCount: 5,
  },
  {
    id: 'LANGUAGE',
    name: 'Language',
    description: 'Expand vocabulary',
    icon: <BookOpen className="h-6 w-6" />,
    color: '#EC4899',
    level: 3,
    xp: 380,
    exerciseCount: 6,
  },
  {
    id: 'FLEXIBILITY',
    name: 'Flexibility',
    description: 'Improve adaptability',
    icon: <RefreshCw className="h-6 w-6" />,
    color: '#F59E0B',
    level: 1,
    xp: 95,
    exerciseCount: 4,
  },
  {
    id: 'PLANNING',
    name: 'Planning',
    description: 'Strengthen organization',
    icon: <Map className="h-6 w-6" />,
    color: '#6366F1',
    level: 2,
    xp: 220,
    exerciseCount: 5,
  },
];

const featuredExercises: Exercise[] = [
  {
    id: '1',
    name: 'Memory Matrix',
    category: 'MEMORY',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 5,
    isPremium: false,
  },
  {
    id: '2',
    name: 'Dual N-Back',
    category: 'MEMORY',
    difficulty: 'ADVANCED',
    estimatedMinutes: 10,
    isPremium: false,
  },
  {
    id: '3',
    name: 'Focus Flow',
    category: 'ATTENTION',
    difficulty: 'BEGINNER',
    estimatedMinutes: 5,
    isPremium: false,
  },
  {
    id: '4',
    name: 'Logic Puzzles',
    category: 'PROBLEM_SOLVING',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 8,
    isPremium: false,
  },
];

const mockProgress: ProgressStats = {
  level: 7,
  xp: 2450,
  totalSessions: 48,
  currentStreak: 5,
  longestStreak: 12,
  todayMinutes: 8,
  weekSessions: 4,
  dailyGoal: 10,
  weeklyGoal: 5,
};

const achievements = [
  { id: '1', name: 'First Steps', icon: Star, earned: true },
  { id: '2', name: 'Week Warrior', icon: Calendar, earned: true },
  { id: '3', name: 'Memory Master', icon: Brain, earned: false },
  { id: '4', name: 'Speed Demon', icon: Zap, earned: true },
];

// =============================================================================
// Components
// =============================================================================

function ProgressCard({ progress }: { progress: ProgressStats }) {
  const xpToNextLevel = (progress.level * 100) - (progress.xp % 100);
  const xpProgress = ((progress.xp % 100) / 100) * 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Level {progress.level}
          </h2>
          <p className="text-sm text-gray-500">{progress.xp} XP total</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 dark:bg-orange-900/30">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {progress.currentStreak} day streak
          </span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Progress to Level {progress.level + 1}</span>
          <span className="text-gray-900 dark:text-white">{xpToNextLevel} XP to go</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>

      {/* Daily/Weekly Goals */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Today</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {progress.todayMinutes}
            </span>
            <span className="text-sm text-gray-500">/ {progress.dailyGoal} min</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${Math.min(100, (progress.todayMinutes / progress.dailyGoal) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">This Week</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {progress.weekSessions}
            </span>
            <span className="text-sm text-gray-500">/ {progress.weeklyGoal} sessions</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${Math.min(100, (progress.weekSessions / progress.weeklyGoal) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const levelProgress = (category.xp % 100);

  return (
    <div className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          {category.icon}
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          Lvl {category.level}
        </span>
      </div>

      <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{category.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{category.description}</p>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${levelProgress}%`, backgroundColor: category.color }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>{category.xp} XP</span>
          <span>{category.exerciseCount} exercises</span>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const categoryInfo = categories.find((c) => c.id === exercise.category);

  const difficultyColors = {
    BEGINNER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    INTERMEDIATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ADVANCED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    EXPERT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${categoryInfo?.color}20`, color: categoryInfo?.color }}
        >
          {categoryInfo?.icon}
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{exercise.name}</h4>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs ${difficultyColors[exercise.difficulty as keyof typeof difficultyColors]}`}>
              {exercise.difficulty}
            </span>
            <span className="text-xs text-gray-500">{exercise.estimatedMinutes} min</span>
          </div>
        </div>
      </div>
      <button className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700">
        <Play className="h-5 w-5" />
      </button>
    </div>
  );
}

function AchievementsSection() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Achievements</h3>
        <Trophy className="h-5 w-5 text-yellow-500" />
      </div>
      <div className="mt-4 flex gap-3">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <div
              key={achievement.id}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                achievement.earned
                  ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
              }`}
              title={achievement.name}
            >
              <Icon className="h-6 w-6" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickStats({ progress }: { progress: ProgressStats }) {
  const stats = [
    { label: 'Total Sessions', value: progress.totalSessions, icon: TrendingUp },
    { label: 'Best Streak', value: `${progress.longestStreak} days`, icon: Flame },
    { label: 'Total XP', value: progress.xp.toLocaleString(), icon: Award },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800"
          >
            <Icon className="mx-auto h-5 w-5 text-gray-400" />
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function BrainTrainingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brain Training</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Exercise your mind with daily cognitive training
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
          <Play className="h-5 w-5" />
          Start Daily Workout
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Progress & Stats */}
        <div className="space-y-6 lg:col-span-2">
          <ProgressCard progress={mockProgress} />
          <QuickStats progress={mockProgress} />

          {/* Categories */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Training Categories
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Exercises & Achievements */}
        <div className="space-y-6">
          <AchievementsSection />

          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Quick Start</h3>
            <p className="mt-1 text-sm text-gray-500">Jump into these exercises</p>
            <div className="mt-4 space-y-3">
              {featuredExercises.map((exercise) => (
                <ExerciseCard key={exercise.id} exercise={exercise} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
