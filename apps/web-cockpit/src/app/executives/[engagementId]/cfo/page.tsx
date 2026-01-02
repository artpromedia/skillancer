/**
 * CFO Dashboard Page
 *
 * Comprehensive CFO dashboard with:
 * - Cash position and runway
 * - Financial metrics (AR/AP, P&L)
 * - Cash flow visualization
 * - Quick actions for board decks and investor updates
 */

'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  Send,
  PieChart,
  BarChart3,
  Wallet,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Plus,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  AccountsReceivableWidget,
  AccountsPayableWidget,
  PLSummaryWidget,
} from '@/components/cfo/arap-pl-widgets';
import { CashFlowChart } from '@/components/cfo/cash-flow-chart';
import { CashPositionWidget, RunwayWidget } from '@/components/cfo/cash-runway-widgets';

// Mock data
const mockFinancialData = {
  cashPosition: {
    totalCash: 2450000,
    change: 5.2,
    accounts: [
      { name: 'Operating Account', balance: 1850000, type: 'checking' },
      { name: 'Savings Reserve', balance: 500000, type: 'savings' },
      { name: 'Payroll Account', balance: 100000, type: 'checking' },
    ],
  },
  runway: {
    months: 18,
    burnRate: 125000,
    zeroCashDate: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000),
  },
  accountsReceivable: {
    total: 425000,
    current: 280000,
    overdue30: 95000,
    overdue60: 35000,
    overdue90: 15000,
    change: -8.5,
  },
  accountsPayable: {
    total: 185000,
    dueSoon: 75000,
    overdue: 12000,
    change: 3.2,
  },
  profitLoss: {
    revenue: 850000,
    expenses: 725000,
    netIncome: 125000,
    revenueChange: 12.5,
    expenseChange: 8.3,
  },
  cashFlow: [
    { period: 'Jan', inflows: 280000, outflows: 245000, net: 35000, balance: 2100000 },
    { period: 'Feb', inflows: 310000, outflows: 265000, net: 45000, balance: 2145000 },
    { period: 'Mar', inflows: 295000, outflows: 280000, net: 15000, balance: 2160000 },
    { period: 'Apr', inflows: 340000, outflows: 290000, net: 50000, balance: 2210000 },
    { period: 'May', inflows: 380000, outflows: 310000, net: 70000, balance: 2280000 },
    { period: 'Jun', inflows: 420000, outflows: 250000, net: 170000, balance: 2450000 },
  ],
  recentBoardDecks: [
    {
      id: '1',
      title: 'Q2 2024 Board Deck',
      period: 'Q2 2024',
      status: 'SENT',
      createdAt: '2024-06-15',
    },
    {
      id: '2',
      title: 'Q1 2024 Board Deck',
      period: 'Q1 2024',
      status: 'ARCHIVED',
      createdAt: '2024-03-15',
    },
  ],
  recentInvestorUpdates: [
    {
      id: '1',
      subject: 'June 2024 Monthly Update',
      period: 'June 2024',
      status: 'SENT',
      sentAt: '2024-06-30',
    },
    {
      id: '2',
      subject: 'May 2024 Monthly Update',
      period: 'May 2024',
      status: 'SENT',
      sentAt: '2024-05-31',
    },
  ],
};

export default function CFODashboardPage() {
  const params = useParams();
  const engagementId = params.engagementId as string;
  const [activeTab, setActiveTab] = useState('overview');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <Badge className="bg-green-500" variant="default">
            Sent
          </Badge>
        );
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'SCHEDULED':
        return (
          <Badge className="text-blue-600" variant="outline">
            Scheduled
          </Badge>
        );
      case 'ARCHIVED':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/executives/${engagementId}`}>
            <Button size="icon" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">CFO Dashboard</h1>
            <p className="text-muted-foreground">Financial overview and reporting tools</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/executives/${engagementId}/cfo/board-deck/new`}>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              New Board Deck
            </Button>
          </Link>
          <Link href={`/executives/${engagementId}/cfo/investor-update/new`}>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Investor Update
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="board-decks">Board Decks</TabsTrigger>
          <TabsTrigger value="investor-updates">Investor Updates</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent className="space-y-6" value="overview">
          {/* Top Row - Key Metrics */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <CashPositionWidget
              accounts={mockFinancialData.cashPosition.accounts}
              change={mockFinancialData.cashPosition.change}
              totalCash={mockFinancialData.cashPosition.totalCash}
            />
            <RunwayWidget
              burnRate={mockFinancialData.runway.burnRate}
              months={mockFinancialData.runway.months}
              zeroCashDate={mockFinancialData.runway.zeroCashDate}
            />
            <AccountsReceivableWidget
              change={mockFinancialData.accountsReceivable.change}
              current={mockFinancialData.accountsReceivable.current}
              overdue30={mockFinancialData.accountsReceivable.overdue30}
              overdue60={mockFinancialData.accountsReceivable.overdue60}
              overdue90={mockFinancialData.accountsReceivable.overdue90}
              total={mockFinancialData.accountsReceivable.total}
            />
            <AccountsPayableWidget
              change={mockFinancialData.accountsPayable.change}
              dueSoon={mockFinancialData.accountsPayable.dueSoon}
              overdue={mockFinancialData.accountsPayable.overdue}
              total={mockFinancialData.accountsPayable.total}
            />
          </div>

          {/* Cash Flow Chart */}
          <CashFlowChart data={mockFinancialData.cashFlow} title="Cash Flow (Last 6 Months)" />

          {/* P&L Summary */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PLSummaryWidget
              data={{
                revenue: mockFinancialData.profitLoss.revenue,
                previousRevenue:
                  mockFinancialData.profitLoss.revenue *
                  (1 - mockFinancialData.profitLoss.revenueChange / 100),
                cogs: 0,
                grossProfit:
                  mockFinancialData.profitLoss.revenue - mockFinancialData.profitLoss.expenses,
                grossMargin:
                  ((mockFinancialData.profitLoss.revenue - mockFinancialData.profitLoss.expenses) /
                    mockFinancialData.profitLoss.revenue) *
                  100,
                operatingExpenses: mockFinancialData.profitLoss.expenses,
                operatingIncome: mockFinancialData.profitLoss.netIncome,
                netIncome: mockFinancialData.profitLoss.netIncome,
                netMargin:
                  (mockFinancialData.profitLoss.netIncome / mockFinancialData.profitLoss.revenue) *
                  100,
                period: 'Current Period',
              }}
            />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline">
                  <PieChart className="mr-2 h-4 w-4" />
                  Generate Cash Flow Forecast
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Run Scenario Analysis
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Financial Report
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Review Runway Scenarios
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Recent Board Decks */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">Recent Board Decks</CardTitle>
                <Link href={`/executives/${engagementId}/cfo/board-decks`}>
                  <Button size="sm" variant="ghost">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockFinancialData.recentBoardDecks.map((deck) => (
                    <div
                      key={deck.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{deck.title}</p>
                        <p className="text-muted-foreground text-xs">{deck.period}</p>
                      </div>
                      {getStatusBadge(deck.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Investor Updates */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium">Recent Investor Updates</CardTitle>
                <Link href={`/executives/${engagementId}/cfo/investor-updates`}>
                  <Button size="sm" variant="ghost">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockFinancialData.recentInvestorUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{update.subject}</p>
                        <p className="text-muted-foreground text-xs">{update.sentAt}</p>
                      </div>
                      {getStatusBadge(update.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecasts Tab */}
        <TabsContent className="space-y-4" value="forecasts">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Forecasts</CardTitle>
              <CardDescription>Create and manage cash flow projections</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <PieChart className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 font-medium">Create Your First Forecast</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Set up revenue and expense assumptions to project your cash flow.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Forecast
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Board Decks Tab */}
        <TabsContent className="space-y-4" value="board-decks">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Board Decks</h2>
            <Link href={`/executives/${engagementId}/cfo/board-deck/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Board Deck
              </Button>
            </Link>
          </div>
          <div className="grid gap-4">
            {mockFinancialData.recentBoardDecks.map((deck) => (
              <Card key={deck.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <FileText className="text-muted-foreground h-8 w-8" />
                    <div>
                      <h3 className="font-medium">{deck.title}</h3>
                      <p className="text-muted-foreground text-sm">Created {deck.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(deck.status)}
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Investor Updates Tab */}
        <TabsContent className="space-y-4" value="investor-updates">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Investor Updates</h2>
            <Link href={`/executives/${engagementId}/cfo/investor-update/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Update
              </Button>
            </Link>
          </div>
          <div className="grid gap-4">
            {mockFinancialData.recentInvestorUpdates.map((update) => (
              <Card key={update.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <Send className="text-muted-foreground h-8 w-8" />
                    <div>
                      <h3 className="font-medium">{update.subject}</h3>
                      <p className="text-muted-foreground text-sm">Sent {update.sentAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(update.status)}
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Budgets Tab */}
        <TabsContent className="space-y-4" value="budgets">
          <Card>
            <CardHeader>
              <CardTitle>Budget Management</CardTitle>
              <CardDescription>Create and track annual budgets</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <Wallet className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 font-medium">No Budgets Yet</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Create a budget to track spending against targets.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Budget
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
