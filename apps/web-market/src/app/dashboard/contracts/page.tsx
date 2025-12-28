/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Filter,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Suspense } from 'react';

import type { Contract, ContractStatus } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface ContractSummary {
  totalActive: number;
  totalEarnings: number;
  totalHoursThisWeek: number;
  pendingMilestones: number;
}

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: PlayCircle },
  PAUSED: { label: 'Paused', color: 'bg-blue-100 text-blue-700', icon: PauseCircle },
  COMPLETED: { label: 'Completed', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

// ============================================================================
// Mock Data (Replace with API call)
// ============================================================================

const mockSummary: ContractSummary = {
  totalActive: 5,
  totalEarnings: 12450,
  totalHoursThisWeek: 32,
  pendingMilestones: 3,
};

const mockContracts: Contract[] = [
  {
    id: 'contract-1',
    jobId: 'job-1',
    proposalId: 'proposal-1',
    clientId: 'client-1',
    clientName: 'TechCorp Inc.',
    clientAvatar: undefined,
    freelancerId: 'freelancer-1',
    freelancerName: 'John Developer',
    freelancerAvatar: undefined,
    title: 'E-commerce Platform Development',
    description: 'Build a full-featured e-commerce platform with React and Node.js',
    type: 'FIXED',
    status: 'ACTIVE',
    totalBudget: 15000,
    amountEarned: 9000,
    amountInEscrow: 3000,
    hourlyRate: undefined,
    weeklyHourLimit: undefined,
    milestones: [],
    startDate: '2024-11-01',
    endDate: '2025-02-01',
    createdAt: '2024-10-15',
    updatedAt: '2024-12-20',
  },
  {
    id: 'contract-2',
    jobId: 'job-2',
    proposalId: 'proposal-2',
    clientId: 'client-2',
    clientName: 'StartupXYZ',
    clientAvatar: undefined,
    freelancerId: 'freelancer-1',
    freelancerName: 'John Developer',
    freelancerAvatar: undefined,
    title: 'Mobile App UI/UX Design',
    description: 'Design beautiful and intuitive mobile app interfaces',
    type: 'HOURLY',
    status: 'ACTIVE',
    totalBudget: 5000,
    amountEarned: 2400,
    amountInEscrow: 800,
    hourlyRate: 75,
    weeklyHourLimit: 20,
    milestones: [],
    startDate: '2024-12-01',
    endDate: undefined,
    createdAt: '2024-11-28',
    updatedAt: '2024-12-22',
  },
  {
    id: 'contract-3',
    jobId: 'job-3',
    proposalId: 'proposal-3',
    clientId: 'client-3',
    clientName: 'GlobalFinance',
    clientAvatar: undefined,
    freelancerId: 'freelancer-1',
    freelancerName: 'John Developer',
    freelancerAvatar: undefined,
    title: 'API Integration Project',
    description: 'Integrate third-party payment APIs',
    type: 'FIXED',
    status: 'COMPLETED',
    totalBudget: 4500,
    amountEarned: 4500,
    amountInEscrow: 0,
    hourlyRate: undefined,
    weeklyHourLimit: undefined,
    milestones: [],
    startDate: '2024-09-01',
    endDate: '2024-11-15',
    createdAt: '2024-08-20',
    updatedAt: '2024-11-15',
  },
];

// ============================================================================
// Summary Cards
// ============================================================================

function SummaryCards({ summary }: Readonly<{ summary: ContractSummary }>) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="bg-primary/10 rounded-full p-3">
            <FileText className="text-primary h-6 w-6" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Active Contracts</p>
            <p className="text-2xl font-bold">{summary.totalActive}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-green-100 p-3 dark:bg-green-950">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Total Earnings</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalEarnings)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-950">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Hours This Week</p>
            <p className="text-2xl font-bold">{summary.totalHoursThisWeek}h</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-950">
            <TrendingUp className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Pending Milestones</p>
            <p className="text-2xl font-bold">{summary.pendingMilestones}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Contract Card
// ============================================================================

function ContractCard({ contract }: Readonly<{ contract: Contract }>) {
  const statusConfig = STATUS_CONFIG[contract.status];
  const StatusIcon = statusConfig.icon;

  const progress =
    contract.totalBudget > 0 ? Math.round((contract.amountEarned / contract.totalBudget) * 100) : 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <a
      className="block transition-shadow hover:shadow-md"
      href={`/dashboard/contracts/${contract.id}`}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold">{contract.title}</h3>
                <Badge className={cn('flex-shrink-0', statusConfig.color)}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{contract.clientName}</p>
            </div>
            <Button className="flex-shrink-0" size="icon" variant="ghost">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {/* Contract Type & Rate */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline">{contract.type === 'FIXED' ? 'Fixed Price' : 'Hourly'}</Badge>
            {contract.hourlyRate && (
              <span className="text-muted-foreground">
                {formatCurrency(contract.hourlyRate)}/hr
              </span>
            )}
            {contract.weeklyHourLimit && (
              <span className="text-muted-foreground">Up to {contract.weeklyHourLimit}h/week</span>
            )}
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(contract.amountEarned)} earned
              </span>
              <span className="font-medium">{formatCurrency(contract.totalBudget)} total</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Escrow & Dates */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            {contract.amountInEscrow > 0 && (
              <span className="text-green-600">
                {formatCurrency(contract.amountInEscrow)} in escrow
              </span>
            )}
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(contract.startDate)}
              {contract.endDate && ` - ${formatDate(contract.endDate)}`}
            </div>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

// ============================================================================
// Contracts List
// ============================================================================

function ContractsList({ contracts }: Readonly<{ contracts: Contract[] }>) {
  if (contracts.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="text-muted-foreground mx-auto h-12 w-12" />
        <h3 className="mt-4 font-semibold">No contracts found</h3>
        <p className="text-muted-foreground mt-1">
          Start by accepting a proposal to create a contract
        </p>
        <Button asChild className="mt-4">
          <a href="/dashboard/proposals">View Proposals</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contracts.map((contract) => (
        <ContractCard key={contract.id} contract={contract} />
      ))}
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function ContractsPage() {
  const activeContracts = mockContracts.filter((c) => ['ACTIVE', 'PENDING'].includes(c.status));
  const completedContracts = mockContracts.filter((c) => c.status === 'COMPLETED');
  const allContracts = mockContracts;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Contracts</h1>
          <p className="text-muted-foreground">Manage your active and past contracts</p>
        </div>
        <Button asChild>
          <a href="/jobs">
            <Plus className="mr-2 h-4 w-4" />
            Find New Work
          </a>
        </Button>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={mockSummary} />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input className="pl-9" placeholder="Search contracts..." />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Contract Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="fixed">Fixed Price</SelectItem>
            <SelectItem value="hourly">Hourly</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          More Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active
            <Badge className="ml-2" variant="secondary">
              {activeContracts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <Badge className="ml-2" variant="secondary">
              {completedContracts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            <Badge className="ml-2" variant="secondary">
              {allContracts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="active">
          <Suspense fallback={<div>Loading...</div>}>
            <ContractsList contracts={activeContracts} />
          </Suspense>
        </TabsContent>

        <TabsContent className="mt-6" value="completed">
          <Suspense fallback={<div>Loading...</div>}>
            <ContractsList contracts={completedContracts} />
          </Suspense>
        </TabsContent>

        <TabsContent className="mt-6" value="all">
          <Suspense fallback={<div>Loading...</div>}>
            <ContractsList contracts={allContracts} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
