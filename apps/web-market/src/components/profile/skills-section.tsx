'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Progress,
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
  ExternalLink,
  GraduationCap,
  Shield,
  Star,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { getProficiencyColor, getProficiencyLabel } from '@/lib/api/skills';

import type { FreelancerSkill } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface SkillsSectionProps {
  skills: FreelancerSkill[];
  isOwnProfile?: boolean;
  showVerificationDetails?: boolean;
  showComparisonTool?: boolean;
  className?: string;
}

interface SkillCardProps {
  skill: FreelancerSkill;
  showDetails?: boolean;
  isComparing?: boolean;
}

// ============================================================================
// Skill Card Component
// ============================================================================

function SkillCard({ skill, showDetails = true, isComparing = false }: SkillCardProps) {
  const proficiencyLabel = getProficiencyLabel(skill.proficiencyLevel);
  const proficiencyColor = getProficiencyColor(skill.proficiencyLevel);

  return (
    <div
      className={cn(
        'bg-card group relative rounded-lg border p-4 transition-all hover:shadow-md',
        skill.isPrimary && 'border-primary/30 bg-primary/5',
        isComparing && 'ring-primary ring-2'
      )}
    >
      {/* Primary badge */}
      {skill.isPrimary && (
        <span className="bg-primary text-primary-foreground absolute -top-2 left-3 rounded-full px-2 py-0.5 text-[10px] font-medium">
          Primary
        </span>
      )}

      {/* Skill header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-foreground truncate font-medium">{skill.name}</h4>
            {skill.isVerified && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    {skill.verificationSource === 'SKILLPOD_ASSESSMENT' ? (
                      <Shield className="h-4 w-4 text-emerald-600" />
                    ) : skill.verificationSource === 'ENDORSEMENT' ? (
                      <ThumbsUp className="h-4 w-4 text-blue-600" />
                    ) : (
                      <BadgeCheck className="h-4 w-4 text-purple-600" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {skill.verificationSource === 'SKILLPOD_ASSESSMENT' &&
                      'Verified via SkillPod Assessment'}
                    {skill.verificationSource === 'ENDORSEMENT' && 'Peer Endorsed'}
                    {skill.verificationSource === 'PROJECT' && 'Project Verified'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'} experience
          </p>
        </div>
        <Badge className={cn('shrink-0', proficiencyColor)} variant="secondary">
          {proficiencyLabel}
        </Badge>
      </div>

      {/* Skill details */}
      {showDetails && (
        <div className="mt-3 space-y-2">
          {/* Confidence score */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <div className="flex items-center gap-2">
              <Progress className="h-1.5 w-16" value={skill.confidenceScore} />
              <span className="font-medium">{skill.confidenceScore}%</span>
            </div>
          </div>

          {/* Assessment score if available */}
          {skill.assessmentScore && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5" />
                Assessment
              </span>
              <span className="font-medium text-emerald-600">
                {skill.assessmentScore}%
                {skill.assessmentPercentile && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (Top {100 - skill.assessmentPercentile}%)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Endorsements */}
          {skill.endorsementCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                Endorsements
              </span>
              <span className="font-medium">{skill.endorsementCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SkillsSection({
  skills,
  isOwnProfile = false,
  showVerificationDetails = true,
  showComparisonTool = false,
  className,
}: SkillsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [_selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // Separate primary and other skills
  const primarySkills = skills.filter((s) => s.isPrimary);
  const otherSkills = skills.filter((s) => !s.isPrimary);

  // Skills to display
  const visibleSkills = showAll ? otherSkills : otherSkills.slice(0, 6);
  const hasMoreSkills = otherSkills.length > 6;

  // Stats
  const verifiedCount = skills.filter((s) => s.isVerified).length;
  const avgConfidence =
    skills.length > 0
      ? Math.round(skills.reduce((acc, s) => acc + s.confidenceScore, 0) / skills.length)
      : 0;

  const _toggleComparison = (skillId: string) => {
    setSelectedForComparison((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : prev.length < 3
          ? [...prev, skillId]
          : prev
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <h2 className="text-xl font-semibold">Skills</h2>
          <p className="text-muted-foreground text-sm">
            {skills.length} skills • {verifiedCount} verified
          </p>
        </div>
        {isOwnProfile && (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/profile/skills">Manage Skills</Link>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats summary */}
        <div className="bg-muted/50 flex flex-wrap gap-4 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">{verifiedCount} Verified</p>
              <p className="text-muted-foreground text-xs">Skills with verification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">{avgConfidence}% Avg Confidence</p>
              <p className="text-muted-foreground text-xs">Based on activity & assessments</p>
            </div>
          </div>
          {primarySkills.length > 0 && (
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">{primarySkills.length} Primary</p>
                <p className="text-muted-foreground text-xs">Core expertise areas</p>
              </div>
            </div>
          )}
        </div>

        {/* Primary skills */}
        {primarySkills.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Star className="h-4 w-4" />
              Primary Skills
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {primarySkills.map((skill) => (
                <SkillCard key={skill.id} showDetails={showVerificationDetails} skill={skill} />
              ))}
            </div>
          </div>
        )}

        {/* All other skills */}
        {otherSkills.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Award className="h-4 w-4" />
              All Skills
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSkills.map((skill) => (
                <SkillCard key={skill.id} showDetails={showVerificationDetails} skill={skill} />
              ))}
            </div>

            {/* Show more/less button */}
            {hasMoreSkills && (
              <Button
                className="w-full"
                size="sm"
                variant="ghost"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Show All ({otherSkills.length - 6} more)
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Comparison tool placeholder */}
        {showComparisonTool && !isOwnProfile && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Select up to 3 skills to compare with other freelancers
            </p>
            <Button className="mt-2" size="sm" variant="outline">
              Start Comparison
            </Button>
          </div>
        )}

        {/* SkillPod verification CTA */}
        {isOwnProfile && verifiedCount < skills.length && (
          <div className="bg-primary/5 flex items-center justify-between rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-full p-2">
                <Shield className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Verify your skills with SkillPod</p>
                <p className="text-muted-foreground text-sm">
                  Boost your profile with verified skill assessments
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/skillpod/assessments">
                Take Assessment
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
