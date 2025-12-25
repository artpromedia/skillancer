'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import { Calendar, Clock, Globe, Moon, Sun } from 'lucide-react';

import type { FreelancerProfile } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface AvailabilityWidgetProps {
  availability: FreelancerProfile['availability'];
  hoursPerWeek: number;
  preferredWorkingHours?: FreelancerProfile['preferredWorkingHours'];
  timezone: string;
  isOwnProfile?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getAvailabilityConfig(status: string) {
  const config = {
    AVAILABLE: {
      label: 'Available Now',
      description: 'Ready to start new projects',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      dotColor: 'bg-emerald-500',
    },
    PARTIALLY_AVAILABLE: {
      label: 'Partially Available',
      description: 'Limited availability for new work',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      dotColor: 'bg-yellow-500',
    },
    NOT_AVAILABLE: {
      label: 'Not Available',
      description: 'Currently not accepting new projects',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      dotColor: 'bg-gray-400',
    },
  };
  return config[status as keyof typeof config] || config.NOT_AVAILABLE;
}

function formatTimezone(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value ?? tz;
  } catch {
    return tz;
  }
}

function getCurrentTimeInTimezone(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '';
  }
}

function isWorkingHours(tz: string, start?: string, end?: string): boolean {
  if (!start || !end) return true;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);
    const startHour = parseInt(start.split(':')[0], 10);
    const endHour = parseInt(end.split(':')[0], 10);

    return currentHour >= startHour && currentHour < endHour;
  } catch {
    return true;
  }
}

// ============================================================================
// Availability Heat Map
// ============================================================================

function AvailabilityHeatMap({ hoursPerWeek }: { hoursPerWeek: number }) {
  // Simulate weekly availability based on hours per week
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hoursPerDay = Math.ceil(hoursPerWeek / 5); // Assume 5-day week
  const weekendHours = hoursPerWeek > 40 ? Math.ceil((hoursPerWeek - 40) / 2) : 0;

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day, index) => {
        const isWeekend = index >= 5;
        const availability = isWeekend
          ? weekendHours > 0
            ? 0.3
            : 0
          : Math.min(hoursPerDay / 8, 1);

        return (
          <TooltipProvider key={day} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-muted-foreground text-[10px]">{day}</span>
                  <div
                    className={cn(
                      'h-6 w-full rounded',
                      availability === 0
                        ? 'bg-muted'
                        : availability < 0.3
                          ? 'bg-emerald-100'
                          : availability < 0.6
                            ? 'bg-emerald-300'
                            : availability < 0.9
                              ? 'bg-emerald-500'
                              : 'bg-emerald-600'
                    )}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {availability === 0
                  ? 'Not available'
                  : `~${Math.round(availability * 8)}h available`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AvailabilityWidget({
  availability,
  hoursPerWeek,
  preferredWorkingHours,
  timezone,
  isOwnProfile = false,
  className,
}: AvailabilityWidgetProps) {
  const config = getAvailabilityConfig(availability);
  const currentTime = getCurrentTimeInTimezone(timezone);
  const formattedTz = formatTimezone(timezone);
  const isWorking = isWorkingHours(
    timezone,
    preferredWorkingHours?.start,
    preferredWorkingHours?.end
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Availability</h3>
          {isOwnProfile && (
            <Button size="sm" variant="ghost">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status badge */}
        <div className={cn('rounded-lg p-4', config.bgColor)}>
          <div className="flex items-center gap-3">
            <span className={cn('h-3 w-3 animate-pulse rounded-full', config.dotColor)} />
            <div>
              <p className={cn('font-medium', config.color)}>{config.label}</p>
              <p className="text-muted-foreground text-sm">{config.description}</p>
            </div>
          </div>
        </div>

        {/* Hours per week */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span>Hours per week</span>
          </div>
          <Badge variant="secondary">{hoursPerWeek}+ hrs</Badge>
        </div>

        {/* Timezone and current time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Globe className="text-muted-foreground h-4 w-4" />
            <span>Timezone</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{formattedTz}</p>
            {currentTime && (
              <p className="text-muted-foreground text-xs">{currentTime} local time</p>
            )}
          </div>
        </div>

        {/* Preferred hours */}
        {preferredWorkingHours && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {isWorking ? (
                <Sun className="h-4 w-4 text-yellow-500" />
              ) : (
                <Moon className="text-muted-foreground h-4 w-4" />
              )}
              <span>Working hours</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {preferredWorkingHours.start} – {preferredWorkingHours.end}
              </p>
              <p className="text-muted-foreground text-xs">
                {isWorking ? 'Within working hours' : 'Outside working hours'}
              </p>
            </div>
          </div>
        )}

        {/* Heat map */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-muted-foreground text-xs font-medium">Weekly availability</p>
          <AvailabilityHeatMap hoursPerWeek={hoursPerWeek} />
        </div>

        {/* Request availability button */}
        {!isOwnProfile && availability !== 'NOT_AVAILABLE' && (
          <Button className="w-full" size="sm" variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Request Availability
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
