'use client';

import { cn } from '@skillancer/ui';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';

interface SkillConfidenceMeterProps {
  skill: string;
  confidence: number; // 0-100
  verified?: boolean;
  trend?: 'up' | 'down' | 'stable';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SkillConfidenceMeter({
  skill,
  confidence,
  verified = false,
  trend,
  showLabel = true,
  size = 'md',
  className,
}: Readonly<SkillConfidenceMeterProps>) {
  const getConfidenceColor = (value: number) => {
    if (value >= 90) return 'bg-green-500';
    if (value >= 70) return 'bg-emerald-500';
    if (value >= 50) return 'bg-yellow-500';
    if (value >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (value: number) => {
    if (value >= 90) return 'Expert';
    if (value >= 70) return 'Proficient';
    if (value >= 50) return 'Intermediate';
    if (value >= 30) return 'Beginner';
    return 'Learning';
  };

  const sizes = {
    sm: { bar: 'h-1.5', text: 'text-xs' },
    md: { bar: 'h-2', text: 'text-sm' },
    lg: { bar: 'h-3', text: 'text-base' },
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | undefined) => {
    if (trend === 'up') return TrendingUp;
    if (trend === 'down') return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon(trend);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium text-gray-900', sizes[size].text)}>{skill}</span>
          {verified && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
              ✓ Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trend && (
            <TrendIcon
              className={cn(
                'h-3 w-3',
                trend === 'up' && 'text-green-500',
                trend === 'down' && 'text-red-500',
                trend === 'stable' && 'text-gray-400'
              )}
            />
          )}
          <span className={cn('text-gray-500', sizes[size].text)}>{confidence}%</span>
        </div>
      </div>

      <div className={cn('overflow-hidden rounded-full bg-gray-100', sizes[size].bar)}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            getConfidenceColor(confidence)
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>

      {showLabel && (
        <p className={cn('text-gray-500', sizes[size].text)}>{getConfidenceLabel(confidence)}</p>
      )}
    </div>
  );
}

// Circular confidence indicator
export function SkillConfidenceRing({
  skill,
  confidence,
  verified = false,
  size = 'md',
  showPercentage = true,
  className,
}: Readonly<{
  skill: string;
  confidence: number;
  verified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}>) {
  const sizes = {
    sm: { ring: 60, stroke: 4, font: 'text-xs' },
    md: { ring: 80, stroke: 6, font: 'text-sm' },
    lg: { ring: 120, stroke: 8, font: 'text-lg' },
  };

  const { ring, stroke, font } = sizes[size];
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (confidence / 100) * circumference;

  const getColor = (value: number) => {
    if (value >= 90) return '#22c55e';
    if (value >= 70) return '#10b981';
    if (value >= 50) return '#eab308';
    if (value >= 30) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative">
        <svg className="-rotate-90" height={ring} width={ring}>
          <circle
            cx={ring / 2}
            cy={ring / 2}
            fill="none"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={stroke}
          />
          <circle
            className="transition-all duration-700"
            cx={ring / 2}
            cy={ring / 2}
            fill="none"
            r={radius}
            stroke={getColor(confidence)}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth={stroke}
          />
        </svg>
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-semibold text-gray-900', font)}>{confidence}%</span>
          </div>
        )}
        {verified && (
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
            <span className="text-xs text-white">✓</span>
          </div>
        )}
      </div>
      <span className={cn('text-center font-medium text-gray-700', font)}>{skill}</span>
    </div>
  );
}

// Multi-skill confidence chart
export function SkillConfidenceChart({
  skills,
  className,
}: Readonly<{
  skills: Array<{
    name: string;
    confidence: number;
    verified?: boolean;
  }>;
  className?: string;
}>) {
  return (
    <div className={cn('space-y-3', className)}>
      {skills.map((skill) => (
        <SkillConfidenceMeter
          key={skill.name}
          confidence={skill.confidence}
          showLabel={false}
          size="sm"
          skill={skill.name}
          verified={skill.verified}
        />
      ))}
    </div>
  );
}

// Skill confidence radar/spider chart (simplified bar version)
export function SkillConfidenceRadar({
  skills,
  className,
}: Readonly<{
  skills: Array<{
    name: string;
    confidence: number;
    verified?: boolean;
  }>;
  className?: string;
}>) {
  return (
    <div className={cn('rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-6', className)}>
      <div className="flex flex-wrap justify-center gap-6">
        {skills.map((skill) => (
          <SkillConfidenceRing
            key={skill.name}
            confidence={skill.confidence}
            size="sm"
            skill={skill.name}
            verified={skill.verified}
          />
        ))}
      </div>
    </div>
  );
}

// Compact skill badge with confidence
export function SkillConfidenceBadge({
  skill,
  confidence,
  verified = false,
  className,
}: Readonly<{
  skill: string;
  confidence: number;
  verified?: boolean;
  className?: string;
}>) {
  const getColor = (value: number) => {
    if (value >= 90) return 'bg-green-100 text-green-700 border-green-200';
    if (value >= 70) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (value >= 50) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (value >= 30) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
        getColor(confidence),
        className
      )}
    >
      <span className="text-sm font-medium">{skill}</span>
      <span className="text-xs opacity-80">{confidence}%</span>
      {verified && <span className="text-green-600">✓</span>}
    </div>
  );
}

// Overall profile confidence summary
export function SkillConfidenceSummary({
  totalSkills,
  verifiedSkills,
  averageConfidence,
  topSkills,
  className,
}: Readonly<{
  totalSkills: number;
  verifiedSkills: number;
  averageConfidence: number;
  topSkills: Array<{ name: string; confidence: number }>;
  className?: string;
}>) {
  const verificationRate = Math.round((verifiedSkills / totalSkills) * 100);

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-6', className)}>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="font-semibold text-gray-900">Skill Confidence</h3>
        <button className="text-gray-400 hover:text-gray-600">
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{totalSkills}</p>
          <p className="text-xs text-gray-500">Total Skills</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{verifiedSkills}</p>
          <p className="text-xs text-gray-500">Verified</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600">{averageConfidence}%</p>
          <p className="text-xs text-gray-500">Avg Score</p>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Verification Progress</span>
          <span className="text-gray-700">{verificationRate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${verificationRate}%` }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-gray-500">Top Skills</p>
        <div className="flex flex-wrap gap-2">
          {topSkills.map((skill) => (
            <SkillConfidenceBadge
              key={skill.name}
              verified
              confidence={skill.confidence}
              skill={skill.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SkillConfidenceMeter;
