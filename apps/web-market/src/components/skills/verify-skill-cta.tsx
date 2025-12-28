'use client';

import { cn } from '@skillancer/ui';
import {
  CheckCircle,
  FileCheck,
  Users,
  Link as LinkIcon,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type VerifyOption = 'assessment' | 'endorsement' | 'credential';

export interface VerifySkillCtaProps {
  skillId: string;
  skillName: string;
  currentVerificationLevel?: 'unverified' | 'self-assessed' | 'endorsed' | 'assessed' | 'certified';
  onTakeAssessment?: (skillId: string) => void;
  onRequestEndorsement?: (skillId: string) => void;
  onLinkCredential?: (skillId: string) => void;
  compact?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const VERIFY_OPTIONS = [
  {
    id: 'assessment' as const,
    label: 'Take Assessment',
    description: 'Prove your expertise with a skill test',
    icon: FileCheck,
    benefit: '40% higher hiring rate',
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
  },
  {
    id: 'endorsement' as const,
    label: 'Request Endorsement',
    description: 'Get vouched by peers or past clients',
    icon: Users,
    benefit: '3 endorsements = verified status',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  {
    id: 'credential' as const,
    label: 'Link Credential',
    description: 'Connect an existing certification',
    icon: LinkIcon,
    benefit: 'Instant certification badge',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
  },
];

const BENEFITS = [
  { icon: TrendingUp, text: 'Appear higher in search results' },
  { icon: Award, text: 'Display verification badge on profile' },
  { icon: Sparkles, text: 'Increase trust score by 15%' },
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface OptionButtonProps {
  option: (typeof VERIFY_OPTIONS)[number];
  onClick: () => void;
}

function OptionButton({ option, onClick }: OptionButtonProps) {
  const Icon = option.icon;

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
        option.bgColor
      )}
      onClick={onClick}
    >
      <div className={cn('rounded-lg bg-white p-2 shadow-sm', option.color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-foreground font-medium">{option.label}</div>
        <p className="text-muted-foreground text-sm">{option.description}</p>
        <div className="text-primary mt-1 flex items-center gap-1 text-xs">
          <Sparkles className="h-3 w-3" />
          <span>{option.benefit}</span>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VerifySkillCta({
  skillId,
  skillName,
  currentVerificationLevel = 'unverified',
  onTakeAssessment,
  onRequestEndorsement,
  onLinkCredential,
  compact = false,
}: VerifySkillCtaProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show CTA if already certified
  if (currentVerificationLevel === 'certified') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
        <CheckCircle className="h-4 w-4" />
        <span>This skill is fully verified</span>
      </div>
    );
  }

  const handleOptionClick = (option: VerifyOption) => {
    switch (option) {
      case 'assessment':
        onTakeAssessment?.(skillId);
        break;
      case 'endorsement':
        onRequestEndorsement?.(skillId);
        break;
      case 'credential':
        onLinkCredential?.(skillId);
        break;
    }
    setIsExpanded(false);
  };

  // Compact version - just a button
  if (compact) {
    return (
      <div className="relative">
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Verify</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
        </button>

        {isExpanded && (
          <div className="bg-card absolute right-0 z-10 mt-2 w-64 rounded-lg border p-2 shadow-lg">
            {VERIFY_OPTIONS.map((option) => (
              <button
                key={option.id}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md p-2 text-left text-sm"
                onClick={() => handleOptionClick(option.id)}
              >
                <option.icon className={cn('h-4 w-4', option.color)} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full version - expandable card
  return (
    <div className="bg-card rounded-lg border">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium">Verify &ldquo;{skillName}&rdquo;</h4>
            <p className="text-muted-foreground text-sm">Boost your credibility</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-5 w-5 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t p-4">
          {/* Benefits Preview */}
          <div className="bg-muted/50 mb-4 rounded-lg p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">VERIFICATION BENEFITS</p>
            <div className="space-y-2">
              {BENEFITS.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <benefit.icon className="text-primary h-4 w-4" />
                  <span>{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">
              CHOOSE A VERIFICATION METHOD
            </p>
            {VERIFY_OPTIONS.map((option) => (
              <OptionButton
                key={option.id}
                option={option}
                onClick={() => handleOptionClick(option.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifySkillCta;
