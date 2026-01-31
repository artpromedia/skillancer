/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Settings,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { Contract, ContractStatus, Milestone } from '@/lib/api/contracts';

import { AmendmentFlow } from '@/components/contracts/amendment-flow';
import { ContractOverview } from '@/components/contracts/contract-overview';
import { ContractSignature } from '@/components/contracts/contract-signature';
import { DisputeCenter } from '@/components/contracts/dispute-center';
import { EscrowWidget } from '@/components/contracts/escrow-widget';
import { MilestoneSubmissionModal } from '@/components/contracts/milestone-submission-modal';
import { MilestoneTracker } from '@/components/contracts/milestone-tracker';
import { PaymentStatus } from '@/components/contracts/payment-status';
import { TimeTracker } from '@/components/contracts/time-tracker';
import { WorkDiary } from '@/components/contracts/work-diary';
import {
  useContract,
  useContractPayments,
  useContractMutations,
  useTimeEntries,
} from '@/hooks/use-contracts';

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDING_SIGNATURE: {
    label: 'Pending Signature',
    color: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: PlayCircle },
  PAUSED: { label: 'Paused', color: 'bg-blue-100 text-blue-700', icon: PauseCircle },
  COMPLETED: { label: 'Completed', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  DISPUTED: { label: 'In Dispute', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

// ============================================================================
// Contract Header
// ============================================================================

function ContractHeader({
  contract,
  isLoading,
}: Readonly<{ contract?: Contract; isLoading: boolean }>) {
  if (isLoading || !contract) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[contract.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        href="/dashboard/contracts"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      {/* Title & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contract.title}</h1>
            <Badge className={cn('flex-shrink-0', statusConfig.color)}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">Contract with {contract.client.name}</p>
        </div>
        <Button size="icon" variant="ghost">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <DollarSign className="text-primary h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-xs">Total Budget</p>
              <p className="font-semibold">${contract.amount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-muted-foreground text-xs">Earned</p>
              <p className="font-semibold">${contract.totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-muted-foreground text-xs">In Escrow</p>
              <p className="font-semibold">${contract.escrowBalance.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <Calendar className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-xs">Due Date</p>
              <p className="font-semibold">
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'Ongoing'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Loading State
// ============================================================================

function ContractDetailSkeleton() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractDetailClient({ contractId }: Readonly<{ contractId: string }>) {
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Fetch contract
  const { contract, isLoading, error, refetch, isFetching } = useContract(contractId);

  // Fetch payments
  const { payments } = useContractPayments(contractId);

  // Fetch time entries (for hourly contracts)
  const { timeEntries } = useTimeEntries(contractId);

  // Mutations
  const {
    sign,
    isSigning: _isSigning,
    pause,
    isPausing,
    resume,
    isResuming,
    end,
    isEnding,
    submitMilestone,
    isSubmittingMilestone: _isSubmittingMilestone,
    fundMilestone,
    isFundingMilestone: _isFundingMilestone,
    releaseMilestonePayment,
    isReleasingMilestonePayment: _isReleasingMilestonePayment,
    addTimeEntry,
    isAddingTimeEntry,
  } = useContractMutations({
    contractId,
    onSubmitMilestone: () => {
      setShowSubmissionModal(false);
      setSelectedMilestone(null);
    },
    onError: (err) => {
      console.error('Contract action failed:', err);
    },
  });

  // Mock current user role - in real app, get from auth context
  const isFreelancer = true;
  const isClient = false;

  // Handlers
  const handleMilestoneSubmit = (
    milestoneId: string,
    data: {
      message: string;
      deliverables: { id: string; title: string; completed: boolean }[];
      attachments: { id: string; name: string; size: number; type: string; url?: string }[];
      links: { id: string; title: string; url: string }[];
    }
  ): Promise<void> => {
    submitMilestone({
      milestoneId,
      data: {
        message: data.message,
        deliverables: data.deliverables.map((d) => ({ id: d.id, completed: d.completed })),
        links: data.links.map((l) => l.url),
      },
    });
    return Promise.resolve();
  };

  const handleMilestoneClick = (milestone: Milestone | undefined) => {
    if (milestone && milestone.status === 'IN_PROGRESS' && isFreelancer) {
      setSelectedMilestone(milestone);
      setShowSubmissionModal(true);
    }
  };

  // Loading state
  if (isLoading) {
    return <ContractDetailSkeleton />;
  }

  // Error state
  if (error || !contract) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-red-900">Failed to load contract</h2>
              <p className="text-sm text-red-700">{error?.message ?? 'Contract not found'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refetch()}>
                Try Again
              </Button>
              <Button asChild>
                <Link href="/dashboard/contracts">Back to Contracts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fundedMilestones = contract.milestones.filter(
    (m) =>
      m.status === 'RELEASED' ||
      m.status === 'APPROVED' ||
      m.status === 'IN_PROGRESS' ||
      m.status === 'SUBMITTED' ||
      m.status === 'FUNDED'
  );
  const unfundedMilestones = contract.milestones.filter((m) => m.status === 'PENDING');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Refresh button */}
      <div className="flex justify-end">
        <Button disabled={isFetching} size="sm" variant="ghost" onClick={() => void refetch()}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Header */}
      <ContractHeader contract={contract} isLoading={false} />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              {contract.type === 'HOURLY' && <TabsTrigger value="timesheet">Timesheet</TabsTrigger>}
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="amendments">Amendments</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-6 space-y-6" value="overview">
              <ContractOverview contract={contract} />
            </TabsContent>

            <TabsContent className="mt-6" value="milestones">
              <MilestoneTracker
                isClient={isClient}
                milestones={contract.milestones}
                onSubmitMilestone={(id) =>
                  handleMilestoneClick(contract.milestones.find((m) => m.id === id))
                }
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="timesheet">
              <TimeTracker
                contractId={contract.id}
                isFreelancer={isFreelancer}
                timeEntries={timeEntries}
                weeklyLimit={contract.weeklyLimit ?? 40}
                onAddEntry={(data) => {
                  addTimeEntry(data);
                  return Promise.resolve();
                }}
                onDeleteEntry={() => Promise.resolve()}
                onEditEntry={() => Promise.resolve()}
                onViewDiary={() => {}}
              />
              <WorkDiary
                contractId={contract.id}
                timeEntries={timeEntries}
                onDateChange={() => {}}
                onExport={() => {}}
              />
            </TabsContent>

            <TabsContent className="mt-6" value="payments">
              <PaymentStatus
                contract={contract}
                isClient={isClient}
                payments={{
                  escrowBalance: payments?.escrowBalance ?? contract.escrowBalance,
                  totalPaid: payments?.totalPaid ?? contract.totalPaid,
                  pendingAmount: payments?.pendingAmount ?? 0,
                  nextPaymentDate: payments?.nextPaymentDate,
                  nextPaymentAmount: payments?.nextPaymentAmount,
                  transactions: payments?.transactions ?? [],
                }}
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="amendments">
              <AmendmentFlow
                contract={contract}
                open={false}
                onOpenChange={() => {}}
                onSubmit={() => Promise.resolve()}
              />
            </TabsContent>

            <TabsContent className="mt-6" value="settings">
              <Card>
                <CardHeader>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Settings className="h-5 w-5" />
                    Contract Settings
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {contract.status === 'PAUSED' ? 'Resume Contract' : 'Pause Contract'}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {contract.status === 'PAUSED'
                          ? 'Resume work on this contract'
                          : 'Temporarily pause work on this contract'}
                      </p>
                    </div>
                    {contract.status === 'PAUSED' ? (
                      <Button disabled={isResuming} variant="outline" onClick={() => resume()}>
                        {isResuming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Resume
                      </Button>
                    ) : (
                      <Button disabled={isPausing} variant="outline" onClick={() => pause()}>
                        {isPausing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Pause
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">End Contract</p>
                      <p className="text-muted-foreground text-sm">
                        Complete or cancel this contract
                      </p>
                    </div>
                    <Button
                      disabled={isEnding}
                      variant="destructive"
                      onClick={() => end({ reason: 'Completed' })}
                    >
                      {isEnding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      End Contract
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Dispute Center */}
              <div className="mt-6">
                <DisputeCenter
                  contract={contract}
                  dispute={null}
                  isClient={isClient}
                  onOpenDispute={() => Promise.resolve()}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Contract Signature (if pending) */}
          {contract.status === 'PENDING_SIGNATURE' && (
            <ContractSignature
              contract={contract}
              userRole={isFreelancer ? 'freelancer' : 'client'}
              onCancel={() => {}}
              onSign={(data) => {
                sign({
                  signature: data.value,
                  signatureType: data.type === 'typed' ? 'TYPED' : 'DRAWN',
                  acceptedTerms: data.agreedToTerms,
                });
                return Promise.resolve();
              }}
            />
          )}

          {/* Escrow Widget */}
          <EscrowWidget
            escrowBalance={contract.escrowBalance}
            fundedMilestones={fundedMilestones}
            isClient={isClient}
            unfundedMilestones={unfundedMilestones}
            onFundMilestone={(milestoneId) => {
              fundMilestone({ milestoneId });
              return Promise.resolve();
            }}
            onReleasePayment={(milestoneId) => {
              releaseMilestonePayment(milestoneId);
              return Promise.resolve();
            }}
          />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Quick Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href={`/dashboard/messages?contract=${contractId}`}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send Message
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                View Contract Terms
              </Button>
              {contract.type === 'HOURLY' && (
                <Button
                  className="w-full justify-start"
                  disabled={isAddingTimeEntry}
                  variant="outline"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Log Time
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Recent Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {contract.milestones
                  .filter((m) => m.status === 'RELEASED' || m.status === 'APPROVED')
                  .slice(0, 3)
                  .map((m) => (
                    <div key={m.id} className="flex gap-3">
                      <div className="bg-primary mt-1 h-2 w-2 rounded-full" />
                      <div>
                        <p>{m.title} completed</p>
                        <p className="text-muted-foreground text-xs">
                          {m.escrowReleasedAt
                            ? new Date(m.escrowReleasedAt).toLocaleDateString()
                            : 'Recently'}
                        </p>
                      </div>
                    </div>
                  ))}
                {contract.milestones.filter(
                  (m) => m.status === 'RELEASED' || m.status === 'APPROVED'
                ).length === 0 && <p className="text-muted-foreground">No recent activity</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Milestone Submission Modal */}
      {selectedMilestone && (
        <MilestoneSubmissionModal
          milestone={selectedMilestone}
          open={showSubmissionModal}
          onOpenChange={setShowSubmissionModal}
          onSubmit={handleMilestoneSubmit}
        />
      )}
    </div>
  );
}
