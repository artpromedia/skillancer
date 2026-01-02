/**
 * Executive Timesheet Page
 *
 * Weekly timesheet view for executives to log and manage
 * time across all their client engagements.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input } from '@skillancer/ui';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar,
  Check,
  AlertCircle,
  Download,
  Filter,
  MoreVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { TimeEntryForm } from '@/components/executive/workspace/time-entry-form';

// Types
interface TimeEntry {
  id: string;
  engagementId: string;
  engagementTitle: string;
  clientName: string;
  date: string;
  hours: number;
  description: string;
  category: string;
  billable: boolean;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INVOICED';
}

interface DayData {
  date: Date;
  entries: TimeEntry[];
  totalHours: number;
}

// Mock data
const mockEngagements = [
  { id: '1', title: 'Technical Leadership', clientName: 'TechStart Inc' },
  { id: '2', title: 'Financial Strategy', clientName: 'GrowthCo' },
];

const mockEntries: TimeEntry[] = [
  {
    id: '1',
    engagementId: '1',
    engagementTitle: 'Technical Leadership',
    clientName: 'TechStart Inc',
    date: '2024-10-14',
    hours: 3,
    description: 'Architecture review meeting',
    category: 'MEETINGS',
    billable: true,
    status: 'PENDING',
  },
  {
    id: '2',
    engagementId: '1',
    engagementTitle: 'Technical Leadership',
    clientName: 'TechStart Inc',
    date: '2024-10-15',
    hours: 4,
    description: 'CI/CD pipeline implementation',
    category: 'EXECUTION',
    billable: true,
    status: 'PENDING',
  },
  {
    id: '3',
    engagementId: '2',
    engagementTitle: 'Financial Strategy',
    clientName: 'GrowthCo',
    date: '2024-10-15',
    hours: 2,
    description: 'Budget review with CEO',
    category: 'ADVISORY',
    billable: true,
    status: 'SUBMITTED',
  },
  {
    id: '4',
    engagementId: '1',
    engagementTitle: 'Technical Leadership',
    clientName: 'TechStart Inc',
    date: '2024-10-16',
    hours: 5,
    description: 'Sprint planning and backlog refinement',
    category: 'STRATEGY',
    billable: true,
    status: 'APPROVED',
  },
];

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  ADVISORY: 'bg-blue-100 text-blue-800',
  STRATEGY: 'bg-purple-100 text-purple-800',
  EXECUTION: 'bg-green-100 text-green-800',
  MEETINGS: 'bg-orange-100 text-orange-800',
  DOCUMENTATION: 'bg-cyan-100 text-cyan-800',
  REVIEW: 'bg-pink-100 text-pink-800',
  TRAINING: 'bg-yellow-100 text-yellow-800',
  ADMIN: 'bg-gray-100 text-gray-800',
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  INVOICED: 'bg-purple-100 text-purple-800',
};

// Utility functions
function getWeekDates(date: Date): Date[] {
  const week: Date[] = [];
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }

  return week;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

// Week Navigation Component
function WeekNavigation({
  weekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
}: {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-4">
      <Button size="icon" variant="outline" onClick={onPrevWeek}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[200px] text-center">
        <p className="font-semibold">
          {formatDate(weekStart)} - {formatDate(weekEnd)}
        </p>
        <p className="text-muted-foreground text-sm">
          Week {Math.ceil((weekStart.getDate() + 1) / 7)}
        </p>
      </div>
      <Button size="icon" variant="outline" onClick={onNextWeek}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" onClick={onToday}>
        Today
      </Button>
    </div>
  );
}

// Day Column Component
function DayColumn({
  date,
  entries,
  totalHours,
  isToday,
  onAddEntry,
}: {
  date: Date;
  entries: TimeEntry[];
  totalHours: number;
  isToday: boolean;
  onAddEntry: () => void;
}) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  return (
    <div
      className={`min-w-[140px] flex-1 border-r last:border-r-0 ${
        isToday ? 'bg-blue-50/50' : isWeekend ? 'bg-gray-50/50' : ''
      }`}
    >
      {/* Header */}
      <div className="border-b p-2 text-center">
        <p className={`text-xs ${isToday ? 'text-blue-600' : 'text-muted-foreground'}`}>
          {dayName}
        </p>
        <p
          className={`text-lg font-semibold ${
            isToday ? 'text-blue-600' : isWeekend ? 'text-muted-foreground' : ''
          }`}
        >
          {dayNum}
        </p>
      </div>

      {/* Entries */}
      <div className="min-h-[200px] space-y-2 p-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="cursor-pointer rounded-md border bg-white p-2 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{entry.hours}h</span>
              <Badge className={`${CATEGORY_COLORS[entry.category]} text-xs`}>
                {entry.category.slice(0, 3)}
              </Badge>
            </div>
            <p className="text-muted-foreground truncate text-xs">{entry.clientName}</p>
            <p className="mt-1 truncate text-xs">{entry.description}</p>
          </div>
        ))}
        <Button
          className="text-muted-foreground w-full justify-center"
          size="sm"
          variant="ghost"
          onClick={onAddEntry}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Footer */}
      <div className="bg-muted/30 border-t p-2 text-center">
        <p className="text-sm font-semibold">{totalHours}h</p>
      </div>
    </div>
  );
}

// Summary Panel Component
function SummaryPanel({ entries }: { entries: TimeEntry[] }) {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);
  const pendingHours = entries
    .filter((e) => e.status === 'PENDING')
    .reduce((sum, e) => sum + e.hours, 0);
  const submittedHours = entries
    .filter((e) => e.status === 'SUBMITTED')
    .reduce((sum, e) => sum + e.hours, 0);

  // Group by engagement
  const byEngagement: Record<string, number> = {};
  for (const entry of entries) {
    byEngagement[entry.clientName] = (byEngagement[entry.clientName] || 0) + entry.hours;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Week Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{totalHours}h</p>
            <p className="text-muted-foreground text-xs">Total Hours</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{billableHours}h</p>
            <p className="text-muted-foreground text-xs">Billable</p>
          </div>
        </div>

        {/* By Status */}
        <div>
          <p className="mb-2 text-sm font-medium">By Status</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pending</span>
              <span>{pendingHours}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Submitted</span>
              <span>{submittedHours}h</span>
            </div>
          </div>
        </div>

        {/* By Client */}
        <div>
          <p className="mb-2 text-sm font-medium">By Client</p>
          <div className="space-y-1">
            {Object.entries(byEngagement).map(([client, hours]) => (
              <div key={client} className="flex justify-between text-sm">
                <span className="text-muted-foreground mr-2 truncate">{client}</span>
                <span>{hours}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button className="w-full">
            <Check className="mr-2 h-4 w-4" />
            Submit Timesheet
          </Button>
          <Button className="w-full" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecutiveTimesheetPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTimeEntry, setShowTimeEntry] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekDates = getWeekDates(currentDate);
  const weekStart = weekDates[0]!;

  // Group entries by date
  const entriesByDate: Record<string, TimeEntry[]> = {};
  for (const entry of mockEntries) {
    if (!entriesByDate[entry.date]) {
      entriesByDate[entry.date] = [];
    }
    entriesByDate[entry.date]!.push(entry);
  }

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddEntry = (date: Date) => {
    setSelectedDate(date);
    setShowTimeEntry(true);
  };

  const today = formatDateKey(new Date());

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheet</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your time across all engagements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button onClick={() => handleAddEntry(new Date())}>
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Timesheet Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <WeekNavigation
                weekStart={weekStart}
                onNextWeek={handleNextWeek}
                onPrevWeek={handlePrevWeek}
                onToday={handleToday}
              />
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>
                  Weekly total:{' '}
                  <strong className="text-foreground">
                    {mockEntries.reduce((sum, e) => sum + e.hours, 0)}h
                  </strong>
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex overflow-x-auto">
                {weekDates.map((date) => {
                  const dateKey = formatDateKey(date);
                  const dayEntries = entriesByDate[dateKey] || [];
                  const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);

                  return (
                    <DayColumn
                      key={dateKey}
                      date={date}
                      entries={dayEntries}
                      isToday={dateKey === today}
                      totalHours={totalHours}
                      onAddEntry={() => handleAddEntry(date)}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Panel */}
        <div>
          <SummaryPanel entries={mockEntries} />
        </div>
      </div>

      {/* Time Entry Modal */}
      {showTimeEntry && (
        <TimeEntryForm
          engagementId={mockEngagements[0]?.id ?? ''}
          initialDate={selectedDate ?? new Date()}
          onClose={() => {
            setShowTimeEntry(false);
            setSelectedDate(null);
          }}
          onSubmit={(entry) => {
            console.log('Time entry:', entry);
            setShowTimeEntry(false);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
}
