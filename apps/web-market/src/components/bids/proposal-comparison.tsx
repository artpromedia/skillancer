/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  cn,
  ScrollArea,
} from '@skillancer/ui';
import { ArrowRight, Check, CheckCircle2, MapPin, Scale, Star, X } from 'lucide-react';
import Link from 'next/link';

import type { Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface ProposalComparisonProps {
  proposals: Proposal[];
  onRemove: (id: string) => void;
  onHire: (proposal: Proposal) => void;
  onClearAll: () => void;
  maxItems?: number;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-100';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
};

// ============================================================================
// Comparison Row
// ============================================================================

interface ComparisonRowProps {
  label: string;
  values: (string | number | React.ReactNode)[];
  highlight?: 'lowest' | 'highest';
  type?: 'text' | 'number' | 'score';
}

function ComparisonRow({ label, values, highlight, type = 'text' }: ComparisonRowProps) {
  // Find best value for highlighting
  const numericValues = values.map((v) => (typeof v === 'number' ? v : NaN));
  const bestIdx =
    highlight === 'lowest'
      ? numericValues.indexOf(Math.min(...numericValues.filter((n) => !isNaN(n))))
      : highlight === 'highest'
        ? numericValues.indexOf(Math.max(...numericValues.filter((n) => !isNaN(n))))
        : -1;

  return (
    <div className="flex border-b last:border-b-0">
      <div className="text-muted-foreground w-40 flex-shrink-0 bg-slate-50 p-3 text-sm font-medium">
        {label}
      </div>
      {values.map((value, idx) => (
        <div
          key={idx}
          className={cn(
            'flex flex-1 items-center justify-center border-l p-3 text-center',
            idx === bestIdx && 'bg-green-50'
          )}
        >
          {type === 'score' && typeof value === 'number' ? (
            <span
              className={cn('rounded-full px-2 py-0.5 text-sm font-semibold', getScoreColor(value))}
            >
              {value}%
            </span>
          ) : idx === bestIdx && highlight ? (
            <span className="flex items-center gap-1 font-semibold text-green-600">
              {value}
              <Check className="h-4 w-4" />
            </span>
          ) : (
            <span>{value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Freelancer Header
// ============================================================================

function FreelancerHeader({
  proposal,
  onRemove,
  onHire,
}: {
  proposal: Proposal;
  onRemove: () => void;
  onHire: () => void;
}) {
  const freelancer = proposal.freelancer;

  return (
    <div className="relative flex-1 border-l p-4 text-center">
      {/* Remove button */}
      <button
        className="text-muted-foreground hover:text-foreground absolute right-2 top-2"
        type="button"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Avatar */}
      <Avatar className="mx-auto mb-3 h-16 w-16">
        <AvatarImage src={freelancer?.avatarUrl} />
        <AvatarFallback>{freelancer?.name?.charAt(0) ?? 'F'}</AvatarFallback>
      </Avatar>

      {/* Name */}
      <Link
        className="mb-1 block font-semibold hover:underline"
        href={`/freelancers/${freelancer?.username}`}
      >
        {freelancer?.name}
        {freelancer?.verificationLevel !== 'BASIC' && (
          <CheckCircle2 className="ml-1 inline h-4 w-4 text-blue-500" />
        )}
      </Link>

      {/* Title */}
      <p className="text-muted-foreground mb-2 text-sm">{freelancer?.title}</p>

      {/* Location */}
      <div className="text-muted-foreground mb-3 flex items-center justify-center gap-1 text-xs">
        <MapPin className="h-3 w-3" />
        {freelancer?.location}
      </div>

      {/* Quick stats */}
      <div className="mb-3 flex justify-center gap-2">
        <Badge variant="secondary">
          <Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" />
          {freelancer?.rating?.toFixed(1)}
        </Badge>
        <Badge className="text-green-700" variant="secondary">
          {freelancer?.successRate}% success
        </Badge>
      </div>

      {/* Hire button */}
      <Button className="w-full" size="sm" onClick={onHire}>
        Hire
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalComparison({
  proposals,
  onRemove,
  onHire,
  onClearAll,
  maxItems = 3,
  className,
}: ProposalComparisonProps) {
  if (proposals.length === 0) {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <Scale className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h3 className="mb-2 text-lg font-semibold">Compare Proposals</h3>
        <p className="text-muted-foreground mb-4">
          Select up to {maxItems} proposals to compare side by side
        </p>
        <p className="text-muted-foreground text-sm">
          Click on proposals from the list to add them here
        </p>
      </Card>
    );
  }

  // Prepare comparison data
  const bidAmounts = proposals.map((p) => p.bidAmount);
  const deliveryDays = proposals.map((p) => p.deliveryDays);
  const ratings = proposals.map((p) => p.freelancer?.rating ?? 0);
  const successRates = proposals.map((p) => p.freelancer?.successRate ?? 0);
  const matchScores = proposals.map((p) => p.matchScore?.overall ?? 0);
  const completedJobs = proposals.map((p) => p.freelancer?.completedJobs ?? 0);
  const hourlyRates = proposals.map((p) => p.freelancer?.hourlyRate ?? 0);

  // Skills overlap
  const getSkillName = (s: string | { id: string; name: string }): string =>
    typeof s === 'string' ? s : s.name;

  const allSkills = new Set<string>();
  proposals.forEach((p) => {
    p.freelancer?.skills?.forEach((s) => allSkills.add(getSkillName(s)));
  });

  const skillsOverlap = proposals.map((p) => {
    const freelancerSkills = new Set(p.freelancer?.skills?.map((s) => getSkillName(s)) ?? []);
    return freelancerSkills.size;
  });

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          <h3 className="font-semibold">
            Comparing {proposals.length} Proposal{proposals.length > 1 ? 's' : ''}
          </h3>
        </div>
        <Button size="sm" variant="ghost" onClick={onClearAll}>
          Clear All
        </Button>
      </div>

      <ScrollArea className="max-h-[600px]">
        {/* Freelancer headers */}
        <div className="sticky top-0 z-10 flex border-b bg-white">
          <div className="w-40 flex-shrink-0" />
          {proposals.map((proposal) => (
            <FreelancerHeader
              key={proposal.id}
              proposal={proposal}
              onHire={() => onHire(proposal)}
              onRemove={() => onRemove(proposal.id)}
            />
          ))}
        </div>

        {/* Comparison rows */}
        <div>
          {/* Bid details section */}
          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Bid Details
          </div>

          <ComparisonRow
            highlight="lowest"
            label="Bid Amount"
            type="number"
            values={bidAmounts.map((v) => formatCurrency(v))}
          />

          <ComparisonRow
            highlight="lowest"
            label="Delivery Time"
            type="number"
            values={deliveryDays.map((v) => `${v} days`)}
          />

          <ComparisonRow
            label="Contract Type"
            values={proposals.map((p) => (
              <Badge key={p.id} variant="outline">
                {p.contractType}
              </Badge>
            ))}
          />

          <ComparisonRow
            label="Milestones"
            values={proposals.map((p) => p.milestones?.length ?? 0)}
          />

          {/* Freelancer stats section */}
          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Freelancer Stats
          </div>

          <ComparisonRow
            highlight="highest"
            label="Rating"
            type="number"
            values={ratings.map((r) => (
              <span key={r} className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {r.toFixed(1)}
              </span>
            ))}
          />

          <ComparisonRow
            highlight="highest"
            label="Success Rate"
            type="number"
            values={successRates.map((r) => `${r}%`)}
          />

          <ComparisonRow
            highlight="highest"
            label="Completed Jobs"
            type="number"
            values={completedJobs}
          />

          <ComparisonRow
            label="Hourly Rate"
            values={hourlyRates.map((r) => `${formatCurrency(r)}/hr`)}
          />

          <ComparisonRow
            highlight="highest"
            label="Skills"
            type="number"
            values={skillsOverlap.map((c) => `${c} skills`)}
          />

          {/* Match analysis section */}
          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Match Analysis
          </div>

          <ComparisonRow
            highlight="highest"
            label="Match Score"
            type="score"
            values={matchScores}
          />

          <ComparisonRow
            highlight="highest"
            label="Skills Match"
            type="score"
            values={proposals.map((p) => p.matchScore?.breakdown.skills ?? 0)}
          />

          <ComparisonRow
            highlight="highest"
            label="Experience Match"
            type="score"
            values={proposals.map((p) => p.matchScore?.breakdown.experience ?? 0)}
          />

          <ComparisonRow
            highlight="highest"
            label="Budget Match"
            type="score"
            values={proposals.map((p) => p.matchScore?.breakdown.budget ?? 0)}
          />

          {/* Cover letter preview */}
          <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Cover Letter Preview
          </div>

          <div className="flex border-b">
            <div className="w-40 flex-shrink-0" />
            {proposals.map((proposal) => (
              <div key={proposal.id} className="flex-1 border-l p-3">
                <p className="text-muted-foreground line-clamp-4 text-sm">{proposal.coverLetter}</p>
                <button className="text-primary mt-2 text-sm hover:underline" type="button">
                  Read more
                </button>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-slate-50 p-4">
        <p className="text-muted-foreground text-sm">
          <strong className="text-green-600">Green</strong> indicates the best value in each row
        </p>
        <div className="flex gap-2">
          {proposals.map((proposal) => (
            <Button
              key={proposal.id}
              className="min-w-[120px]"
              size="sm"
              variant="outline"
              onClick={() => onHire(proposal)}
            >
              Hire {proposal.freelancer?.name?.split(' ')[0]}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
