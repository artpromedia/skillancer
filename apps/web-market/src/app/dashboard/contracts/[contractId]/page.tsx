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
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
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

import type { Contract, ContractStatus, Milestone } from '@/lib/api/contracts';

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
// Mock Data (Replace with API call)
// ============================================================================

const mockContract: Contract = {
  id: 'contract-1',
  jobId: 'job-1',
  proposalId: 'proposal-1',
  client: {
    id: 'client-1',
    userId: 'user-client-1',
    name: 'TechCorp Inc.',
    avatarUrl: undefined,
    rating: 4.8,
    reviewCount: 25,
    isVerified: true,
  },
  freelancer: {
    id: 'freelancer-1',
    userId: 'user-freelancer-1',
    name: 'John Developer',
    avatarUrl: undefined,
    rating: 4.9,
    reviewCount: 42,
    isVerified: true,
  },
  title: 'E-commerce Platform Development',
  description:
    'Build a full-featured e-commerce platform with React and Node.js. Includes user authentication, product catalog, shopping cart, checkout with Stripe integration, and admin dashboard.',
  type: 'FIXED',
  status: 'ACTIVE',
  amount: 15000,
  totalPaid: 9000,
  escrowBalance: 3000,
  hourlyRate: undefined,
  weeklyLimit: undefined,
  skills: [],
  skillPodEnabled: false,
  milestones: [
    {
      id: 'ms-1',
      contractId: 'contract-1',
      title: 'Project Setup & Authentication',
      description: 'Set up project structure and implement user authentication',
      amount: 3000,
      status: 'RELEASED',
      dueDate: '2024-11-15',
      escrowFunded: true,
      escrowReleasedAt: '2024-11-14',
      order: 1,
      createdAt: '2024-10-15',
      updatedAt: '2024-11-14',
    },
    {
      id: 'ms-2',
      contractId: 'contract-1',
      title: 'Product Catalog & Search',
      description: 'Build product listing, filtering, and search functionality',
      amount: 3000,
      status: 'RELEASED',
      dueDate: '2024-12-01',
      escrowFunded: true,
      escrowReleasedAt: '2024-11-30',
      order: 2,
      createdAt: '2024-10-15',
      updatedAt: '2024-11-30',
    },
    {
      id: 'ms-3',
      contractId: 'contract-1',
      title: 'Shopping Cart & Checkout',
      description: 'Implement cart functionality and Stripe checkout integration',
      amount: 4500,
      status: 'IN_PROGRESS',
      dueDate: '2024-12-20',
      escrowFunded: true,
      order: 3,
      createdAt: '2024-10-15',
      updatedAt: '2024-12-20',
    },
    {
      id: 'ms-4',
      contractId: 'contract-1',
      title: 'Admin Dashboard',
      description: 'Build admin panel for product and order management',
      amount: 3000,
      status: 'PENDING',
      dueDate: '2025-01-10',
      escrowFunded: false,
      order: 4,
      createdAt: '2024-10-15',
      updatedAt: '2024-10-15',
    },
    {
      id: 'ms-5',
      contractId: 'contract-1',
      title: 'Testing & Deployment',
      description: 'Final testing, bug fixes, and production deployment',
      amount: 1500,
      status: 'PENDING',
      dueDate: '2025-02-01',
      escrowFunded: false,
      order: 5,
      createdAt: '2024-10-15',
      updatedAt: '2024-10-15',
    },
  ],
  startDate: '2024-11-01',
  endDate: '2025-02-01',
  createdAt: '2024-10-15',
  updatedAt: '2024-12-20',
};

const mockPaymentInfo = {
  escrowAmount: 3000,
  releasedAmount: 6000,
  pendingAmount: 6000,
  nextPaymentDate: '2024-12-25',
  nextPaymentAmount: 4500,
  transactions: [
    {
      id: 'tx-1',
      type: 'ESCROW_FUNDED' as const,
      amount: 3000,
      status: 'COMPLETED' as const,
      date: '2024-11-01',
      description: 'Milestone 1 funded',
    },
    {
      id: 'tx-2',
      type: 'PAYMENT_RELEASED' as const,
      amount: 3000,
      status: 'COMPLETED' as const,
      date: '2024-11-15',
      description: 'Milestone 1 payment released',
    },
    {
      id: 'tx-3',
      type: 'ESCROW_FUNDED' as const,
      amount: 3000,
      status: 'COMPLETED' as const,
      date: '2024-11-16',
      description: 'Milestone 2 funded',
    },
    {
      id: 'tx-4',
      type: 'PAYMENT_RELEASED' as const,
      amount: 3000,
      status: 'COMPLETED' as const,
      date: '2024-12-01',
      description: 'Milestone 2 payment released',
    },
    {
      id: 'tx-5',
      type: 'ESCROW_FUNDED' as const,
      amount: 3000,
      status: 'COMPLETED' as const,
      date: '2024-12-02',
      description: 'Milestone 3 funded',
    },
  ],
};

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

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.contractId as string;

  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

  // Mock current user role - in real app, get from auth context
  const isFreelancer = true;
  const isClient = false;

  // Mock handlers
  const handleMilestoneSubmit = async (
    _milestoneId: string,
    _data: { message: string; deliverables: unknown[]; attachments: unknown[]; links: unknown[] }
  ) => {
    // Feature: Submit milestone via API - not yet implemented
    setShowSubmissionModal(false);
    setSelectedMilestone(null);
  };

  const handleMilestoneClick = (milestone: Milestone) => {
    if (milestone.status === 'IN_PROGRESS' && isFreelancer) {
      setSelectedMilestone(milestone);
      setShowSubmissionModal(true);
    }
  };

  const fundedMilestones = mockContract.milestones.filter(
    (m) =>
      m.status === 'RELEASED' ||
      m.status === 'APPROVED' ||
      m.status === 'IN_PROGRESS' ||
      m.status === 'SUBMITTED' ||
      m.status === 'FUNDED'
  );
  const unfundedMilestones = mockContract.milestones.filter((m) => m.status === 'PENDING');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <ContractHeader contract={mockContract} />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              {mockContract.type === 'HOURLY' && (
                <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
              )}
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="amendments">Amendments</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-6 space-y-6" value="overview">
              <ContractOverview contract={mockContract} />
            </TabsContent>

            <TabsContent className="mt-6" value="milestones">
              <MilestoneTracker
                isClient={isClient}
                milestones={mockContract.milestones}
                onSubmitMilestone={(id) =>
                  handleMilestoneClick(mockContract.milestones.find((m) => m.id === id)!)
                }
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="timesheet">
              <TimeTracker
                contractId={mockContract.id}
                timeEntries={[]}
                weeklyLimit={mockContract.weeklyLimit || 40}
                isFreelancer={isFreelancer}
                onAddEntry={async () => {}}
                onEditEntry={async () => {}}
                onDeleteEntry={async () => {}}
                onViewDiary={() => {}}
              />
              <WorkDiary
                contractId={mockContract.id}
                timeEntries={[]}
                onDateChange={() => {}}
                onExport={() => {}}
              />
            </TabsContent>

            <TabsContent className="mt-6" value="payments">
              <PaymentStatus
                contract={mockContract}
                payments={{
                  escrowBalance: mockPaymentInfo.escrowAmount,
                  totalPaid: mockPaymentInfo.releasedAmount,
                  pendingAmount: mockPaymentInfo.pendingAmount,
                  nextPaymentDate: mockPaymentInfo.nextPaymentDate,
                  nextPaymentAmount: mockPaymentInfo.nextPaymentAmount,
                  transactions: mockPaymentInfo.transactions,
                }}
                isClient={isClient}
              />
            </TabsContent>

            <TabsContent className="mt-6 space-y-6" value="amendments">
              <AmendmentFlow
                contract={mockContract}
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
                  contract={mockContract}
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
          {mockContract.status === 'PENDING_SIGNATURE' && (
            <ContractSignature
              contract={mockContract}
              userRole={isFreelancer ? 'freelancer' : 'client'}
              onSign={async () => {}}
              onCancel={() => {}}
            />
          )}

          {/* Escrow Widget */}
          <EscrowWidget
            escrowBalance={mockContract.escrowBalance}
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
