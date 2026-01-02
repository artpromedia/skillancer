'use client';

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Video,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface ContentItem {
  id: string;
  title: string;
  contentType: string;
  channel: string[];
  scheduledDate: string;
  status: string;
}

interface ContentCalendarWidgetProps {
  engagementId: string;
  data?: {
    items: ContentItem[];
    stats: {
      total: number;
      upcoming: number;
      overdue: number;
    };
  };
  isLoading?: boolean;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  BLOG_POST: <FileText className="h-3 w-3" />,
  VIDEO: <Video className="h-3 w-3" />,
  EMAIL: <Mail className="h-3 w-3" />,
  SOCIAL_POST: <MessageSquare className="h-3 w-3" />,
};

const statusColors: Record<string, string> = {
  IDEA: 'bg-gray-100 text-gray-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  SCHEDULED: 'bg-purple-100 text-purple-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
};

export function ContentCalendarWidget({
  engagementId,
  data,
  isLoading,
}: ContentCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getItemsForDate = (day: number) => {
    if (!data?.items) return [];
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];
    return data.items.filter((item) => item.scheduledDate?.startsWith(dateStr));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Content Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-gray-100" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Content Calendar
          </CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="mb-4 flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-medium">{data?.stats?.total || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Upcoming: </span>
            <span className="font-medium text-blue-600">{data?.stats?.upcoming || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Overdue: </span>
            <span className="font-medium text-red-600">{data?.stats?.overdue || 0}</span>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="mb-4 flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">{monthName}</span>
          <Button size="sm" variant="ghost" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-muted-foreground py-1 text-center text-xs font-medium">
              {day}
            </div>
          ))}

          {/* Empty cells for first week */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-12" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const items = getItemsForDate(day);
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === currentDate.getMonth() &&
              new Date().getFullYear() === currentDate.getFullYear();

            return (
              <div
                key={day}
                className={`h-12 cursor-pointer rounded-sm border p-1 hover:bg-gray-50 ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
                }`}
              >
                <div className="text-muted-foreground text-xs">{day}</div>
                <div className="flex flex-wrap gap-0.5">
                  {items.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="h-2 w-2 rounded-full bg-blue-500"
                      title={item.title}
                    />
                  ))}
                  {items.length > 2 && (
                    <span className="text-muted-foreground text-[8px]">+{items.length - 2}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming Items */}
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium">Upcoming</h4>
          {data?.items
            ?.filter((item) => new Date(item.scheduledDate) >= new Date())
            .slice(0, 3)
            .map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded bg-gray-50 p-2 text-sm">
                {contentTypeIcons[item.contentType] || <FileText className="h-3 w-3" />}
                <span className="flex-1 truncate">{item.title}</span>
                <Badge className={statusColors[item.status]} variant="secondary">
                  {item.status}
                </Badge>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
