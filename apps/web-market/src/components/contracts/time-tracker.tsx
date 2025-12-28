/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-misused-promises, react/no-unescaped-entities */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@skillancer/ui';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { TimeEntry } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface TimeTrackerProps {
  contractId: string;
  timeEntries: TimeEntry[];
  weeklyLimit?: number;
  isFreelancer: boolean;
  onAddEntry: (entry: Omit<TimeEntry, 'id' | 'status'>) => Promise<void>;
  onEditEntry: (id: string, entry: Partial<TimeEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onViewDiary: () => void;
}

interface NewTimeEntry {
  date: string;
  hours: number;
  minutes: number;
  description: string;
  taskId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'APPROVED') return 'default';
  if (status === 'PENDING') return 'secondary';
  return 'destructive';
}

// ============================================================================
// Component
// ============================================================================

export function TimeTracker({
  contractId,
  timeEntries,
  weeklyLimit = 40,
  isFreelancer,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onViewDiary,
}: Readonly<TimeTrackerProps>) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStartTime) {
      interval = setInterval(() => {
        setTimerElapsed(Math.floor((Date.now() - timerStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartTime]);

  // Get week dates
  const getWeekDates = useCallback(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeekStart]);

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(now.setDate(diff)));
  };

  // Filter entries for current week
  const weekEntries = timeEntries.filter((entry) => {
    const entryDate = new Date(entry.date);
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return entryDate >= currentWeekStart && entryDate < weekEnd;
  });

  // Calculate totals
  const weeklyTotal = weekEntries.reduce((sum, e) => sum + e.duration, 0);
  const pendingHours = weekEntries
    .filter((e) => e.status === 'PENDING')
    .reduce((sum, e) => sum + e.duration, 0);
  const approvedHours = weekEntries
    .filter((e) => e.status === 'APPROVED')
    .reduce((sum, e) => sum + e.duration, 0);

  // Group entries by date
  const entriesByDate = weekEntries.reduce(
    (acc, entry) => {
      const dateKey = new Date(entry.date).toISOString().split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    },
    {} as Record<string, TimeEntry[]>
  );

  // Format duration
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Format timer
  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start/stop timer
  const toggleTimer = () => {
    if (isTimerRunning) {
      // Stop timer and show add modal
      setIsTimerRunning(false);
      setShowAddModal(true);
    } else {
      // Start timer
      setIsTimerRunning(true);
      setTimerStartTime(new Date());
      setTimerElapsed(0);
    }
  };

  // Check if current week
  const isCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const currentStart = new Date(now.setDate(diff));
    return currentWeekStart.toDateString() === currentStart.toDateString();
  };

  const weekDates = getWeekDates();

  return (
    <div className="space-y-6">
      {/* Timer Section (for freelancers) */}
      {isFreelancer && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  className={cn(
                    'h-12 w-12 rounded-full',
                    isTimerRunning && 'bg-red-500 hover:bg-red-600'
                  )}
                  size="icon"
                  onClick={toggleTimer}
                >
                  {isTimerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <div>
                  <p className="font-mono text-2xl font-semibold">{formatTimer(timerElapsed)}</p>
                  <p className="text-muted-foreground text-sm">
                    {isTimerRunning ? 'Timer running...' : 'Click to start tracking'}
                  </p>
                </div>
              </div>

              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manual Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-medium">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekDates[6].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <Button size="icon" variant="outline" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek() && (
            <Button size="sm" variant="ghost" onClick={goToCurrentWeek}>
              Today
            </Button>
          )}
        </div>

        <Button variant="outline" onClick={onViewDiary}>
          <Calendar className="mr-2 h-4 w-4" />
          View Work Diary
        </Button>
      </div>

      {/* Weekly Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">Total Hours</p>
            <p className="text-2xl font-bold">{formatDuration(weeklyTotal)}</p>
            {Boolean(weeklyLimit) && (
              <p className="text-muted-foreground text-xs">of {weeklyLimit}h limit</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600">{formatDuration(pendingHours)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">Approved</p>
            <p className="text-2xl font-bold text-green-600">{formatDuration(approvedHours)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Progress Bar */}
      {Boolean(weeklyLimit) && (
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Weekly Progress</span>
            <span className="font-medium">{Math.round((weeklyTotal / weeklyLimit) * 100)}%</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full transition-all',
                weeklyTotal > weeklyLimit ? 'bg-red-500' : 'bg-primary'
              )}
              style={{ width: `${Math.min((weeklyTotal / weeklyLimit) * 100, 100)}%` }}
            />
          </div>
          {weeklyTotal > weeklyLimit && (
            <p className="mt-1 text-xs text-red-500">
              You've exceeded the weekly limit by {formatDuration(weeklyTotal - weeklyLimit)}
            </p>
          )}
        </div>
      )}

      {/* Day-by-Day Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-semibold">Time Entries</h3>
        </CardHeader>
        <CardContent className="p-0">
          {weekDates.map((date) => {
            const dateKey = date.toISOString().split('T')[0];
            const dayEntries = entriesByDate[dateKey] || [];
            const dayTotal = dayEntries.reduce((sum, e) => sum + e.duration, 0);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={dateKey}
                className={cn('border-b last:border-b-0', isToday && 'bg-primary/5')}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 flex-col items-center justify-center rounded-lg',
                        isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <span className="text-xs font-medium">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-bold">{date.getDate()}</span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatDuration(dayTotal)}</p>
                  </div>
                </div>

                {/* Day Entries */}
                {dayEntries.length > 0 && (
                  <div className="bg-muted/30 border-t px-4 py-2">
                    {dayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Clock className="text-muted-foreground h-4 w-4" />
                          <div>
                            <p className="text-sm">{entry.description}</p>
                            <p className="text-muted-foreground text-xs">
                              {entry.startTime && entry.endTime
                                ? `${entry.startTime} - ${entry.endTime}`
                                : 'Manual entry'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(entry.status)}>
                            {entry.status === 'APPROVED' && <Check className="mr-1 h-3 w-3" />}
                            {formatDuration(entry.duration)}
                          </Badge>
                          {isFreelancer && entry.status === 'PENDING' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingEntry(entry)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add Entry Modal */}
      <AddTimeEntryModal
        contractId={contractId}
        initialDuration={timerElapsed}
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setTimerElapsed(0);
          setTimerStartTime(null);
        }}
        onSubmit={onAddEntry}
      />

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditTimeEntryModal
          entry={editingEntry}
          open={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSubmit={(data) => onEditEntry(editingEntry.id, data)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Add Time Entry Modal
// ============================================================================

function AddTimeEntryModal({
  contractId,
  initialDuration,
  open,
  onClose,
  onSubmit,
}: Readonly<{
  contractId: string;
  initialDuration: number;
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: Omit<TimeEntry, 'id' | 'status'>) => Promise<void>;
}>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<NewTimeEntry>({
    date: new Date().toISOString().split('T')[0],
    hours: Math.floor(initialDuration / 3600),
    minutes: Math.floor((initialDuration % 3600) / 60),
    description: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        hours: Math.floor(initialDuration / 3600),
        minutes: Math.floor((initialDuration % 3600) / 60),
        description: '',
      });
    }
  }, [open, initialDuration]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const duration = formData.hours + formData.minutes / 60;
      await onSubmit({
        contractId,
        date: formData.date,
        duration,
        description: formData.description,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                max={24}
                min={0}
                type="number"
                value={formData.hours}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, hours: Number.parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label htmlFor="minutes">Minutes</Label>
              <Input
                id="minutes"
                max={59}
                min={0}
                type="number"
                value={formData.minutes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, minutes: Number.parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              className="border-input bg-background mt-1 w-full rounded-md border p-3 text-sm"
              id="description"
              placeholder="What did you work on?"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || !formData.description.trim()} onClick={handleSubmit}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Edit Time Entry Modal
// ============================================================================

function EditTimeEntryModal({
  entry,
  open,
  onClose,
  onSubmit,
}: Readonly<{
  entry: TimeEntry;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<TimeEntry>) => Promise<void>;
}>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    hours: Math.floor(entry.duration),
    minutes: Math.round((entry.duration % 1) * 60),
    description: entry.description,
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        duration: formData.hours + formData.minutes / 60,
        description: formData.description,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-hours">Hours</Label>
              <Input
                id="edit-hours"
                max={24}
                min={0}
                type="number"
                value={formData.hours}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, hours: Number.parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-minutes">Minutes</Label>
              <Input
                id="edit-minutes"
                max={59}
                min={0}
                type="number"
                value={formData.minutes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, minutes: Number.parseInt(e.target.value) || 0 }))
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <textarea
              className="border-input bg-background mt-1 w-full rounded-md border p-3 text-sm"
              id="edit-description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
