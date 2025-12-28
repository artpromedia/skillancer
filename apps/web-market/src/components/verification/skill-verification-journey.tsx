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
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  ChevronRight,
  Clock,
  FileCheck,
  Lightbulb,
  Lock,
  PlayCircle,
  Rocket,
  Shield,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export type VerificationTier =
  | 'unverified'
  | 'self-assessed'
  | 'endorsed'
  | 'assessed'
  | 'certified';

export interface SkillVerificationStatus {
  skillId: string;
  skillName: string;
  category: string;
  currentTier: VerificationTier;
  nextTier?: VerificationTier;
  progress: {
    endorsements: {
      current: number;
      required: number;
    };
    assessment?: {
      available: boolean;
      passed: boolean;
      score?: number;
      attemptedAt?: string;
    };
    certification?: {
      available: boolean;
      earned: boolean;
      earnedAt?: string;
      expiresAt?: string;
    };
  };
  recommendations: VerificationRecommendation[];
}

export interface VerificationRecommendation {
  type: 'endorsement' | 'assessment' | 'certification' | 'course';
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  impact: 'high' | 'medium' | 'low';
  estimatedTime?: string;
}

export interface SkillVerificationJourneyProps {
  skill: SkillVerificationStatus;
  onTakeAssessment?: (skillId: string) => void;
  onRequestEndorsement?: (skillId: string) => void;
  onViewCertification?: (skillId: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const tierConfig: Record<
  VerificationTier,
  {
    label: string;
    description: string;
    icon: typeof Shield;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  unverified: {
    label: 'Unverified',
    description: 'Skill added but not yet verified',
    icon: AlertCircle,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
  'self-assessed': {
    label: 'Self-Assessed',
    description: 'You have self-assessed your proficiency',
    icon: Target,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  endorsed: {
    label: 'Endorsed',
    description: 'Verified by peer endorsements',
    icon: ThumbsUp,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  assessed: {
    label: 'Assessed',
    description: 'Passed platform skill assessment',
    icon: FileCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  certified: {
    label: 'Certified',
    description: 'Industry certification verified',
    icon: Award,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
};

const tierOrder: VerificationTier[] = [
  'unverified',
  'self-assessed',
  'endorsed',
  'assessed',
  'certified',
];

// ============================================================================
// Helper Functions
// ============================================================================

function getTierIndex(tier: VerificationTier): number {
  return tierOrder.indexOf(tier);
}

function getProgressPercentage(skill: SkillVerificationStatus): number {
  const tierIndex = getTierIndex(skill.currentTier);
  const baseProgress = (tierIndex / (tierOrder.length - 1)) * 100;

  // Add partial progress toward next tier
  if (skill.nextTier && skill.progress.endorsements) {
    const endorsementProgress =
      (skill.progress.endorsements.current / skill.progress.endorsements.required) * 20;
    return Math.min(100, baseProgress + endorsementProgress);
  }

  return baseProgress;
}

// ============================================================================
// Tier Progress Indicator
// ============================================================================

function TierProgressIndicator({
  currentTier,
  compact = false,
}: Readonly<{
  currentTier: VerificationTier;
  compact?: boolean;
}>) {
  const currentIndex = getTierIndex(currentTier);

  return (
    <div className={cn('flex items-center gap-1', compact && 'gap-0.5')}>
      {tierOrder.map((tier, index) => {
        const config = tierConfig[tier];
        const Icon = config.icon;
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <TooltipProvider key={tier}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full transition-all',
                      compact ? 'h-6 w-6' : 'h-8 w-8',
                      isCompleted ? config.bgColor : 'bg-slate-100',
                      isCurrent && `ring-2 ${config.borderColor} ring-offset-1`
                    )}
                  >
                    {isCompleted ? (
                      <Icon className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', config.color)} />
                    ) : (
                      <Lock className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', 'text-slate-400')} />
                    )}
                  </div>
                  {index < tierOrder.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5',
                        compact ? 'w-2' : 'w-4',
                        index < currentIndex ? 'bg-green-400' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{config.label}</p>
                <p className="text-muted-foreground text-xs">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ============================================================================
// Recommendation Card
// ============================================================================

function RecommendationCard({
  recommendation,
  onAction,
}: Readonly<{
  recommendation: VerificationRecommendation;
  onAction?: () => void;
}>) {
  const impactColors = {
    high: 'border-green-200 bg-green-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-slate-200 bg-slate-50',
  };

  const impactBadges = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-700',
  };

  const typeIcons = {
    endorsement: Users,
    assessment: FileCheck,
    certification: Award,
    course: BookOpen,
  };

  const Icon = typeIcons[recommendation.type];

  return (
    <Card className={cn('border', impactColors[recommendation.impact])}>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            recommendation.impact === 'high' && 'bg-green-100',
            recommendation.impact === 'medium' && 'bg-amber-100',
            recommendation.impact === 'low' && 'bg-slate-100'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              recommendation.impact === 'high' && 'text-green-600',
              recommendation.impact === 'medium' && 'text-amber-600',
              recommendation.impact === 'low' && 'text-slate-600'
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="font-medium">{recommendation.title}</p>
            <Badge className={impactBadges[recommendation.impact]} variant="secondary">
              {recommendation.impact} impact
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{recommendation.description}</p>
          {recommendation.estimatedTime && (
            <p className="text-muted-foreground mt-1 flex items-center text-xs">
              <Clock className="mr-1 h-3 w-3" />
              {recommendation.estimatedTime}
            </p>
          )}
        </div>
        <Button
          asChild={!!recommendation.actionHref}
          className="shrink-0"
          size="sm"
          variant="outline"
          onClick={onAction}
        >
          {recommendation.actionHref ? (
            <Link href={recommendation.actionHref}>
              {recommendation.actionLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <>
              {recommendation.actionLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Journey Component
// ============================================================================

// Helper function to render assessment status
function renderAssessmentStatus(assessment?: {
  available: boolean;
  passed: boolean;
  score?: number;
}): React.ReactNode {
  if (assessment?.passed) {
    return (
      <>
        <p className="text-lg font-semibold text-green-600">{assessment.score}%</p>
        <p className="text-muted-foreground text-xs">Assessment Score</p>
      </>
    );
  }
  if (assessment?.available) {
    return (
      <>
        <p className="font-medium">Available</p>
        <p className="text-muted-foreground text-xs">Take Assessment</p>
      </>
    );
  }
  return (
    <>
      <p className="text-muted-foreground">Locked</p>
      <p className="text-muted-foreground text-xs">Assessment</p>
    </>
  );
}

// Helper function to render certification status
function renderCertificationStatus(certification?: {
  available: boolean;
  earned: boolean;
}): React.ReactNode {
  if (certification?.earned) {
    return (
      <>
        <p className="font-medium text-amber-600">Certified</p>
        <p className="text-muted-foreground text-xs">View Certificate</p>
      </>
    );
  }
  if (certification?.available) {
    return (
      <>
        <p className="font-medium">Available</p>
        <p className="text-muted-foreground text-xs">Get Certified</p>
      </>
    );
  }
  return (
    <>
      <p className="text-muted-foreground">Locked</p>
      <p className="text-muted-foreground text-xs">Certification</p>
    </>
  );
}

export function SkillVerificationJourney({
  skill,
  onTakeAssessment,
  onRequestEndorsement,
  onViewCertification,
  className,
}: Readonly<SkillVerificationJourneyProps>) {
  const currentConfig = tierConfig[skill.currentTier];
  const CurrentIcon = currentConfig.icon;
  const progress = getProgressPercentage(skill);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {skill.skillName}
              <Badge className={cn(currentConfig.bgColor, currentConfig.color)} variant="secondary">
                <CurrentIcon className="mr-1 h-3 w-3" />
                {currentConfig.label}
              </Badge>
            </CardTitle>
            <CardDescription>{skill.category}</CardDescription>
          </div>
          <TierProgressIndicator currentTier={skill.currentTier} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verification Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress className="h-2" value={progress} />
        </div>

        {/* Current Status Details */}
        <div className="rounded-lg bg-slate-50 p-4">
          <h4 className="mb-3 font-medium">Current Status</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Endorsements */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {skill.progress.endorsements.current}/{skill.progress.endorsements.required}
                </p>
                <p className="text-muted-foreground text-xs">Endorsements</p>
              </div>
            </div>

            {/* Assessment */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  skill.progress.assessment?.passed ? 'bg-green-100' : 'bg-slate-100'
                )}
              >
                <FileCheck
                  className={cn(
                    'h-5 w-5',
                    skill.progress.assessment?.passed ? 'text-green-600' : 'text-slate-400'
                  )}
                />
              </div>
              <div>{renderAssessmentStatus(skill.progress.assessment)}</div>
            </div>

            {/* Certification */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  skill.progress.certification?.earned ? 'bg-amber-100' : 'bg-slate-100'
                )}
              >
                <Award
                  className={cn(
                    'h-5 w-5',
                    skill.progress.certification?.earned ? 'text-amber-600' : 'text-slate-400'
                  )}
                />
              </div>
              <div>{renderCertificationStatus(skill.progress.certification)}</div>
            </div>
          </div>
        </div>

        {/* Next Steps / Recommendations */}
        {skill.recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-medium">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Recommended Next Steps
            </h4>
            <div className="space-y-3">
              {skill.recommendations.map((rec) => (
                <RecommendationCard
                  key={`${rec.type}-${rec.title}`}
                  recommendation={rec}
                  onAction={() => {
                    if (rec.type === 'assessment' && onTakeAssessment) {
                      onTakeAssessment(skill.skillId);
                    } else if (rec.type === 'endorsement' && onRequestEndorsement) {
                      onRequestEndorsement(skill.skillId);
                    } else if (rec.type === 'certification' && onViewCertification) {
                      onViewCertification(skill.skillId);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {skill.progress.assessment?.available && !skill.progress.assessment?.passed && (
            <Button className="gap-2" onClick={() => onTakeAssessment?.(skill.skillId)}>
              <PlayCircle className="h-4 w-4" />
              Take Assessment
            </Button>
          )}
          <Button
            className="gap-2"
            variant="outline"
            onClick={() => onRequestEndorsement?.(skill.skillId)}
          >
            <Users className="h-4 w-4" />
            Get Endorsed
          </Button>
          {skill.progress.certification?.earned && (
            <Button
              className="gap-2"
              variant="outline"
              onClick={() => onViewCertification?.(skill.skillId)}
            >
              <Award className="h-4 w-4" />
              View Certificate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Verification CTA Component
// ============================================================================

export interface VerificationCTAProps {
  skill: {
    id: string;
    name: string;
    currentTier: VerificationTier;
    endorsementCount: number;
    assessmentAvailable: boolean;
  };
  variant?: 'banner' | 'card' | 'inline';
  onAction?: (action: 'assess' | 'endorse' | 'certify', skillId: string) => void;
  className?: string;
}

export function VerificationCTA({
  skill,
  variant = 'card',
  onAction,
  className,
}: Readonly<VerificationCTAProps>) {
  const tierIndex = getTierIndex(skill.currentTier);
  const config = tierConfig[skill.currentTier];

  // Determine the best next action
  let nextAction: { type: 'assess' | 'endorse' | 'certify'; label: string; description: string };

  if (skill.assessmentAvailable && tierIndex < getTierIndex('assessed')) {
    nextAction = {
      type: 'assess',
      label: 'Take Assessment',
      description: `Prove your ${skill.name} expertise and earn the Assessed badge`,
    };
  } else if (skill.endorsementCount < 3) {
    nextAction = {
      type: 'endorse',
      label: 'Get Endorsed',
      description: `Ask ${3 - skill.endorsementCount} more people to endorse your ${skill.name} skills`,
    };
  } else {
    nextAction = {
      type: 'certify',
      label: 'Get Certified',
      description: `Upload industry certifications to reach the highest verification tier`,
    };
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Badge className={cn(config.bgColor, config.color)} variant="secondary">
          {config.label}
        </Badge>
        <Button size="sm" variant="outline" onClick={() => onAction?.(nextAction.type, skill.id)}>
          <Zap className="mr-1.5 h-3 w-3" />
          {nextAction.label}
        </Button>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex items-center justify-between rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 p-4',
          className
        )}
      >
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-white p-2 shadow-sm">
            <Rocket className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold">Level up your {skill.name} verification</p>
            <p className="text-muted-foreground text-sm">{nextAction.description}</p>
          </div>
        </div>
        <Button onClick={() => onAction?.(nextAction.type, skill.id)}>
          {nextAction.label}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('rounded-full p-3', config.bgColor)}>
          <TrendingUp className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">Boost your {skill.name} credibility</p>
            <Badge className={cn(config.bgColor, config.color)} variant="secondary">
              Currently: {config.label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{nextAction.description}</p>
        </div>
        <Button onClick={() => onAction?.(nextAction.type, skill.id)}>{nextAction.label}</Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Multi-Skill Verification Overview
// ============================================================================

export interface VerificationOverviewProps {
  skills: Array<{
    id: string;
    name: string;
    currentTier: VerificationTier;
    progress: number;
  }>;
  onSkillClick?: (skillId: string) => void;
  onImproveClick?: () => void;
  className?: string;
}

export function VerificationOverview({
  skills,
  onSkillClick,
  onImproveClick,
  className,
}: Readonly<VerificationOverviewProps>) {
  // Calculate overall stats
  const tierCounts = skills.reduce(
    (acc, skill) => {
      acc[skill.currentTier] = (acc[skill.currentTier] || 0) + 1;
      return acc;
    },
    {} as Record<VerificationTier, number>
  );

  const verifiedCount = skills.filter(
    (s) => getTierIndex(s.currentTier) >= getTierIndex('endorsed')
  ).length;

  const averageProgress = skills.reduce((sum, s) => sum + s.progress, 0) / skills.length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Skill Verification Overview
        </CardTitle>
        <CardDescription>Track and improve your skill verification levels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700">{verifiedCount}</p>
            <p className="text-muted-foreground text-xs">Verified Skills</p>
          </div>
          <div className="border-l border-r text-center">
            <p className="text-2xl font-bold text-blue-700">{skills.length}</p>
            <p className="text-muted-foreground text-xs">Total Skills</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-700">{Math.round(averageProgress)}%</p>
            <p className="text-muted-foreground text-xs">Avg. Progress</p>
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Verification Distribution</p>
          <div className="flex gap-1">
            {tierOrder.map((tier) => {
              const count = tierCounts[tier] || 0;
              const percentage = (count / skills.length) * 100;
              const config = tierConfig[tier];

              return (
                <TooltipProvider key={tier}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn('h-3 rounded-full', config.bgColor)}
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {config.label}: {count} skill{count === 1 ? '' : 's'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Skills List */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Your Skills</p>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {skills.map((skill) => {
              const config = tierConfig[skill.currentTier];
              const Icon = config.icon;

              return (
                <button
                  key={skill.id}
                  className="flex w-full items-center justify-between rounded-lg border bg-white p-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => onSkillClick?.(skill.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('rounded-full p-1.5', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div>
                      <p className="font-medium">{skill.name}</p>
                      <p className="text-muted-foreground text-xs">{config.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress className="h-1.5 w-16" value={skill.progress} />
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        {onImproveClick && (
          <Button className="w-full" onClick={onImproveClick}>
            <Sparkles className="mr-2 h-4 w-4" />
            Improve Verification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
