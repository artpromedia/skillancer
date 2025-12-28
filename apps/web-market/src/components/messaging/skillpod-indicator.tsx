/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
'use client';

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  BookOpen,
  Brain,
  Clock,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Monitor,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface SkillPodProgress {
  skillId: string;
  skillName: string;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  progressPercent: number;
  hoursLogged: number;
  projectsCompleted: number;
  lastActivity?: string;
}

type SkillPodIndicatorProps = Readonly<{
  contractId?: string;
  skills?: SkillPodProgress[];
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  sessionId?: string;
  sessionStatus?: 'active' | 'inactive' | 'pending';
  onLaunchVdi?: () => void;
}>;

// ============================================================================
// Level Config
// ============================================================================

const LEVEL_CONFIG = {
  BEGINNER: {
    label: 'Beginner',
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/50',
    icon: BookOpen,
    minHours: 0,
  },
  INTERMEDIATE: {
    label: 'Intermediate',
    color: 'text-green-600 bg-green-100 dark:bg-green-950/50',
    icon: TrendingUp,
    minHours: 50,
  },
  ADVANCED: {
    label: 'Advanced',
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-950/50',
    icon: Target,
    minHours: 200,
  },
  EXPERT: {
    label: 'Expert',
    color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/50',
    icon: Star,
    minHours: 500,
  },
};

// ============================================================================
// Skill Card
// ============================================================================

type SkillCardProps = Readonly<{
  skill: SkillPodProgress;
}>;

function SkillCard({ skill }: SkillCardProps) {
  const levelConfig = LEVEL_CONFIG[skill.level];
  const LevelIcon = levelConfig.icon;

  const nextLevel = getNextLevel(skill.level);
  const hoursToNext = nextLevel ? LEVEL_CONFIG[nextLevel].minHours - skill.hoursLogged : 0;

  return (
    <div className="rounded-lg border p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{skill.skillName}</h4>
          <p className="text-muted-foreground text-sm">{skill.category}</p>
        </div>
        <Badge className={levelConfig.color}>
          <LevelIcon className="mr-1 h-3 w-3" />
          {levelConfig.label}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Level Progress</span>
          <span className="font-medium">{skill.progressPercent}%</span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${skill.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="text-muted-foreground h-4 w-4" />
          <div>
            <p className="font-medium">{skill.hoursLogged}h</p>
            <p className="text-muted-foreground text-xs">Logged</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Target className="text-muted-foreground h-4 w-4" />
          <div>
            <p className="font-medium">{skill.projectsCompleted}</p>
            <p className="text-muted-foreground text-xs">Projects</p>
          </div>
        </div>
      </div>

      {/* Next Level */}
      {nextLevel && hoursToNext > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm dark:bg-amber-950/20">
          <Zap className="h-4 w-4 text-amber-600" />
          <span className="text-muted-foreground">
            {hoursToNext}h until{' '}
            <span className="font-medium">{LEVEL_CONFIG[nextLevel].label}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function getNextLevel(current: SkillPodProgress['level']): SkillPodProgress['level'] | null {
  const levels: SkillPodProgress['level'][] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
  const currentIndex = levels.indexOf(current);
  return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
}

// ============================================================================
// SkillPod Info Modal
// ============================================================================

type SkillPodInfoModalProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: SkillPodProgress[];
}>;

function SkillPodInfoModal({ open, onOpenChange, skills }: SkillPodInfoModalProps) {
  const totalHours = skills.reduce((sum, s) => sum + s.hoursLogged, 0);
  const totalProjects = skills.reduce((sum, s) => sum + s.projectsCompleted, 0);
  const avgProgress = skills.length
    ? Math.round(skills.reduce((sum, s) => sum + s.progressPercent, 0) / skills.length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            SkillPod Progress
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* What is SkillPod */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <Brain className="mt-0.5 h-5 w-5 text-blue-600" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">What is SkillPod?</p>
                <p className="text-muted-foreground mt-1">
                  SkillPod tracks your professional growth by analyzing your work on contracts. As
                  you complete projects, your verified skill levels increase, building a credible
                  portfolio that clients trust.
                </p>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Clock className="text-primary mx-auto h-6 w-6" />
              <p className="mt-1 text-2xl font-bold">{totalHours}</p>
              <p className="text-muted-foreground text-sm">Hours Logged</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <Target className="text-primary mx-auto h-6 w-6" />
              <p className="mt-1 text-2xl font-bold">{totalProjects}</p>
              <p className="text-muted-foreground text-sm">Projects</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <TrendingUp className="text-primary mx-auto h-6 w-6" />
              <p className="mt-1 text-2xl font-bold">{avgProgress}%</p>
              <p className="text-muted-foreground text-sm">Avg Progress</p>
            </div>
          </div>

          {/* Skills List */}
          {skills.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Skills Being Developed</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {skills.map((skill) => (
                  <SkillCard key={skill.skillId} skill={skill} />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <GraduationCap className="text-muted-foreground mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-2">No skills tracked for this contract yet</p>
              <p className="text-muted-foreground text-sm">
                Skills will be tracked based on contract work
              </p>
            </div>
          )}

          {/* Tips */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <h4 className="font-medium">Tips to Level Up Faster</h4>
            </div>
            <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
              <li>• Complete contracts to earn verified skill hours</li>
              <li>• Get positive client reviews to boost credibility</li>
              <li>• Work on diverse projects within your skill area</li>
              <li>• Maintain consistent work quality across contracts</li>
            </ul>
          </div>

          {/* View Full Profile */}
          <div className="flex justify-between gap-2">
            <Button asChild variant="outline">
              <a href="/dashboard/skillpod" target="_blank">
                View Full SkillPod Profile
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// VDI Session Button
// ============================================================================

type VdiSessionButtonProps = Readonly<{
  sessionId?: string;
  sessionStatus?: 'active' | 'inactive' | 'pending';
  onLaunch?: () => void;
  size?: 'sm' | 'md' | 'lg';
}>;

function getSessionStatusTooltip(sessionStatus?: 'active' | 'inactive' | 'pending'): string {
  if (sessionStatus === 'active') {
    return 'Click to join the active secure workspace';
  }
  if (sessionStatus === 'pending') {
    return 'Workspace is starting up...';
  }
  return 'Launch a secure development environment';
}

function VdiSessionButton({
  sessionId,
  sessionStatus,
  onLaunch,
  size = 'md',
}: VdiSessionButtonProps) {
  const sizeClasses = {
    sm: 'h-6 text-xs px-2',
    md: 'h-8 text-sm px-3',
    lg: 'h-10 px-4',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  if (!sessionId && !onLaunch) return null;

  const statusColors = {
    active: 'bg-green-500',
    pending: 'bg-yellow-500 animate-pulse',
    inactive: 'bg-gray-400',
  };

  const handleClick = () => {
    if (sessionId && sessionStatus === 'active') {
      // Navigate to VDI viewer
      window.open(`/viewer/${sessionId}`, '_blank');
    } else if (onLaunch) {
      onLaunch();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn(
              'gap-1.5 rounded-full',
              sessionStatus === 'active'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
              sizeClasses[size]
            )}
            onClick={handleClick}
          >
            <div className="relative">
              <Monitor className={iconSizes[size]} />
              {sessionStatus && (
                <div
                  className={cn(
                    'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
                    statusColors[sessionStatus]
                  )}
                />
              )}
            </div>
            <span className="font-medium">
              {sessionStatus === 'active' ? 'Join Session' : 'Launch VDI'}
            </span>
            {sessionStatus === 'active' && <Play className={cn(iconSizes[size], 'ml-0.5')} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getSessionStatusTooltip(sessionStatus)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SkillPodIndicator({
  contractId,
  skills = [],
  size = 'md',
  showDetails = true,
  sessionId,
  sessionStatus,
  onLaunchVdi,
}: SkillPodIndicatorProps) {
  const [showModal, setShowModal] = useState(false);

  const sizeClasses = {
    sm: 'h-6 text-xs px-2',
    md: 'h-8 text-sm px-3',
    lg: 'h-10 px-4',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const activeSkills = skills.filter((s) => s.progressPercent > 0);

  if (!showDetails) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white',
                  sizeClasses[size]
                )}
              >
                <Sparkles className={iconSizes[size]} />
                <span className="font-medium">SkillPod</span>
                {activeSkills.length > 0 && (
                  <Badge className="ml-1 h-4 min-w-[16px] bg-white/20 px-1 text-[10px]">
                    {activeSkills.length}
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {activeSkills.length > 0
                  ? `${activeSkills.length} skills being tracked`
                  : 'SkillPod: Track your professional growth'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <VdiSessionButton
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          size={size}
          onLaunch={onLaunchVdi}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          className={cn(
            'gap-1 rounded-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20',
            sizeClasses[size]
          )}
          variant="ghost"
          onClick={() => setShowModal(true)}
        >
          <Sparkles className={cn(iconSizes[size], 'text-purple-500')} />
          <span className="font-medium">SkillPod</span>
          {activeSkills.length > 0 && (
            <Badge
              className="ml-1 h-4 min-w-[16px] bg-purple-100 px-1 text-[10px] text-purple-600 dark:bg-purple-950 dark:text-purple-300"
              variant="secondary"
            >
              {activeSkills.length}
            </Badge>
          )}
        </Button>
        <VdiSessionButton
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          size={size}
          onLaunch={onLaunchVdi}
        />
      </div>

      <SkillPodInfoModal open={showModal} skills={skills} onOpenChange={setShowModal} />
    </>
  );
}
