/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

/**
 * ContractOverview Component
 *
 * Displays contract summary with status, parties, value,
 * and key dates. Used on contract detail pages.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Progress,
} from '@skillancer/ui';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  Calendar,
  DollarSign,
  Clock,
  User,
  Building2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from 'lucide-react';

import {
  type Contract,
  getContractStatusInfo,
  calculateContractProgress,
} from '@/lib/api/contracts';

interface ContractOverviewProps {
  contract: Contract;
  onSignContract?: () => void;
  onViewMessages?: () => void;
  onOpenDispute?: () => void;
  isClient?: boolean;
}

const statusIcons = {
  DRAFT: FileText,
  PENDING_SIGNATURE: AlertCircle,
  ACTIVE: CheckCircle2,
  PAUSED: PauseCircle,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  DISPUTED: AlertCircle,
};

export function ContractOverview({
  contract,
  onSignContract,
  onViewMessages,
  onOpenDispute,
  isClient = true,
}: Readonly<ContractOverviewProps>) {
  const statusInfo = getContractStatusInfo(contract.status);
  const progress = calculateContractProgress(contract);
  const StatusIcon = statusIcons[contract.status];
  const otherParty = isClient ? contract.freelancer : contract.client;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  const needsSignature =
    contract.status === 'PENDING_SIGNATURE' &&
    ((isClient && !contract.clientSignature) || (!isClient && !contract.freelancerSignature));

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {contract.status === 'DISPUTED' && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertCircle className="text-destructive h-5 w-5" />
            <div className="flex-1">
              <p className="text-destructive text-sm font-medium">
                This contract is currently in dispute
              </p>
              <p className="text-muted-foreground text-xs">
                A mediator has been assigned to resolve this issue
              </p>
            </div>
            <Button size="sm" variant="outline">
              View Dispute
            </Button>
          </CardContent>
        </Card>
      )}

      {needsSignature && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <FileText className="text-primary h-5 w-5" />
            <div className="flex-1">
              <p className="text-primary text-sm font-medium">Your signature is required</p>
              <p className="text-muted-foreground text-xs">
                Please review and sign the contract to proceed
              </p>
            </div>
            <Button size="sm" onClick={onSignContract}>
              Sign Contract
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{contract.title}</CardTitle>
              <CardDescription>Contract #{contract.id.slice(0, 8)}</CardDescription>
            </div>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{progress.percentage}%</span>
            </div>
            <Progress className="h-2" value={progress.percentage} />
            <p className="text-muted-foreground text-xs">
              {progress.completedMilestones} of {progress.totalMilestones} milestones completed
            </p>
          </div>

          <Separator />

          {/* Key Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4" />
                <span>Contract Value</span>
              </div>
              <p className="text-lg font-semibold">{formatCurrency(contract.amount)}</p>
              <p className="text-muted-foreground text-xs">
                {contract.type === 'FIXED' ? 'Fixed Price' : 'Hourly Rate'}
              </p>
            </div>

            {contract.type === 'HOURLY' && (
              <div className="space-y-1">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>Weekly Limit</span>
                </div>
                <p className="text-lg font-semibold">{contract.weeklyHoursLimit || 40} hrs/week</p>
                <p className="text-muted-foreground text-xs">
                  ${contract.hourlyRate?.toFixed(2)}/hr
                </p>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Start Date</span>
              </div>
              <p className="text-lg font-semibold">
                {new Date(contract.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              {contract.endDate && (
                <p className="text-muted-foreground text-xs">
                  Ends{' '}
                  {new Date(contract.endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <StatusIcon className="h-4 w-4" />
                <span>Status</span>
              </div>
              <p className="text-lg font-semibold">{statusInfo.label}</p>
              <p className="text-muted-foreground text-xs">
                Updated {formatDistanceToNow(new Date(contract.updatedAt))} ago
              </p>
            </div>
          </div>

          <Separator />

          {/* Escrow Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="mb-3 text-sm font-medium">Escrow Balance</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">Funded</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(contract.escrowDetails?.funded ?? contract.escrowBalance)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Released</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(contract.escrowDetails?.released ?? contract.totalPaid)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pending</p>
                <p className="text-lg font-semibold text-amber-600">
                  {formatCurrency(contract.escrowDetails?.pending ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Other Party */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage alt={otherParty.name} src={otherParty.avatarUrl} />
                <AvatarFallback>
                  {otherParty.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{otherParty.name}</p>
                <p className="text-muted-foreground text-sm">
                  {isClient ? 'Freelancer' : 'Client'}
                  {otherParty.company && ` at ${otherParty.company}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onViewMessages}>
                Message
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={`/freelancers/${otherParty.id}`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  View Profile
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {contract.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap text-sm">
              {contract.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contract Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Payment Terms</p>
              <p className="font-medium">{contract.paymentTerms || 'Upon milestone completion'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Notice Period</p>
              <p className="font-medium">{contract.noticePeriodDays || 14} days</p>
            </div>
            {contract.skillPodEnabled && (
              <div>
                <p className="text-muted-foreground text-sm">SkillPod Tracking</p>
                <p className="font-medium text-green-600">Enabled</p>
              </div>
            )}
          </div>

          {/* Signatures */}
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Client Signature</span>
              </div>
              {contract.clientSignature ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">
                    Signed on {new Date(contract.clientSignature.signedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Pending signature</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Freelancer Signature</span>
              </div>
              {contract.freelancerSignature ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">
                    Signed on {new Date(contract.freelancerSignature.signedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Pending signature</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {contract.status === 'ACTIVE' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline">
                Request Amendment
              </Button>
              <Button size="sm" variant="outline">
                Download Contract PDF
              </Button>
              <Button
                className="text-destructive hover:text-destructive"
                size="sm"
                variant="outline"
                onClick={onOpenDispute}
              >
                Open Dispute
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
