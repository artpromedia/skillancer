/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Badge, Button, Card, CardContent, CardHeader, Separator } from '@skillancer/ui';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  Paperclip,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProposalDetailClient } from './proposal-detail-client';

import type { Proposal } from '@/lib/api/bids';
import type { Metadata } from 'next';

import {
  getProposalDetails,
  getProposalStatusInfo,
  canEditProposal,
  canWithdrawProposal,
} from '@/lib/api/bids';

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}): Promise<Metadata> {
  const { proposalId } = await params;

  try {
    const proposal = await getProposalDetails(proposalId);

    return {
      title: `Proposal: ${proposal.job?.title} | Skillancer`,
      description: `View your proposal for ${proposal.job?.title}`,
    };
  } catch {
    return { title: 'Proposal Not Found' };
  }
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: Readonly<{ status: string }>) {
  const statusInfo = getProposalStatusInfo(status as Proposal['status']);

  const getStyle = () => {
    switch (status) {
      case 'SUBMITTED':
      case 'VIEWED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'SHORTLISTED':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'INTERVIEWING':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'HIRED':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'DECLINED':
      case 'WITHDRAWN':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <Badge className={`border ${getStyle()}`} variant="outline">
      {statusInfo.label}
    </Badge>
  );
}

// ============================================================================
// Page
// ============================================================================

export default async function ProposalDetailPage({
  params,
}: Readonly<{ params: Promise<{ proposalId: string }> }>) {
  const { proposalId } = await params;

  let proposal: Proposal;
  try {
    proposal = await getProposalDetails(proposalId);
  } catch {
    notFound();
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const canEdit = canEditProposal(proposal.status);
  const canWithdraw = canWithdrawProposal(proposal.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2 text-sm"
            href="/dashboard/proposals"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Proposals
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <StatusBadge status={proposal.status} />
                {proposal.boostType && (
                  <Badge className="border-purple-200 bg-purple-100 text-purple-700">
                    <Zap className="mr-1 h-3 w-3" />
                    {proposal.boostType}
                  </Badge>
                )}
                {proposal.clientViewed && (
                  <Badge className="border-green-200 bg-green-100 text-green-700">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Client Viewed
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold">{proposal.job?.title}</h1>
              <p className="text-muted-foreground">
                Submitted on {formatDate(proposal.submittedAt)}
              </p>
            </div>

            <div className="flex gap-2">
              {canEdit && (
                <Button asChild variant="outline">
                  <Link href={`/dashboard/proposals/${proposalId}/edit`}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={`/jobs/${proposal.job?.slug}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Job
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Bid summary */}
            <Card className="mb-6">
              <CardHeader>
                <h2 className="font-semibold">Your Bid</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-muted-foreground text-sm">Amount</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(proposal.bidAmount)}
                      {proposal.contractType === 'HOURLY' && (
                        <span className="text-muted-foreground text-sm font-normal">/hr</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Delivery</p>
                    <p className="text-2xl font-bold">{proposal.deliveryDays} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Type</p>
                    <p className="text-2xl font-bold">{proposal.contractType}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cover letter */}
            <Card className="mb-6">
              <CardHeader>
                <h2 className="font-semibold">Cover Letter</h2>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{proposal.coverLetter}</p>
                </div>
              </CardContent>
            </Card>

            {/* Milestones */}
            {proposal.milestones && proposal.milestones.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <h2 className="font-semibold">Proposed Milestones</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {proposal.milestones.map((milestone, index) => (
                      <div
                        key={milestone.id}
                        className="flex items-start gap-4 rounded-lg border p-4"
                      >
                        <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-semibold">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium">{milestone.title}</h3>
                          {milestone.description && (
                            <p className="text-muted-foreground mt-1 text-sm">
                              {milestone.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              {formatCurrency(milestone.amount)}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {milestone.durationDays} days
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total */}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>
                        {formatCurrency(proposal.milestones.reduce((sum, m) => sum + m.amount, 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            {proposal.attachments && proposal.attachments.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <h2 className="font-semibold">Attachments</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {proposal.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <Paperclip className="h-5 w-5 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{attachment.filename}</p>
                          <p className="text-muted-foreground text-xs">
                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
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
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Job info */}
            <Card className="mb-6">
              <CardHeader>
                <h2 className="font-semibold">Job Details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-sm">Client</p>
                  <p className="font-medium">{proposal.job?.client?.name}</p>
                  {proposal.job?.client?.companyName && (
                    <p className="text-muted-foreground text-sm">
                      {proposal.job.client.companyName}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Budget</p>
                  <p className="font-medium">
                    {proposal.job?.budget.type === 'FIXED'
                      ? `${formatCurrency(proposal.job.budget.minAmount ?? 0)} - ${formatCurrency(proposal.job.budget.maxAmount ?? 0)}`
                      : `${formatCurrency(proposal.job?.budget.amount ?? 0)}/hr`}
                  </p>
                </div>
                <Button asChild className="w-full" variant="outline">
                  <Link href={`/jobs/${proposal.job?.slug}`}>
                    View Full Job Details
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Quality score */}
            {proposal.qualityScore && (
              <Card className="mb-6">
                <CardHeader>
                  <h2 className="font-semibold">Quality Score</h2>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-center">
                    <span className="text-4xl font-bold text-green-600">
                      {proposal.qualityScore.overall}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(proposal.qualityScore.breakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-24 text-sm capitalize">{key}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${getScoreColor(value)}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm">{value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {canWithdraw && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <ProposalDetailClient canWithdraw={canWithdraw} proposalId={proposalId} />
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Activity</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proposal.clientViewedAt && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Client viewed your proposal</p>
                        <p className="text-muted-foreground text-sm">
                          {formatDate(proposal.clientViewedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Proposal submitted</p>
                      <p className="text-muted-foreground text-sm">
                        {formatDate(proposal.submittedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
