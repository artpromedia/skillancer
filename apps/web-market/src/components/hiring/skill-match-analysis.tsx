'use client';

import { cn } from '@skillancer/ui';
import {
  CheckCircle2,
  Circle,
  MinusCircle,
  Shield,
  Award,
  Info,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { useState } from 'react';

type VerificationStatus = 'unverified' | 'self-assessed' | 'endorsed' | 'assessed' | 'certified';

interface SkillMatch {
  skillName: string;
  required: boolean;
  freelancerLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  verificationStatus: VerificationStatus;
  assessmentScore?: number;
  endorsementCount?: number;
  yearsExperience?: number;
  matchQuality: 'perfect' | 'good' | 'partial' | 'none';
}

interface SkillMatchAnalysisProps {
  readonly freelancerName: string;
  readonly skills: readonly SkillMatch[];
  readonly onFilterVerified?: (enabled: boolean) => void;
  readonly className?: string;
}

const verificationConfig: Record<
  VerificationStatus,
  { label: string; color: string; icon: typeof Circle }
> = {
  unverified: { label: 'Unverified', color: 'text-gray-400', icon: Circle },
  'self-assessed': { label: 'Self-assessed', color: 'text-blue-400', icon: Circle },
  endorsed: { label: 'Endorsed', color: 'text-blue-600', icon: CheckCircle2 },
  assessed: { label: 'Assessed', color: 'text-green-600', icon: Shield },
  certified: { label: 'Certified', color: 'text-amber-600', icon: Award },
};

export function SkillMatchAnalysis({
  freelancerName,
  skills,
  onFilterVerified,
  className,
}: SkillMatchAnalysisProps) {
  const [showAll, setShowAll] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);

  const requiredSkills = skills.filter((s) => s.required);

  const verifiedCount = skills.filter(
    (s) => s.verificationStatus !== 'unverified' && s.verificationStatus !== 'self-assessed'
  ).length;

  const matchedRequiredCount = requiredSkills.filter((s) => s.matchQuality !== 'none').length;

  const overallMatchScore = Math.round(
    (skills.filter((s) => s.matchQuality === 'perfect' || s.matchQuality === 'good').length /
      skills.length) *
      100
  );

  const verifiedPercentage = Math.round((verifiedCount / skills.length) * 100);

  const getDisplayedSkills = () => {
    if (filterVerifiedOnly) {
      return skills.filter(
        (s) => s.verificationStatus !== 'unverified' && s.verificationStatus !== 'self-assessed'
      );
    }
    if (showAll) {
      return skills;
    }
    return skills.slice(0, 8);
  };

  const displayedSkills = getDisplayedSkills();

  const handleFilterToggle = () => {
    const newValue = !filterVerifiedOnly;
    setFilterVerifiedOnly(newValue);
    onFilterVerified?.(newValue);
  };

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="border-b border-gray-100 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Skill Match Analysis</h3>
            <p className="mt-1 text-sm text-gray-500">
              {freelancerName}&apos;s skills vs. your requirements
            </p>
          </div>

          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
              filterVerifiedOnly
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
            onClick={handleFilterToggle}
          >
            <Filter className="h-4 w-4" />
            Verified Only
          </button>
        </div>

        {/* Match Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{overallMatchScore}%</p>
            <p className="mt-1 text-xs text-gray-500">Overall Match</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">
              {matchedRequiredCount}/{requiredSkills.length}
            </p>
            <p className="mt-1 text-xs text-gray-500">Required Skills</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-3 text-center">
            <p className="text-2xl font-bold text-indigo-700">{verifiedPercentage}%</p>
            <p className="mt-1 text-xs text-gray-500">Verified</p>
          </div>
        </div>
      </div>

      {/* Skills List */}
      <div className="p-6">
        <div className="space-y-3">
          {displayedSkills.map((skill) => {
            const config = verificationConfig[skill.verificationStatus];
            const Icon = config.icon;

            return (
              <div
                key={skill.skillName}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-3',
                  skill.matchQuality === 'perfect' && 'border-green-200 bg-green-50',
                  skill.matchQuality === 'good' && 'border-blue-200 bg-blue-50',
                  skill.matchQuality === 'partial' && 'border-amber-200 bg-amber-50',
                  skill.matchQuality === 'none' && 'border-gray-200 bg-gray-50'
                )}
              >
                {/* Match Indicator */}
                <div className="flex-shrink-0">
                  {skill.matchQuality === 'perfect' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {skill.matchQuality === 'good' && (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  )}
                  {skill.matchQuality === 'partial' && (
                    <MinusCircle className="h-5 w-5 text-amber-600" />
                  )}
                  {skill.matchQuality === 'none' && <Circle className="h-5 w-5 text-gray-400" />}
                </div>

                {/* Skill Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{skill.skillName}</span>
                    {skill.required && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                        Required
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                    {skill.freelancerLevel && (
                      <span className="capitalize">{skill.freelancerLevel}</span>
                    )}
                    {skill.yearsExperience && <span>• {skill.yearsExperience} years</span>}
                    {skill.assessmentScore && <span>• {skill.assessmentScore}% scored</span>}
                    {skill.endorsementCount && <span>• {skill.endorsementCount} endorsements</span>}
                  </div>
                </div>

                {/* Verification Status */}
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <span className={cn('text-sm', config.color)}>{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show More/Less */}
        {!filterVerifiedOnly && skills.length > 8 && (
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm text-indigo-600 hover:text-indigo-700"
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
                Show {skills.length - 8} more skills
              </>
            )}
          </button>
        )}
      </div>

      {/* Trust Explanation */}
      <div className="px-6 pb-6">
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
          <Info className="mt-0.5 h-4 w-4 text-blue-600" />
          <div className="text-sm text-blue-900">
            <strong>Verification matters:</strong> Skills verified through assessments or
            certifications are more reliable indicators of expertise than self-assessed skills.
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillMatchAnalysis;
