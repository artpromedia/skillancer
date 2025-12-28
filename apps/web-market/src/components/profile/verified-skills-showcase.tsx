'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Shield,
  Star,
  ThumbsUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type VerificationTier = 'unverified' | 'self-assessed' | 'endorsed' | 'assessed' | 'certified';

interface VerifiedSkill {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: number; // 1-5
  yearsOfExperience: number;
  verificationTier: VerificationTier;
  assessmentScore?: number;
  endorsementCount: number;
  credentialId?: string;
  isPrimary?: boolean;
}

interface VerifiedSkillsShowcaseProps {
  skills: VerifiedSkill[];
  isOwnProfile?: boolean;
  maxPrimarySkills?: number;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const tierConfig: Record<
  VerificationTier,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Shield;
    description: string;
  }
> = {
  unverified: {
    label: 'Unverified',
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: Shield,
    description: 'Skill has not been verified yet',
  },
  'self-assessed': {
    label: 'Self-Assessed',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    icon: Star,
    description: 'Freelancer has self-assessed this skill',
  },
  endorsed: {
    label: 'Endorsed',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    icon: ThumbsUp,
    description: 'Skill has been endorsed by peers or clients',
  },
  assessed: {
    label: 'Assessed',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-400',
    icon: BadgeCheck,
    description: 'Skill verified through assessment',
  },
  certified: {
    label: 'Certified',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    icon: Award,
    description: 'Skill certified with official credential',
  },
};

const proficiencyLabels = ['Beginner', 'Intermediate', 'Proficient', 'Advanced', 'Expert'];

function getProficiencyLabel(level: number): string {
  return proficiencyLabels[Math.min(level - 1, 4)] || 'Unknown';
}

function getProficiencyColor(level: number): string {
  const colors = ['bg-gray-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-amber-400'];
  return colors[Math.min(level - 1, 4)] || 'bg-gray-400';
}

// ============================================================================
// Skill Card Component
// ============================================================================

function VerifiedSkillCard({
  skill,
  isOwnProfile,
}: Readonly<{
  skill: VerifiedSkill;
  isOwnProfile?: boolean;
}>) {
  const tier = tierConfig[skill.verificationTier];
  const TierIcon = tier.icon;

  return (
    <div
      className={cn(
        'group relative rounded-xl border-2 p-4 transition-all hover:shadow-md',
        tier.borderColor,
        skill.isPrimary && 'ring-2 ring-indigo-200'
      )}
    >
      {/* Primary badge */}
      {skill.isPrimary && (
        <span className="absolute -top-2 left-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
          Primary
        </span>
      )}

      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-gray-900">{skill.name}</h4>
          <p className="text-xs text-gray-500">{skill.category}</p>
        </div>

        {/* Verification tier badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                  tier.bgColor,
                  tier.color
                )}
              >
                <TierIcon className="h-3.5 w-3.5" />
                {tier.label}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tier.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Proficiency bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-gray-500">Proficiency</span>
          <span className="text-xs font-medium text-gray-700">
            {getProficiencyLabel(skill.proficiencyLevel)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              getProficiencyColor(skill.proficiencyLevel)
            )}
            style={{ width: `${(skill.proficiencyLevel / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {/* Assessment score */}
          {skill.assessmentScore && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 font-medium text-green-600">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {skill.assessmentScore}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assessment score</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Endorsements */}
          {skill.endorsementCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {skill.endorsementCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{skill.endorsementCount} endorsements</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Years of experience */}
        <span>{skill.yearsOfExperience} yrs exp</span>
      </div>

      {/* Own profile actions */}
      {isOwnProfile && skill.verificationTier !== 'certified' && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <Link href={`/dashboard/skills/${skill.id}/verify`}>
            <Button className="w-full text-xs" size="sm" variant="outline">
              Upgrade Verification
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Verification Legend
// ============================================================================

function VerificationLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <HelpCircle className="h-4 w-4" />
        <span>What do verification tiers mean?</span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-4">
          {Object.entries(tierConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-start gap-3">
                <div className={cn('rounded-full p-1.5', config.bgColor)}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VerifiedSkillsShowcase({
  skills,
  isOwnProfile = false,
  maxPrimarySkills = 5,
  className,
}: Readonly<VerifiedSkillsShowcaseProps>) {
  const [showAll, setShowAll] = useState(false);

  // Separate primary and secondary skills
  const primarySkills = skills.filter((s) => s.isPrimary).slice(0, maxPrimarySkills);
  const secondarySkills = skills.filter((s) => !s.isPrimary);
  const displayedSecondary = showAll ? secondarySkills : secondarySkills.slice(0, 4);

  // Stats
  const verifiedCount = skills.filter((s) =>
    ['assessed', 'certified'].includes(s.verificationTier)
  ).length;
  const totalEndorsements = skills.reduce((sum, s) => sum + s.endorsementCount, 0);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
          <p className="text-sm text-gray-500">
            {skills.length} skills • {verifiedCount} verified • {totalEndorsements} endorsements
          </p>
        </div>
        {isOwnProfile && (
          <Link href="/dashboard/skills">
            <Button size="sm" variant="outline">
              Manage Skills
            </Button>
          </Link>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Primary Skills */}
        {primarySkills.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Star className="h-4 w-4 text-amber-500" />
              Primary Skills
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {primarySkills.map((skill) => (
                <VerifiedSkillCard key={skill.id} isOwnProfile={isOwnProfile} skill={skill} />
              ))}
            </div>
          </div>
        )}

        {/* Secondary Skills */}
        {secondarySkills.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium text-gray-700">Additional Skills</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedSecondary.map((skill) => (
                <VerifiedSkillCard key={skill.id} isOwnProfile={isOwnProfile} skill={skill} />
              ))}
            </div>

            {secondarySkills.length > 4 && (
              <button
                className="mt-4 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show {secondarySkills.length - 4} more skills
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Verification Legend */}
        <VerificationLegend />
      </CardContent>
    </Card>
  );
}

export default VerifiedSkillsShowcase;
