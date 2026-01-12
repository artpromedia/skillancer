/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, no-console */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Settings,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

// Components

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
  getContractById,
  getTimeEntries,
  submitMilestone,
  approveMilestone,
  fundMilestone,
  type SubmitMilestoneData,
} from '@/lib/api/contracts';
import type { Contract, ContractStatus, Milestone, PaymentInfo } from '@/lib/api/contracts';

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
// Derive Payment Info from Contract
// ============================================================================

function derivePaymentInfo(contract: Contract): PaymentInfo {
  const releasedMilestones = contract.milestones.filter(
    (m) => m.status === 'RELEASED' || m.status === 'APPROVED'
  );
  const fundedMilestones = contract.milestones.filter(
    (m) => m.escrowFunded && m.status !== 'RELEASED' && m.status !== 'APPROVED'
  );
  const pendingMilestones = contract.milestones.filter((m) => !m.escrowFunded);

  const releasedAmount = releasedMilestones.reduce((sum, m) => sum + m.amount, 0);
  const pendingAmount = pendingMilestones.reduce((sum, m) => sum + m.amount, 0);

  // Find next milestone that needs payment
  const nextMilestone = fundedMilestones[0];

  // Build transaction history from milestones
  const transactions = contract.milestones.flatMap((m) => {
    const txs = [];
    if (m.escrowFunded) {
      txs.push({
        id: `tx-funded-${m.id}`,
        type: 'ESCROW_FUNDED' as const,
        amount: m.amount,
        status: 'COMPLETED' as const,
        date: m.createdAt,
        description: `${m.title} funded`,
      });
    }
    if (m.escrowReleasedAt) {
      txs.push({
        id: `tx-released-${m.id}`,
        type: 'PAYMENT_RELEASED' as const,
        amount: m.amount,
        status: 'COMPLETED' as const,
        date: m.escrowReleasedAt,
        description: `${m.title} payment released`,
      });
    }
    return txs;
  });

  return {
    escrowBalance: contract.escrowBalance,
    totalPaid: releasedAmount,
    pendingAmount,
    nextPaymentDate: nextMilestone?.dueDate,
    nextPaymentAmount: nextMilestone?.amount,
    transactions,
  };
}

// ============================================================================
// Contract Header
// ============================================================================

function ContractHeader({ contract }: Readonly<{ contract: Contract }>) {
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
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
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
// Page Component
// ============================================================================

export function ContractDetailContent() {
  const queryClient = useQueryClient();
  const params = useParams();
  const contractId = params.contractId as string;

  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Fetch contract data
  const {
    data: contract,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => getContractById(contractId),
    enabled: !!contractId,
  });

  // Fetch time entries for hourly contracts
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries', contractId],
    queryFn: () => getTimeEntries(contractId),
    enabled: !!contractId && contract?.type === 'HOURLY',
  });

  // Submit milestone mutation
  const submitMilestoneMutation = useMutation({
    mutationFn: async ({
      milestoneId,
      data,
    }: {
      milestoneId: string;
      data: SubmitMilestoneData;
    }) => {
      return submitMilestone(milestoneId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      setShowSubmissionModal(false);
      setSelectedMilestone(null);
    },
  });

  // Fund milestone mutation
  const fundMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => fundMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
    },
  });

  // Approve milestone mutation
  const approveMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => approveMilestone(milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
    },
  });

  // Mock current user role - in real app, get from auth context
  const isFreelancer = true;
  const isClient = false;

  // Handlers
  const handleMilestoneSubmit = async (
    milestoneId: string,
    data: { message: string; deliverables: unknown[]; attachments: unknown[]; links: unknown[] }
  ) => {
    submitMilestoneMutation.mutate({
      milestoneId,
      data: {
        message: data.message,
        links: data.links as string[],
      },
    });
  };

  const handleMilestoneClick = (milestone: Milestone) => {
    if (milestone.status === 'IN_PROGRESS' && isFreelancer) {
      setSelectedMilestone(milestone);
      setShowSubmissionModal(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading contract details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !contract) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Failed to load contract</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Contract not found'}
          </p>
          <Button asChild>
            <Link href="/dashboard/contracts">Back to Contracts</Link>
          </Button>
        </div>
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
  const paymentInfo = derivePaymentInfo(contract);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <ContractHeader contract={contract} />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              {contract.type === 'HOURLY' && (
                <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
              )}
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
                  handleMilestoneClick(contract.milestones.find((m) => m.id === id)!)
                }
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="timesheet">
              <TimeTracker
                contractId={contract.id}
                timeEntries={[]}
                weeklyLimit={contract.weeklyLimit || 40}
                isFreelancer={isFreelancer}
                onAddEntry={async () => {}}
                onEditEntry={async () => {}}
                onDeleteEntry={async () => {}}
                onViewDiary={() => {}}
              />
              <WorkDiary
                contractId={contract.id}
                timeEntries={[]}
                onDateChange={() => {}}
                onExport={() => {}}
              />
            </TabsContent>

            <TabsContent className="mt-6" value="payments">
              <PaymentStatus
                contract={contract}
                payments={{
                  escrowBalance: paymentInfo.escrowAmount,
                  totalPaid: paymentInfo.releasedAmount,
                  pendingAmount: paymentInfo.pendingAmount,
                  nextPaymentDate: paymentInfo.nextPaymentDate,
                  nextPaymentAmount: paymentInfo.nextPaymentAmount,
                  transactions: paymentInfo.transactions,
                }}
                isClient={isClient}
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="amendments">
              <AmendmentFlow
                contract={contract}
                open={false}
                onOpenChange={() => {}}
                onSubmit={async () => {}}
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
                      <p className="font-medium">Pause Contract</p>
                      <p className="text-muted-foreground text-sm">
                        Temporarily pause work on this contract
                      </p>
                    </div>
                    <Button variant="outline">Pause</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">End Contract</p>
                      <p className="text-muted-foreground text-sm">
                        Complete or cancel this contract
                      </p>
                    </div>
                    <Button variant="destructive">End Contract</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Dispute Center */}
              <div className="mt-6">
                <DisputeCenter
                  contract={contract}
                  dispute={null}
                  isClient={isClient}
                  onOpenDispute={async () => {}}
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
              onSign={async () => {}}
              onCancel={() => {}}
            />
          )}

          {/* Escrow Widget */}
          <EscrowWidget
            escrowBalance={contract.escrowBalance}
            fundedMilestones={fundedMilestones}
            isClient={isClient}
            unfundedMilestones={unfundedMilestones}
            onFundMilestone={async (_milestoneId, _amount) => {
              // Feature: Fund milestone via API - not yet implemented
            }}
            onReleasePayment={async (_milestoneId) => {
              // Feature: Release payment via API - not yet implemented
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
              <Button className="w-full justify-start" variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Log Time
              </Button>
            </CardContent>
          </Card>

          {/* Activity Feed Placeholder */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Recent Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="bg-primary mt-1 h-2 w-2 rounded-full" />
                  <div>
                    <p>Milestone 2 completed</p>
                    <p className="text-muted-foreground text-xs">2 days ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <p>Payment of $3,000 released</p>
                    <p className="text-muted-foreground text-xs">2 days ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p>Milestone 3 funded</p>
                    <p className="text-muted-foreground text-xs">3 days ago</p>
                  </div>
                </div>
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
