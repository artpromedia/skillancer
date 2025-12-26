/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions, @next/next/no-img-element */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  Archive,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquare,
  Paperclip,
  Shield,
  Star,
  ThumbsDown,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import type { Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface ProposalDetailModalProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShortlist: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onHire: (proposal: Proposal) => void;
  onMessage: (proposal: Proposal) => void;
}

// ============================================================================
// Freelancer Profile Section
// ============================================================================

function FreelancerProfile({ proposal }: { proposal: Proposal }) {
  const freelancer = proposal.freelancer;
  if (!freelancer) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={freelancer.avatarUrl} />
          <AvatarFallback className="text-lg">{freelancer.name?.charAt(0) ?? 'F'}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{freelancer.name}</h3>
            {freelancer.verificationLevel !== 'BASIC' && (
              <Shield className="h-5 w-5 text-blue-500" />
            )}
          </div>
          <p className="text-muted-foreground">{freelancer.title}</p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            <span>{freelancer.location}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-lg font-semibold">{freelancer.rating?.toFixed(1)}</span>
          </div>
          <p className="text-muted-foreground text-xs">{freelancer.reviewCount} reviews</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-green-600">{freelancer.successRate}%</p>
          <p className="text-muted-foreground text-xs">Success Rate</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{formatCurrency(freelancer.totalEarnings ?? 0)}</p>
          <p className="text-muted-foreground text-xs">Earned</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{freelancer.completedJobs}</p>
          <p className="text-muted-foreground text-xs">Jobs Done</p>
        </div>
      </div>

      {/* Bio */}
      {freelancer.bio && (
        <div>
          <h4 className="mb-2 font-medium">About</h4>
          <p className="text-muted-foreground text-sm">{freelancer.bio}</p>
        </div>
      )}

      {/* Skills */}
      {freelancer.skills && freelancer.skills.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {freelancer.skills.map((skill) => (
              <Badge key={skill.id} variant="secondary">
                {skill.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* View full profile */}
      <Button asChild className="w-full" variant="outline">
        <Link href={`/freelancers/${freelancer.username}`}>
          <User className="mr-2 h-4 w-4" />
          View Full Profile
          <ExternalLink className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// ============================================================================
// Proposal Details Section
// ============================================================================

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* Bid summary */}
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
        <div>
          <p className="text-muted-foreground text-xs">Bid Amount</p>
          <p className="text-xl font-bold">
            {formatCurrency(proposal.bidAmount)}
            {proposal.contractType === 'HOURLY' && (
              <span className="text-muted-foreground text-sm font-normal">/hr</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Delivery Time</p>
          <p className="text-xl font-bold">{proposal.deliveryDays} days</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Contract Type</p>
          <p className="text-xl font-bold">{proposal.contractType}</p>
        </div>
      </div>

      {/* Cover letter */}
      <div>
        <h4 className="mb-3 font-medium">Cover Letter</h4>
        <div className="prose prose-sm max-w-none rounded-lg border bg-white p-4">
          <p className="whitespace-pre-wrap">{proposal.coverLetter}</p>
        </div>
      </div>

      {/* Milestones */}
      {proposal.milestones && proposal.milestones.length > 0 && (
        <div>
          <h4 className="mb-3 font-medium">Proposed Milestones</h4>
          <div className="space-y-3">
            {proposal.milestones.map((milestone, index) => (
              <div key={milestone.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{milestone.title}</p>
                  {milestone.description && (
                    <p className="text-muted-foreground text-sm">{milestone.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(milestone.amount)}</p>
                  <p className="text-muted-foreground text-xs">{milestone.durationDays} days</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {proposal.attachments && proposal.attachments.length > 0 && (
        <div>
          <h4 className="mb-3 font-medium">Attachments</h4>
          <div className="space-y-2">
            {proposal.attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Paperclip className="h-5 w-5 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{attachment.filename}</p>
                  <p className="text-muted-foreground text-xs">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <a download href={attachment.url}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio items */}
      {proposal.portfolioItems && proposal.portfolioItems.length > 0 && (
        <div>
          <h4 className="mb-3 font-medium">Linked Portfolio</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {proposal.portfolioItems.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg border">
                {item.imageUrl && (
                  <img alt={item.title} className="h-32 w-full object-cover" src={item.imageUrl} />
                )}
                <div className="p-3">
                  <p className="font-medium">{item.title}</p>
                  {item.url && (
                    <a
                      className="text-primary mt-1 flex items-center gap-1 text-sm hover:underline"
                      href={item.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Project
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Match Analysis Section
// ============================================================================

function MatchAnalysis({ proposal }: { proposal: Proposal }) {
  const matchScore = proposal.matchScore;
  const qualityScore = proposal.qualityScore;

  if (!matchScore && !qualityScore) {
    return (
      <div className="py-8 text-center">
        <Zap className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <p className="text-muted-foreground">No match analysis available</p>
      </div>
    );
  }

  const getColor = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-100';
    if (value >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Smart Match Score */}
      {matchScore && (
        <div>
          <h4 className="mb-3 font-medium">Smart Match Score</h4>
          <div className="rounded-lg border p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold">Overall Match</span>
              <span
                className={`rounded-full px-3 py-1 text-lg font-bold ${getColor(matchScore.overall)}`}
              >
                {matchScore.overall}%
              </span>
            </div>
            <div className="space-y-3">
              {Object.entries(matchScore.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-24 text-sm capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quality Score */}
      {qualityScore && (
        <div>
          <h4 className="mb-3 font-medium">Proposal Quality Score</h4>
          <div className="rounded-lg border p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold">Quality Rating</span>
              <span
                className={`rounded-full px-3 py-1 text-lg font-bold ${getColor(qualityScore.overall)}`}
              >
                {qualityScore.overall}%
              </span>
            </div>

            {qualityScore.suggestions.length > 0 && (
              <div className="space-y-2">
                {qualityScore.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 rounded-lg p-2 text-sm ${
                      suggestion.type === 'SUCCESS'
                        ? 'bg-green-50 text-green-700'
                        : suggestion.type === 'WARNING'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {suggestion.type === 'SUCCESS' && (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    )}
                    {suggestion.type === 'IMPROVEMENT' && (
                      <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{suggestion.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalDetailModal({
  proposal,
  open,
  onOpenChange,
  onShortlist,
  onArchive,
  onDecline,
  onHire,
  onMessage,
}: ProposalDetailModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('proposal');

  const handleAction = useCallback(async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  }, []);

  if (!proposal) return null;

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">Proposal Details</DialogTitle>
              <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                Submitted {timeAgo(proposal.submittedAt)}
                {proposal.boostType && (
                  <Badge className="bg-purple-100 text-purple-700">
                    <Zap className="mr-1 h-3 w-3" />
                    {proposal.boostType}
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        <Tabs className="flex flex-1 flex-col" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start rounded-none border-b px-6">
            <TabsTrigger value="proposal">
              <FileText className="mr-2 h-4 w-4" />
              Proposal
            </TabsTrigger>
            <TabsTrigger value="freelancer">
              <User className="mr-2 h-4 w-4" />
              Freelancer
            </TabsTrigger>
            <TabsTrigger value="analysis">
              <TrendingUp className="mr-2 h-4 w-4" />
              Match Analysis
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-6">
              <TabsContent className="mt-0" value="proposal">
                <ProposalDetails proposal={proposal} />
              </TabsContent>
              <TabsContent className="mt-0" value="freelancer">
                <FreelancerProfile proposal={proposal} />
              </TabsContent>
              <TabsContent className="mt-0" value="analysis">
                <MatchAnalysis proposal={proposal} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t p-6">
          <div className="flex gap-2">
            {proposal.status !== 'SHORTLISTED' && (
              <Button
                disabled={isProcessing}
                variant="outline"
                onClick={() => void handleAction(() => onShortlist(proposal.id))}
              >
                <Star className="mr-2 h-4 w-4" />
                Shortlist
              </Button>
            )}
            <Button
              disabled={isProcessing}
              variant="outline"
              onClick={() => void handleAction(() => onArchive(proposal.id))}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button
              disabled={isProcessing}
              variant="outline"
              onClick={() => void handleAction(() => onDecline(proposal.id))}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onMessage(proposal)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Message
            </Button>
            <Button onClick={() => onHire(proposal)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Hire Freelancer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
