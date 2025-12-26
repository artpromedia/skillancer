/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument */
'use client';

import { Badge, Button, Card, CardContent, CardHeader, cn } from '@skillancer/ui';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  ExternalLink,
  Loader2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

import type { Contract, PaymentInfo } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface PaymentStatusProps {
  contract: Contract;
  payments: PaymentInfo;
  isClient: boolean;
  onAddFunds?: () => void;
  onWithdraw?: () => void;
}

// ============================================================================
// Payment Status Component
// ============================================================================

export function PaymentStatus({
  contract,
  payments,
  isClient,
  onAddFunds,
  onWithdraw,
}: PaymentStatusProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <DollarSign className="h-5 w-5" />
            Payment Status
          </h3>
          <Link
            className="text-primary flex items-center gap-1 text-sm hover:underline"
            href={`/dashboard/transactions?contract=${contract.id}`}
          >
            Transaction History
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Escrow Balance */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900/30">
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-muted-foreground text-sm">In Escrow</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(payments.escrowBalance)}</p>
            <p className="text-muted-foreground text-xs">Protected funds</p>
          </div>

          {/* Released */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-green-100 p-1.5 dark:bg-green-900/30">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-muted-foreground text-sm">Released</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(payments.releasedAmount)}</p>
            <p className="text-muted-foreground text-xs">Paid to freelancer</p>
          </div>

          {/* Pending */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-muted-foreground text-sm">Pending</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(payments.pendingAmount)}</p>
            <p className="text-muted-foreground text-xs">Awaiting approval</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Contract Progress</span>
            <span className="font-medium">
              {formatCurrency(payments.releasedAmount)} / {formatCurrency(contract.amount || 0)}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{
                width: `${Math.min(100, (payments.releasedAmount / (contract.amount || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Payment Schedule */}
        {payments.nextPayment && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-muted-foreground text-sm">Next Scheduled Payment</p>
              <p className="font-semibold">{formatCurrency(payments.nextPayment.amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-sm">Due Date</p>
              <p className="font-medium">
                {new Date(payments.nextPayment.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t pt-4">
          {isClient ? (
            <Button className="flex-1" onClick={onAddFunds}>
              <CreditCard className="mr-2 h-4 w-4" />
              Add Funds
            </Button>
          ) : (
            <Button className="flex-1" onClick={onWithdraw}>
              <ArrowDownRight className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/payments">View All Payments</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Transaction List Component
// ============================================================================

interface Transaction {
  id: string;
  type: 'ESCROW_FUNDED' | 'MILESTONE_RELEASED' | 'BONUS' | 'REFUND' | 'WITHDRAWAL';
  amount: number;
  description: string;
  createdAt: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
}

export function TransactionList({ transactions, limit = 5 }: TransactionListProps) {
  const displayTransactions = limit ? transactions.slice(0, limit) : transactions;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'ESCROW_FUNDED':
        return <ArrowUpRight className="h-4 w-4 text-blue-600" />;
      case 'MILESTONE_RELEASED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'BONUS':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'REFUND':
        return <ArrowDownRight className="h-4 w-4 text-amber-600" />;
      case 'WITHDRAWAL':
        return <Wallet className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'ESCROW_FUNDED':
        return 'Escrow Funded';
      case 'MILESTONE_RELEASED':
        return 'Milestone Released';
      case 'BONUS':
        return 'Bonus Payment';
      case 'REFUND':
        return 'Refund';
      case 'WITHDRAWAL':
        return 'Withdrawal';
      default:
        return type;
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <DollarSign className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayTransactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              {getTransactionIcon(transaction.type)}
            </div>
            <div>
              <p className="font-medium">{getTransactionLabel(transaction.type)}</p>
              <p className="text-muted-foreground text-sm">{transaction.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p
              className={cn(
                'font-semibold',
                transaction.type === 'REFUND' || transaction.type === 'WITHDRAWAL'
                  ? 'text-red-600'
                  : 'text-green-600'
              )}
            >
              {transaction.type === 'REFUND' || transaction.type === 'WITHDRAWAL' ? '-' : '+'}
              {formatCurrency(transaction.amount)}
            </p>
            <p className="text-muted-foreground text-xs">
              {new Date(transaction.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}

      {limit && transactions.length > limit && (
        <Link
          className="text-primary block text-center text-sm hover:underline"
          href="/dashboard/transactions"
        >
          View all {transactions.length} transactions
        </Link>
      )}
    </div>
  );
}
