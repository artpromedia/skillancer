/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, @next/next/no-img-element */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Image as ImageIcon,
  Monitor,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { TimeEntry } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface WorkDiaryProps {
  contractId: string;
  timeEntries: TimeEntry[];
  screenshots?: Screenshot[];
  onDateChange: (date: Date) => void;
  onExport: (format: 'pdf' | 'csv') => void;
}

interface Screenshot {
  id: string;
  timestamp: Date;
  url: string;
  activityLevel: number; // 0-100
  keystrokes?: number;
  clicks?: number;
  memo?: string;
}

interface HourSlot {
  hour: number;
  entries: TimeEntry[];
  screenshots: Screenshot[];
  totalMinutes: number;
}

// ============================================================================
// Component
// ============================================================================

export function WorkDiary({
  contractId,
  timeEntries,
  screenshots = [],
  onDateChange,
  onExport,
}: WorkDiaryProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'timeline' | 'screenshots'>('timeline');
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

  // Navigate dates
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    onDateChange(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    onDateChange(new Date());
  };

  // Check if selected date is today
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // Filter entries for selected date
  const dayEntries = timeEntries.filter((entry) => {
    const entryDate = new Date(entry.date);
    return entryDate.toDateString() === selectedDate.toDateString();
  });

  // Filter screenshots for selected date
  const dayScreenshots = screenshots.filter((ss) => {
    const ssDate = new Date(ss.timestamp);
    return ssDate.toDateString() === selectedDate.toDateString();
  });

  // Build hour slots (6am - 11pm typical work hours)
  const hourSlots: HourSlot[] = [];
  for (let hour = 6; hour <= 23; hour++) {
    const slotScreenshots = dayScreenshots.filter((ss) => {
      const ssHour = new Date(ss.timestamp).getHours();
      return ssHour === hour;
    });

    const slotEntries = dayEntries.filter((entry) => {
      if (!entry.startTime) return false;
      const startHour = parseInt(entry.startTime.split(':')[0]);
      const endHour = entry.endTime ? parseInt(entry.endTime.split(':')[0]) : startHour + 1;
      return hour >= startHour && hour < endHour;
    });

    const totalMinutes = slotScreenshots.reduce((sum, ss) => {
      // Each screenshot represents 10 minutes of work
      return sum + 10;
    }, 0);

    hourSlots.push({
      hour,
      entries: slotEntries,
      screenshots: slotScreenshots,
      totalMinutes,
    });
  }

  // Calculate day totals
  const totalHours = dayEntries.reduce((sum, e) => sum + e.duration, 0);
  const avgActivityLevel =
    dayScreenshots.length > 0
      ? Math.round(
          dayScreenshots.reduce((sum, ss) => sum + ss.activityLevel, 0) / dayScreenshots.length
        )
      : 0;

  // Format hour
  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
  };

  // Get activity color
  const getActivityColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-green-400';
    if (level >= 40) return 'bg-yellow-400';
    if (level >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span className="font-medium">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <Button size="icon" variant="outline" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button size="sm" variant="ghost" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={viewMode}
            onValueChange={(v: 'timeline' | 'screenshots') => setViewMode(v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeline">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timeline
                </div>
              </SelectItem>
              <SelectItem value="screenshots">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Screenshots
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={(v: 'pdf' | 'csv') => onExport(v)}>
            <SelectTrigger className="w-[120px]">
              <Download className="mr-2 h-4 w-4" />
              Export
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Report</SelectItem>
              <SelectItem value="csv">CSV Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="text-muted-foreground mx-auto mb-2 h-5 w-5" />
            <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            <p className="text-muted-foreground text-sm">Total Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Monitor className="text-muted-foreground mx-auto mb-2 h-5 w-5" />
            <p className="text-2xl font-bold">{dayScreenshots.length}</p>
            <p className="text-muted-foreground text-sm">Screenshots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="text-muted-foreground mx-auto mb-2 h-5 w-5" />
            <p className="text-2xl font-bold">{avgActivityLevel}%</p>
            <p className="text-muted-foreground text-sm">Avg Activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="text-muted-foreground mx-auto mb-2 h-5 w-5" />
            <p className="text-2xl font-bold">{dayEntries.length}</p>
            <p className="text-muted-foreground text-sm">Time Entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card>
          <CardContent className="p-0">
            {hourSlots.map((slot) => (
              <div key={slot.hour} className="flex border-b last:border-b-0">
                {/* Hour Label */}
                <div className="bg-muted/30 w-20 flex-shrink-0 border-r p-3 text-center">
                  <span className="text-muted-foreground text-sm font-medium">
                    {formatHour(slot.hour)}
                  </span>
                </div>

                {/* Activity Bar */}
                <div className="flex flex-1 items-center gap-2 p-3">
                  {/* 10-minute segments */}
                  <div className="flex flex-1 gap-0.5">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const segmentScreenshot = slot.screenshots.find((ss) => {
                        const minute = new Date(ss.timestamp).getMinutes();
                        return minute >= i * 10 && minute < (i + 1) * 10;
                      });

                      return (
                        <div
                          key={i}
                          className={cn(
                            'h-8 flex-1 cursor-pointer rounded-sm transition-opacity hover:opacity-80',
                            segmentScreenshot
                              ? getActivityColor(segmentScreenshot.activityLevel)
                              : 'bg-muted'
                          )}
                          title={
                            segmentScreenshot
                              ? `Activity: ${segmentScreenshot.activityLevel}%`
                              : 'No activity'
                          }
                          onClick={() =>
                            segmentScreenshot && setSelectedScreenshot(segmentScreenshot)
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Time and memo */}
                  <div className="w-32 text-right">
                    {slot.totalMinutes > 0 && (
                      <Badge variant="secondary">{slot.totalMinutes} min</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Screenshots View */}
      {viewMode === 'screenshots' && (
        <div className="grid grid-cols-4 gap-4">
          {dayScreenshots.length === 0 ? (
            <div className="col-span-4 py-12 text-center">
              <ImageIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No screenshots for this day</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Screenshots are captured every 10 minutes during active work
              </p>
            </div>
          ) : (
            dayScreenshots.map((screenshot) => (
              <Card
                key={screenshot.id}
                className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                onClick={() => setSelectedScreenshot(screenshot)}
              >
                <div className="relative aspect-video">
                  <img
                    alt={`Screenshot at ${new Date(screenshot.timestamp).toLocaleTimeString()}`}
                    className="h-full w-full object-cover"
                    src={screenshot.url}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <div className="flex items-center justify-between text-white">
                      <span className="text-xs">
                        {new Date(screenshot.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <Badge
                        className={cn(
                          'text-white',
                          screenshot.activityLevel >= 60 ? 'bg-green-500' : 'bg-amber-500'
                        )}
                      >
                        {screenshot.activityLevel}%
                      </Badge>
                    </div>
                  </div>
                </div>
                {screenshot.memo && (
                  <CardContent className="p-2">
                    <p className="text-muted-foreground line-clamp-2 text-xs">{screenshot.memo}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Screenshot Lightbox */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img alt="Screenshot" className="max-h-[80vh] w-auto" src={selectedScreenshot.url} />
            </div>
            <div className="flex items-center justify-between border-t p-4">
              <div>
                <p className="font-medium">
                  {new Date(selectedScreenshot.timestamp).toLocaleTimeString()}
                </p>
                <p className="text-muted-foreground text-sm">
                  {new Date(selectedScreenshot.timestamp).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{selectedScreenshot.activityLevel}%</p>
                  <p className="text-muted-foreground text-xs">Activity</p>
                </div>
                {selectedScreenshot.keystrokes !== undefined && (
                  <div className="text-center">
                    <p className="text-lg font-bold">{selectedScreenshot.keystrokes}</p>
                    <p className="text-muted-foreground text-xs">Keystrokes</p>
                  </div>
                )}
                {selectedScreenshot.clicks !== undefined && (
                  <div className="text-center">
                    <p className="text-lg font-bold">{selectedScreenshot.clicks}</p>
                    <p className="text-muted-foreground text-xs">Clicks</p>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedScreenshot(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Legend */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <span className="text-muted-foreground">Activity Level:</span>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-red-400" />
          <span>0-20%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-orange-400" />
          <span>20-40%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-yellow-400" />
          <span>40-60%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-400" />
          <span>60-80%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded bg-green-500" />
          <span>80-100%</span>
        </div>
      </div>
    </div>
  );
}
