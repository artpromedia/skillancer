'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileCheck,
  Lightbulb,
  Lock,
  MessageSquare,
  Phone,
  Shield,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  type User,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ImprovementCategory =
  | 'identity'
  | 'skills'
  | 'portfolio'
  | 'social-proof'
  | 'completeness'
  | 'engagement';

export type ImprovementPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ProfileImprovementTip {
  id: string;
  category: ImprovementCategory;
  priority: ImprovementPriority;
  title: string;
  description: string;
  impact: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  completed?: boolean;
  dismissed?: boolean;
  estimatedTime?: string;
  trustScoreImpact?: number;
}

export interface ProfileStrength {
  category: ImprovementCategory;
  label: string;
  score: number;
  maxScore: number;
  tips: ProfileImprovementTip[];
}

export interface ProfileImprovementTipsProps {
  tips: ProfileImprovementTip[];
  profileScore: number;
  maxScore?: number;
  onDismissTip?: (tipId: string) => void;
  onCompleteTip?: (tipId: string) => void;
  className?: string;
}

export interface MissingVerificationAlertProps {
  missingItems: Array<{
    type: 'identity' | 'phone' | 'payment' | 'skill-assessment' | 'portfolio';
    label: string;
    href: string;
  }>;
  onDismiss?: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const categoryConfig: Record<
  ImprovementCategory,
  { label: string; icon: typeof User; color: string; bgColor: string }
> = {
  identity: {
    label: 'Identity',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  skills: {
    label: 'Skills',
    icon: Award,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  portfolio: {
    label: 'Portfolio',
    icon: Briefcase,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  'social-proof': {
    label: 'Social Proof',
    icon: ThumbsUp,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  completeness: {
    label: 'Completeness',
    icon: FileCheck,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  engagement: {
    label: 'Engagement',
    icon: MessageSquare,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
};

const priorityConfig: Record<
  ImprovementPriority,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  high: {
    label: 'High Impact',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  medium: {
    label: 'Recommended',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  low: {
    label: 'Optional',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

// ============================================================================
// Profile Score Indicator
// ============================================================================

function ProfileScoreIndicator({
  score,
  maxScore = 100,
  size = 'default',
}: Readonly<{
  score: number;
  maxScore?: number;
  size?: 'default' | 'large';
}>) {
  const percentage = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-amber-500';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = () => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Needs Work';
  };

  const dimensions = size === 'large' ? 'h-32 w-32' : 'h-24 w-24';
  const textSize = size === 'large' ? 'text-3xl' : 'text-2xl';

  return (
    <div className={cn('relative', dimensions)}>
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          className="text-slate-100"
          cx="50"
          cy="50"
          fill="none"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          className={cn('transition-all duration-500', getScoreColor())}
          cx="50"
          cy="50"
          fill="none"
          r="45"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold', textSize, getScoreColor())}>{score}</span>
        <span className="text-muted-foreground text-xs">{getScoreLabel()}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Improvement Tip Card
// ============================================================================

function ImprovementTipCard({
  tip,
  onDismiss,
  onComplete: _onComplete,
}: Readonly<{
  tip: ProfileImprovementTip;
  onDismiss?: (id: string) => void;
  onComplete?: (id: string) => void;
}>) {
  const categoryInfo = categoryConfig[tip.category];
  const priorityInfo = priorityConfig[tip.priority];
  const CategoryIcon = categoryInfo.icon;

  if (tip.dismissed) return null;

  return (
    <Card
      className={cn(
        'border transition-all',
        tip.completed ? 'border-green-200 bg-green-50/50' : priorityInfo.borderColor,
        priorityInfo.bgColor
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Category Icon */}
          <div className={cn('rounded-lg p-2', categoryInfo.bgColor)}>
            <CategoryIcon className={cn('h-5 w-5', categoryInfo.color)} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h4 className="font-medium">{tip.title}</h4>
              <Badge className={cn(priorityInfo.bgColor, priorityInfo.color)} variant="secondary">
                {priorityInfo.label}
              </Badge>
              {tip.completed && (
                <Badge className="bg-green-100 text-green-700" variant="secondary">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>

            <p className="text-muted-foreground text-sm">{tip.description}</p>

            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center">
                <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
                {tip.impact}
              </span>
              {tip.estimatedTime && (
                <span className="flex items-center">
                  <Clock className="mr-1 h-3 w-3" />
                  {tip.estimatedTime}
                </span>
              )}
              {tip.trustScoreImpact && (
                <span className="flex items-center font-medium text-green-600">
                  <Sparkles className="mr-1 h-3 w-3" />+{tip.trustScoreImpact} Trust Score
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!tip.completed && (
              <>
                {tip.actionHref ? (
                  <Button asChild size="sm">
                    <Link href={tip.actionHref}>
                      {tip.actionLabel}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={tip.onAction}>
                    {tip.actionLabel}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {onDismiss && !tip.completed && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 w-8 p-0"
                      size="sm"
                      variant="ghost"
                      onClick={() => onDismiss(tip.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dismiss this tip</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Category Strength Bar
// ============================================================================

function CategoryStrengthBar({ strength }: Readonly<{ strength: ProfileStrength }>) {
  const config = categoryConfig[strength.category];
  const Icon = config.icon;
  const percentage = (strength.score / strength.maxScore) * 100;
  const incompleteTips = strength.tips.filter((t) => !t.completed && !t.dismissed);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('rounded p-1', config.bgColor)}>
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>
          <span className="text-sm font-medium">{strength.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {strength.score}/{strength.maxScore}
          </span>
          {incompleteTips.length > 0 && (
            <Badge className="text-xs" variant="secondary">
              {incompleteTips.length} tips
            </Badge>
          )}
        </div>
      </div>
      <Progress className="h-2" value={percentage} />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProfileImprovementTips({
  tips,
  profileScore,
  maxScore = 100,
  onDismissTip,
  onCompleteTip,
  className,
}: Readonly<ProfileImprovementTipsProps>) {
  const [showAll, setShowAll] = useState(false);

  // Group tips by category
  const tipsByCategory = tips.reduce(
    (acc, tip) => {
      if (!acc[tip.category]) {
        acc[tip.category] = [];
      }
      acc[tip.category].push(tip);
      return acc;
    },
    {} as Record<ImprovementCategory, ProfileImprovementTip[]>
  );

  // Calculate category strengths
  const categoryStrengths: ProfileStrength[] = Object.entries(categoryConfig).map(
    ([category, config]) => {
      const categoryTips = tipsByCategory[category as ImprovementCategory] || [];
      const completedTips = categoryTips.filter((t) => t.completed);
      const maxScore = categoryTips.length * 10 || 10;
      const score = completedTips.length * 10 || (categoryTips.length === 0 ? maxScore : 0);

      return {
        category: category as ImprovementCategory,
        label: config.label,
        score,
        maxScore,
        tips: categoryTips,
      };
    }
  );

  // Sort tips by priority
  const priorityOrder: ImprovementPriority[] = ['critical', 'high', 'medium', 'low'];
  const sortedTips = [...tips]
    .filter((t) => !t.dismissed)
    .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));

  const displayedTips = showAll ? sortedTips : sortedTips.slice(0, 3);

  // Count critical and high priority incomplete tips
  const urgentTipsCount = tips.filter(
    (t) => !t.completed && !t.dismissed && (t.priority === 'critical' || t.priority === 'high')
  ).length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Profile Improvement Tips
              {urgentTipsCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                  {urgentTipsCount} priority
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Complete these tips to improve your profile visibility and trust score
            </CardDescription>
          </div>
          <ProfileScoreIndicator maxScore={maxScore} score={profileScore} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Strengths Overview */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Profile Strength by Category</h4>
          <div className="space-y-3">
            {categoryStrengths.map((strength) => (
              <CategoryStrengthBar key={strength.category} strength={strength} />
            ))}
          </div>
        </div>

        {/* Tips List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Recommended Actions</h4>
            {sortedTips.length > 3 && (
              <Button
                className="text-xs"
                size="sm"
                variant="ghost"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    Show less
                    <ChevronUp className="ml-1 h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show all ({sortedTips.length})
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {displayedTips.map((tip) => (
              <ImprovementTipCard
                key={tip.id}
                tip={tip}
                onComplete={onCompleteTip}
                onDismiss={onDismissTip}
              />
            ))}
          </div>
        </div>

        {/* Completion CTA */}
        {sortedTips.filter((t) => !t.completed).length === 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-green-800">Great work!</h4>
                <p className="text-sm text-green-700">
                  You&apos;ve completed all profile improvement tips. Your profile is
                  well-optimized.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Missing Verification Alert
// ============================================================================

export function MissingVerificationAlert({
  missingItems,
  onDismiss,
  className,
}: Readonly<MissingVerificationAlertProps>) {
  if (missingItems.length === 0) return null;

  const typeConfig: Record<
    MissingVerificationAlertProps['missingItems'][0]['type'],
    { icon: typeof Shield; color: string }
  > = {
    identity: { icon: Shield, color: 'text-blue-600' },
    phone: { icon: Phone, color: 'text-green-600' },
    payment: { icon: Lock, color: 'text-purple-600' },
    'skill-assessment': { icon: FileCheck, color: 'text-amber-600' },
    portfolio: { icon: Briefcase, color: 'text-teal-600' },
  };

  return (
    <Card className={cn('border-amber-200 bg-amber-50', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-amber-800">Complete Your Verification</h4>
            <p className="text-sm text-amber-700">
              Complete these verifications to increase your trust score and win more projects.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {missingItems.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;

                return (
                  <Link key={item.type} href={item.href}>
                    <Badge
                      className="cursor-pointer gap-1.5 border-amber-300 bg-white transition-colors hover:bg-amber-100"
                      variant="outline"
                    >
                      <Icon className={cn('h-3 w-3', config.color)} />
                      {item.label}
                      <ChevronRight className="h-3 w-3" />
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>

          {onDismiss && (
            <Button
              className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Compact Tips Banner
// ============================================================================

export interface CompactTipsBannerProps {
  nextTip?: ProfileImprovementTip;
  completedCount: number;
  totalCount: number;
  onViewAll: () => void;
  className?: string;
}

export function CompactTipsBanner({
  nextTip,
  completedCount,
  totalCount,
  onViewAll,
  className,
}: Readonly<CompactTipsBannerProps>) {
  if (!nextTip) {
    return (
      <div
        className={cn(
          'flex items-center justify-between rounded-lg bg-green-50 px-4 py-3',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">All profile tips completed!</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onViewAll}>
          View Details
        </Button>
      </div>
    );
  }

  const priorityInfo = priorityConfig[nextTip.priority];

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg px-4 py-3',
        priorityInfo.bgColor,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Zap className={cn('h-5 w-5', priorityInfo.color)} />
          <Badge className="text-xs" variant="secondary">
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-medium">{nextTip.title}</p>
          <p className="text-muted-foreground text-xs">{nextTip.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {nextTip.actionHref ? (
          <Button asChild size="sm">
            <Link href={nextTip.actionHref}>
              {nextTip.actionLabel}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={nextTip.onAction}>
            {nextTip.actionLabel}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onViewAll}>
          All tips
        </Button>
      </div>
    </div>
  );
}
