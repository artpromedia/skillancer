'use client';

/**
 * Enterprise Reports Page
 * View and generate usage, security, compliance, and executive reports
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Shield,
  FileCheck,
  TrendingUp,
  Download,
  Calendar,
  Clock,
  Plus,
  Trash2,
  FileText,
  RefreshCw,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Badge } from '@skillancer/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

type ReportType =
  | 'usage'
  | 'security'
  | 'compliance'
  | 'executive'
  | 'user_activity'
  | 'session_analytics'
  | 'cost_analysis';
type ReportFormat = 'json' | 'csv' | 'pdf' | 'xlsx';

interface GeneratedReport {
  id: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: { start: string; end: string };
  generatedAt: string;
  expiresAt: string;
  downloadUrl?: string;
  metadata: {
    recordCount: number;
    generationTimeMs: number;
  };
}

interface ScheduledReport {
  id: string;
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: ReportFormat;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string;
  lastRunAt?: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchReportHistory(): Promise<GeneratedReport[]> {
  const response = await fetch('/api/admin/tenant/reports/history');
  if (!response.ok) throw new Error('Failed to fetch reports');
  return response.json();
}

async function fetchScheduledReports(): Promise<ScheduledReport[]> {
  const response = await fetch('/api/admin/tenant/reports/schedules');
  if (!response.ok) throw new Error('Failed to fetch scheduled reports');
  return response.json();
}

async function generateReport(params: {
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
}): Promise<GeneratedReport> {
  const response = await fetch('/api/admin/tenant/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate report');
  }
  return response.json();
}

async function createSchedule(params: {
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: ReportFormat;
  recipients: string[];
}): Promise<{ id: string }> {
  const response = await fetch('/api/admin/tenant/reports/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create schedule');
  }
  return response.json();
}

async function deleteSchedule(scheduleId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/reports/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete schedule');
}

// =============================================================================
// CONSTANTS
// =============================================================================

const reportTypes: Array<{
  type: ReportType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    type: 'usage',
    name: 'Usage Report',
    description: 'Session counts, user activity, and platform utilization',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'bg-blue-500',
  },
  {
    type: 'security',
    name: 'Security Report',
    description: 'Security events, policy violations, and risk analysis',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-red-500',
  },
  {
    type: 'compliance',
    name: 'Compliance Report',
    description: 'Control status, audit trails, and framework adherence',
    icon: <FileCheck className="h-5 w-5" />,
    color: 'bg-green-500',
  },
  {
    type: 'executive',
    name: 'Executive Dashboard',
    description: 'High-level metrics, trends, and recommendations',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'bg-purple-500',
  },
  {
    type: 'user_activity',
    name: 'User Activity',
    description: 'Detailed per-user activity and engagement metrics',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-orange-500',
  },
  {
    type: 'session_analytics',
    name: 'Session Analytics',
    description: 'Session duration, patterns, and distribution analysis',
    icon: <Clock className="h-5 w-5" />,
    color: 'bg-teal-500',
  },
  {
    type: 'cost_analysis',
    name: 'Cost Analysis',
    description: 'Usage costs, projections, and optimization insights',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'bg-yellow-500',
  },
];

const datePresets = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This month', days: 0, thisMonth: true },
  { label: 'Last month', days: 0, lastMonth: true },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function GenerateReportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('usage');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const mutation = useMutation({
    mutationFn: generateReport,
    onSuccess: (report) => {
      toast({
        title: 'Report Generated',
        description: `Your ${reportType} report is ready for download.`,
      });
      onSuccess();
      onOpenChange(false);

      // Trigger download if URL available
      if (report.downloadUrl) {
        window.open(report.downloadUrl, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const applyPreset = (preset: (typeof datePresets)[0]) => {
    const now = new Date();
    let start: Date, end: Date;

    if (preset.thisMonth) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    } else if (preset.lastMonth) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      end = now;
      start = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ type: reportType, format, startDate, endDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>Select the report type, date range, and format</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((rt) => (
                    <SelectItem key={rt.type} value={rt.type}>
                      <div className="flex items-center gap-2">
                        {rt.icon}
                        {rt.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">
                {reportTypes.find((rt) => rt.type === reportType)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                  <SelectItem value="csv">CSV (Raw Data)</SelectItem>
                  <SelectItem value="json">JSON (API)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !startDate || !endDate}>
              {mutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleReportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('usage');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      toast({ title: 'Schedule Created', description: 'Report will be sent automatically.' });
      onSuccess();
      onOpenChange(false);
      // Reset form
      setRecipients([]);
      setRecipientInput('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ reportType, frequency, format, recipients });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>Set up automatic report generation and delivery</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((rt) => (
                    <SelectItem key={rt.type} value={rt.type}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (at midnight)</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="email@company.com"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                />
                <Button type="button" onClick={addRecipient}>
                  Add
                </Button>
              </div>
              {recipients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {recipients.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(email)}
                        className="hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || recipients.length === 0}>
              {mutation.isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportTypeCard({ report }: { report: (typeof reportTypes)[0] }) {
  return (
    <Card className="hover:border-primary/50 cursor-pointer transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`${report.color} rounded-lg p-3 text-white`}>{report.icon}</div>
          <div>
            <h3 className="font-semibold">{report.name}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{report.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportHistoryTable() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['report-history'],
    queryFn: fetchReportHistory,
  });

  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  const getTypeInfo = (type: ReportType) => reportTypes.find((rt) => rt.type === type);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No reports generated yet</p>
        <p className="text-muted-foreground">Generate your first report to see it here</p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-4 py-3 text-left">Report</th>
          <th className="px-4 py-3 text-left">Date Range</th>
          <th className="px-4 py-3 text-left">Format</th>
          <th className="px-4 py-3 text-left">Generated</th>
          <th className="px-4 py-3 text-left">Expires</th>
          <th className="w-24 px-4 py-3 text-left"></th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => {
          const typeInfo = getTypeInfo(report.type);
          return (
            <tr key={report.id} className="border-b">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className={`${typeInfo?.color || 'bg-gray-500'} rounded p-2 text-white`}>
                    {typeInfo?.icon}
                  </div>
                  <span className="font-medium">{typeInfo?.name || report.type}</span>
                </div>
              </td>
              <td className="px-4 py-4 text-sm">
                {formatDate(report.dateRange.start)} - {formatDate(report.dateRange.end)}
              </td>
              <td className="px-4 py-4">
                <Badge variant="outline">{report.format.toUpperCase()}</Badge>
              </td>
              <td className="text-muted-foreground px-4 py-4 text-sm">
                {formatDate(report.generatedAt)}
              </td>
              <td className="text-muted-foreground px-4 py-4 text-sm">
                {formatDate(report.expiresAt)}
              </td>
              <td className="px-4 py-4">
                {report.downloadUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={report.downloadUrl} target="_blank">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ScheduledReportsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: fetchScheduledReports,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast({ title: 'Schedule deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete schedule', variant: 'destructive' });
    },
  });

  const getTypeInfo = (type: ReportType) => reportTypes.find((rt) => rt.type === type);

  const frequencyLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="py-12 text-center">
        <Calendar className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No scheduled reports</p>
        <p className="text-muted-foreground">Create a schedule to receive reports automatically</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => {
        const typeInfo = getTypeInfo(schedule.reportType);
        return (
          <Card key={schedule.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`${typeInfo?.color || 'bg-gray-500'} rounded p-2 text-white`}>
                    {typeInfo?.icon}
                  </div>
                  <div>
                    <h4 className="font-medium">{typeInfo?.name}</h4>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                      <Badge variant="outline">{frequencyLabels[schedule.frequency]}</Badge>
                      <Badge variant="outline">{schedule.format.toUpperCase()}</Badge>
                      <span>→ {schedule.recipients.length} recipient(s)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Next run</p>
                    <p>{new Date(schedule.nextRunAt).toLocaleDateString()}</p>
                  </div>
                  <Badge
                    className={
                      schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {schedule.enabled ? 'Active' : 'Paused'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => {
                      if (confirm('Delete this schedule?')) {
                        deleteMutation.mutate(schedule.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and schedule enterprise reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScheduleOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Report
          </Button>
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs defaultValue="generate">
        <TabsList className="mb-6">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history">Report History</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Reports</CardTitle>
                <CardDescription>
                  Click on a report type to generate it, or use the button above
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {reportTypes.map((report) => (
                    <div key={report.type} onClick={() => setGenerateOpen(true)}>
                      <ReportTypeCard report={report} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Insights</CardTitle>
                <CardDescription>Key metrics from your most recent reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">1,234</p>
                    <p className="text-muted-foreground text-sm">Sessions This Month</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">98%</p>
                    <p className="text-muted-foreground text-sm">Compliance Score</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">95</p>
                    <p className="text-muted-foreground text-sm">Security Score</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-orange-600">+12%</p>
                    <p className="text-muted-foreground text-sm">User Growth</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>Previously generated reports available for download</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ReportHistoryTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scheduled Reports</CardTitle>
                  <CardDescription>
                    Reports that are automatically generated and emailed
                  </CardDescription>
                </div>
                <Button onClick={() => setScheduleOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScheduledReportsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <GenerateReportDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['report-history'] })}
      />

      <ScheduleReportDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] })}
      />
    </div>
  );
}
