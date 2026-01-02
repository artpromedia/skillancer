'use client';

/**
 * HR Compliance Page
 *
 * Manage HR compliance items including training, filings, policies, and audits.
 * Provides calendar view, list view, and compliance score tracking.
 *
 * @module app/clients/[clientId]/hr-compliance/page
 */

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@skillancer/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@skillancer/ui/dropdown-menu';
import { Input } from '@skillancer/ui/input';
import { Progress } from '@skillancer/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import {
  ShieldCheck,
  Plus,
  Filter,
  Calendar,
  List,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit,
  Flag,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type ComplianceCategory =
  | 'TRAINING'
  | 'FILING'
  | 'POLICY'
  | 'AUDIT'
  | 'BENEFITS'
  | 'SAFETY'
  | 'OTHER';
type ComplianceStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'OVERDUE' | 'NOT_APPLICABLE';
type ComplianceFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'AS_NEEDED';

interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  category: ComplianceCategory;
  jurisdiction: string;
  dueDate?: string;
  frequency: ComplianceFrequency;
  status: ComplianceStatus;
  ownerId?: string;
  ownerName?: string;
  affectedCount?: number;
  notes?: string;
  completedAt?: string;
}

// ============================================================================
// Constants
// ============================================================================

const categoryConfig: Record<
  ComplianceCategory,
  { label: string; color: string; icon: typeof ShieldCheck }
> = {
  TRAINING: { label: 'Training', color: 'bg-purple-100 text-purple-700', icon: FileText },
  FILING: { label: 'Filing', color: 'bg-blue-100 text-blue-700', icon: FileText },
  POLICY: { label: 'Policy', color: 'bg-green-100 text-green-700', icon: ShieldCheck },
  AUDIT: { label: 'Audit', color: 'bg-orange-100 text-orange-700', icon: ShieldCheck },
  BENEFITS: { label: 'Benefits', color: 'bg-cyan-100 text-cyan-700', icon: FileText },
  SAFETY: { label: 'Safety', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  OTHER: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: FileText },
};

const statusConfig: Record<
  ComplianceStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof CheckCircle2;
  }
> = {
  NOT_STARTED: { label: 'Not Started', variant: 'outline', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', variant: 'default', icon: Clock },
  COMPLETE: { label: 'Complete', variant: 'secondary', icon: CheckCircle2 },
  OVERDUE: { label: 'Overdue', variant: 'destructive', icon: AlertTriangle },
  NOT_APPLICABLE: { label: 'N/A', variant: 'outline', icon: FileText },
};

const frequencyLabels: Record<ComplianceFrequency, string> = {
  ONE_TIME: 'One-time',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
  AS_NEEDED: 'As Needed',
};

// ============================================================================
// Sample Data
// ============================================================================

const sampleItems: ComplianceItem[] = [
  {
    id: '1',
    title: 'Sexual Harassment Prevention Training',
    description: 'Annual mandatory training for all California employees',
    category: 'TRAINING',
    jurisdiction: 'CA',
    dueDate: '2026-01-15',
    frequency: 'ANNUAL',
    status: 'IN_PROGRESS',
    ownerName: 'HR Manager',
    affectedCount: 45,
  },
  {
    id: '2',
    title: 'EEO-1 Report Filing',
    description: 'Annual employment data report for employers with 100+ employees',
    category: 'FILING',
    jurisdiction: 'Federal',
    dueDate: '2026-03-31',
    frequency: 'ANNUAL',
    status: 'NOT_STARTED',
    ownerName: 'HR Director',
    affectedCount: 127,
  },
  {
    id: '3',
    title: 'I-9 Audit',
    description: 'Internal audit of I-9 forms for compliance',
    category: 'AUDIT',
    jurisdiction: 'Federal',
    dueDate: '2025-12-15',
    frequency: 'ANNUAL',
    status: 'OVERDUE',
    ownerName: 'Compliance Officer',
    affectedCount: 127,
  },
  {
    id: '4',
    title: 'Benefits Open Enrollment Communication',
    description: 'Send open enrollment notifications to all employees',
    category: 'BENEFITS',
    jurisdiction: 'Federal',
    dueDate: '2026-01-31',
    frequency: 'ANNUAL',
    status: 'NOT_STARTED',
    ownerName: 'Benefits Admin',
    affectedCount: 127,
  },
  {
    id: '5',
    title: 'OSHA 300 Log Posting',
    description: 'Post OSHA Form 300A summary in visible workplace location',
    category: 'SAFETY',
    jurisdiction: 'Federal',
    dueDate: '2026-02-01',
    frequency: 'ANNUAL',
    status: 'NOT_STARTED',
    ownerName: 'Safety Manager',
  },
];

// ============================================================================
// Components
// ============================================================================

function ComplianceScoreCard({
  score,
  byStatus,
}: {
  score: number;
  byStatus: { complete: number; inProgress: number; notStarted: number; overdue: number };
}) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-green-600';
    if (s >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}%</div>
          <Progress className="h-3 flex-1" value={score} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="text-lg font-semibold text-green-600">{byStatus.complete}</p>
            <p className="text-muted-foreground">Complete</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-blue-600">{byStatus.inProgress}</p>
            <p className="text-muted-foreground">In Progress</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-600">{byStatus.notStarted}</p>
            <p className="text-muted-foreground">Not Started</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-600">{byStatus.overdue}</p>
            <p className="text-muted-foreground">Overdue</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceItemRow({
  item,
  onEdit,
  onDelete,
  onComplete,
}: {
  item: ComplianceItem;
  onEdit: (item: ComplianceItem) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const category = categoryConfig[item.category];
  const status = statusConfig[item.status];
  const CategoryIcon = category.icon;
  const StatusIcon = status.icon;
  const isOverdue = item.status === 'OVERDUE';

  return (
    <div
      className={`rounded-lg border p-4 ${isOverdue ? 'border-red-200 bg-red-50/50' : 'bg-white'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${category.color}`}>
            <CategoryIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{item.title}</h3>
              {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            {item.description && (
              <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
            )}
            <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                {item.jurisdiction}
              </span>
              {item.dueDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due: {new Date(item.dueDate).toLocaleDateString()}
                </span>
              )}
              <span>{frequencyLabels[item.frequency]}</span>
              {item.affectedCount && <span>{item.affectedCount} employees</span>}
              {item.ownerName && <span>Owner: {item.ownerName}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.status !== 'COMPLETE' && (
                <DropdownMenuItem onClick={() => onComplete(item.id)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(item.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ items }: { items: ComplianceItem[] }) {
  // Group items by month
  const itemsByMonth: Record<string, ComplianceItem[]> = {};
  items.forEach((item) => {
    if (item.dueDate) {
      const monthKey = item.dueDate.substring(0, 7); // "2026-01"
      if (!itemsByMonth[monthKey]) {
        itemsByMonth[monthKey] = [];
      }
      itemsByMonth[monthKey].push(item);
    }
  });

  const months = Object.keys(itemsByMonth).sort();

  return (
    <div className="space-y-6">
      {months.map((month) => {
        const date = new Date(month + '-01');
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return (
          <div key={month}>
            <h3 className="mb-3 font-semibold">{monthName}</h3>
            <div className="space-y-2">
              {itemsByMonth[month].map((item) => {
                const status = statusConfig[item.status];
                const category = categoryConfig[item.category];

                return (
                  <div
                    key={item.id}
                    className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded px-2 py-1 text-xs font-medium ${category.color}`}>
                        {category.label}
                      </div>
                      <span className="font-medium">{item.title}</span>
                      <span className="text-muted-foreground text-sm">
                        {item.dueDate && new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function HRCompliancePage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComplianceCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ComplianceStatus | 'all'>('all');
  const [items, setItems] = useState(sampleItems);

  // Calculate stats
  const byStatus = {
    complete: items.filter((i) => i.status === 'COMPLETE').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    notStarted: items.filter((i) => i.status === 'NOT_STARTED').length,
    overdue: items.filter((i) => i.status === 'OVERDUE').length,
  };

  const total = items.length;
  const score =
    total > 0
      ? Math.round(
          ((byStatus.complete * 100 + byStatus.inProgress * 50 - byStatus.overdue * 25) /
            (total * 100)) *
            100
        )
      : 100;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== 'all' && item.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const handleComplete = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'COMPLETE' as ComplianceStatus,
              completedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEdit = (item: ComplianceItem) => {
    // Would open edit modal
    console.log('Edit item:', item);
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6" />
            HR Compliance Tracker
          </h1>
          <p className="text-muted-foreground">
            Track and manage HR compliance requirements across jurisdictions
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Compliance Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Compliance Item</DialogTitle>
            </DialogHeader>
            {/* Form would go here */}
            <p className="text-muted-foreground py-8 text-center">
              Form implementation would go here
            </p>
          </DialogContent>
        </Dialog>
      </div>

      {/* Score Card */}
      <ComplianceScoreCard byStatus={byStatus} score={Math.max(0, Math.min(100, score))} />

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search compliance items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Category
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedCategory('all')}>
                All Categories
              </DropdownMenuItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSelectedCategory(key as ComplianceCategory)}
                >
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Status
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedStatus('all')}>
                All Statuses
              </DropdownMenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSelectedStatus(key as ComplianceStatus)}
                >
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            variant={view === 'list' ? 'secondary' : 'ghost'}
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={view === 'calendar' ? 'secondary' : 'ghost'}
            onClick={() => setView('calendar')}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {view === 'list' ? (
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  No compliance items found matching your filters.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <ComplianceItemRow
                    key={item.id}
                    item={item}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </div>
          ) : (
            <CalendarView items={filteredItems} />
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Auto-populate Federal Requirements
            </Button>
            <Button size="sm" variant="outline">
              Add State Requirements
            </Button>
            <Button size="sm" variant="outline">
              Export Compliance Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
