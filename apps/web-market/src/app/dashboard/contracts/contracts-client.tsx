/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

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
  Skeleton,
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
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Contract, ContractStatus } from '@/lib/api/contracts';

import { useMyContracts, useContractStats, usePrefetchContract } from '@/hooks/use-contracts';

// ============================================================================
// Types
// ============================================================================

type TabValue = 'active' | 'completed' | 'all';

interface ContractSummary {
  totalActive: number;
  totalEarnings: number;
  totalHoursThisWeek: number;
  pendingMilestones: number;
  escrowBalance: number;
  completedContracts: number;
}

// ============================================================================
// Status Config
// ============================================================================

const STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDING_SIGNATURE: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: PlayCircle },
  PAUSED: { label: 'Paused', color: 'bg-blue-100 text-blue-700', icon: PauseCircle },
  COMPLETED: { label: 'Completed', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

// ============================================================================
// Summary Cards
// ============================================================================

function SummaryCards({
  summary,
  isLoading,
}: Readonly<{ summary?: ContractSummary; isLoading: boolean }>) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = summary ?? {
    totalActive: 0,
    totalEarnings: 0,
    totalHoursThisWeek: 0,
    pendingMilestones: 0,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="bg-primary/10 rounded-full p-3">
            <FileText className="text-primary h-6 w-6" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Active Contracts</p>
            <p className="text-2xl font-bold">{stats.totalActive}</p>
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
            <p className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</p>
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
            <p className="text-2xl font-bold">{stats.totalHoursThisWeek}h</p>
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
            <p className="text-2xl font-bold">{stats.pendingMilestones}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Contract Card
// ============================================================================

function ContractCard({
  contract,
  onHover,
}: Readonly<{ contract: Contract; onHover?: (id: string) => void }>) {
  const statusConfig = STATUS_CONFIG[contract.status];
  const StatusIcon = statusConfig.icon;

  const progress =
    contract.amount > 0 ? Math.round((contract.totalPaid / contract.amount) * 100) : 0;

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
    <Link
      className="block transition-shadow hover:shadow-md"
      href={`/dashboard/contracts/${contract.id}`}
      onMouseEnter={() => onHover?.(contract.id)}
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
              <p className="text-muted-foreground mt-1 text-sm">{contract.client.name}</p>
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
            {contract.weeklyLimit && (
              <span className="text-muted-foreground">Up to {contract.weeklyLimit}h/week</span>
            )}
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(contract.totalPaid)} earned
              </span>
              <span className="font-medium">{formatCurrency(contract.amount)} total</span>
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
            {contract.escrowBalance > 0 && (
              <span className="text-green-600">
                {formatCurrency(contract.escrowBalance)} in escrow
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
    </Link>
  );
}

// ============================================================================
// Contract Card Skeleton
// ============================================================================

function ContractCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="mt-4 flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Contracts List
// ============================================================================

function ContractsList({
  contracts,
  isLoading,
  onHover,
}: Readonly<{
  contracts: Contract[];
  isLoading: boolean;
  onHover?: (id: string) => void;
}>) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ContractCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="text-muted-foreground mx-auto h-12 w-12" />
        <h3 className="mt-4 font-semibold">No contracts found</h3>
        <p className="text-muted-foreground mt-1">
          Start by accepting a proposal to create a contract
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/proposals">View Proposals</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contracts.map((contract) => (
        <ContractCard key={contract.id} contract={contract} onHover={onHover} />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractsClient() {
  const [activeTab, setActiveTab] = useState<TabValue>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Fetch contracts
  const { contracts, isLoading, isFetching, error, hasMore, loadMore, refetch } = useMyContracts({
    search: searchQuery || undefined,
    type: typeFilter !== 'all' ? (typeFilter as 'FIXED' | 'HOURLY') : undefined,
  });

  // Fetch stats
  const { stats, isLoading: isLoadingStats } = useContractStats();

  // Prefetch for hover
  const prefetch = usePrefetchContract();

  // Filter contracts by tab
  const filteredContracts = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return contracts.filter((c) =>
          ['ACTIVE', 'PENDING_SIGNATURE', 'PAUSED'].includes(c.status)
        );
      case 'completed':
        return contracts.filter((c) => c.status === 'COMPLETED');
      default:
        return contracts;
    }
  }, [contracts, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      active: contracts.filter((c) => ['ACTIVE', 'PENDING_SIGNATURE', 'PAUSED'].includes(c.status))
        .length,
      completed: contracts.filter((c) => c.status === 'COMPLETED').length,
      all: contracts.length,
    };
  }, [contracts]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Contracts</h1>
          <p className="text-muted-foreground">Manage your active and past contracts</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={isFetching} size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/jobs">
              <Plus className="mr-2 h-4 w-4" />
              Find New Work
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Failed to load contracts</p>
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <SummaryCards isLoading={isLoadingStats} summary={stats} />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Contract Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="FIXED">Fixed Price</SelectItem>
            <SelectItem value="HOURLY">Hourly</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          More Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="active">
            Active
            <Badge className="ml-2" variant="secondary">
              {tabCounts.active}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <Badge className="ml-2" variant="secondary">
              {tabCounts.completed}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            <Badge className="ml-2" variant="secondary">
              {tabCounts.all}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="active">
          <ContractsList contracts={filteredContracts} isLoading={isLoading} onHover={prefetch} />
        </TabsContent>

        <TabsContent className="mt-6" value="completed">
          <ContractsList contracts={filteredContracts} isLoading={isLoading} onHover={prefetch} />
        </TabsContent>

        <TabsContent className="mt-6" value="all">
          <ContractsList contracts={filteredContracts} isLoading={isLoading} onHover={prefetch} />
        </TabsContent>
      </Tabs>

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-4">
          <Button disabled={isFetching} variant="outline" onClick={loadMore}>
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Contracts'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
