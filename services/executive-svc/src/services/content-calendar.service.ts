import { prisma } from '@skillancer/database';
import { EventEmitter } from 'node:events';

// Content Calendar Service for CMO Suite
// Manages content planning, scheduling, and publishing workflows

export interface ContentItemInput {
  title: string;
  description?: string;
  contentType: ContentType;
  channel: string[];
  scheduledDate?: Date;
  assigneeId?: string;
  draftUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentItemUpdate {
  title?: string;
  description?: string;
  contentType?: ContentType;
  channel?: string[];
  scheduledDate?: Date;
  publishedDate?: Date;
  status?: ContentStatus;
  assigneeId?: string;
  draftUrl?: string;
  publishedUrl?: string;
  metadata?: Record<string, unknown>;
}

export type ContentType =
  | 'BLOG_POST'
  | 'SOCIAL_POST'
  | 'EMAIL'
  | 'VIDEO'
  | 'PODCAST'
  | 'WEBINAR'
  | 'EBOOK'
  | 'CASE_STUDY'
  | 'PRESS_RELEASE'
  | 'OTHER';

export type ContentStatus =
  | 'IDEA'
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface CalendarView {
  items: ContentItemWithDetails[];
  dateRange: { start: Date; end: Date };
  stats: {
    total: number;
    byStatus: Record<ContentStatus, number>;
    byType: Record<ContentType, number>;
    byChannel: Record<string, number>;
  };
}

export interface ContentItemWithDetails {
  id: string;
  title: string;
  description: string | null;
  contentType: ContentType;
  channel: string[];
  scheduledDate: Date | null;
  publishedDate: Date | null;
  status: ContentStatus;
  assigneeId: string | null;
  draftUrl: string | null;
  publishedUrl: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

class ContentCalendarService extends EventEmitter {
  // Create a new content calendar for an engagement
  async createCalendar(engagementId: string): Promise<{ id: string; engagementId: string }> {
    const calendar = await prisma.contentCalendar.create({
      data: {
        engagementId,
      },
    });

    this.emit('calendar:created', { calendarId: calendar.id, engagementId });

    return {
      id: calendar.id,
      engagementId: calendar.engagementId,
    };
  }

  // Get calendar by engagement ID
  async getCalendarByEngagement(engagementId: string) {
    return prisma.contentCalendar.findUnique({
      where: { engagementId },
      include: {
        items: {
          orderBy: { scheduledDate: 'asc' },
        },
      },
    });
  }

  // Add a content item to the calendar
  async addContentItem(
    calendarId: string,
    item: ContentItemInput
  ): Promise<ContentItemWithDetails> {
    const contentItem = await prisma.contentItem.create({
      data: {
        calendarId,
        title: item.title,
        description: item.description,
        contentType: item.contentType,
        channel: item.channel,
        scheduledDate: item.scheduledDate,
        assigneeId: item.assigneeId,
        draftUrl: item.draftUrl,
        metadata: item.metadata as any,
        status: 'IDEA',
      },
    });

    this.emit('content:created', { calendarId, itemId: contentItem.id });

    return contentItem as ContentItemWithDetails;
  }

  // Update a content item
  async updateContentItem(
    itemId: string,
    updates: ContentItemUpdate
  ): Promise<ContentItemWithDetails> {
    const contentItem = await prisma.contentItem.update({
      where: { id: itemId },
      data: updates as any,
    });

    this.emit('content:updated', { itemId, updates });

    return contentItem as ContentItemWithDetails;
  }

  // Delete a content item
  async deleteContentItem(itemId: string): Promise<void> {
    await prisma.contentItem.delete({
      where: { id: itemId },
    });

    this.emit('content:deleted', { itemId });
  }

  // Get calendar view with items in date range
  async getCalendarView(
    calendarId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CalendarView> {
    const items = await prisma.contentItem.findMany({
      where: {
        calendarId,
        OR: [
          {
            scheduledDate: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
          {
            scheduledDate: null,
            createdAt: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        ],
      },
      orderBy: { scheduledDate: 'asc' },
    });

    // Calculate stats
    const stats = this.calculateStats(items as ContentItemWithDetails[]);

    return {
      items: items as ContentItemWithDetails[],
      dateRange,
      stats,
    };
  }

  // Get items by status (for kanban/pipeline view)
  async getItemsByStatus(
    calendarId: string
  ): Promise<Record<ContentStatus, ContentItemWithDetails[]>> {
    const items = await prisma.contentItem.findMany({
      where: { calendarId },
      orderBy: { updatedAt: 'desc' },
    });

    const grouped: Record<ContentStatus, ContentItemWithDetails[]> = {
      IDEA: [],
      DRAFT: [],
      REVIEW: [],
      APPROVED: [],
      SCHEDULED: [],
      PUBLISHED: [],
      ARCHIVED: [],
    };

    for (const item of items) {
      grouped[item.status as ContentStatus].push(item as ContentItemWithDetails);
    }

    return grouped;
  }

  // Move item to new status (for kanban drag-drop)
  async moveToStatus(itemId: string, status: ContentStatus): Promise<ContentItemWithDetails> {
    const updates: ContentItemUpdate = { status };

    // Auto-set published date when moving to PUBLISHED
    if (status === 'PUBLISHED') {
      updates.publishedDate = new Date();
    }

    return this.updateContentItem(itemId, updates);
  }

  // Reschedule content item
  async reschedule(itemId: string, newDate: Date): Promise<ContentItemWithDetails> {
    return this.updateContentItem(itemId, {
      scheduledDate: newDate,
      status: 'SCHEDULED',
    });
  }

  // Bulk schedule items
  async bulkSchedule(
    items: Array<{ itemId: string; scheduledDate: Date }>
  ): Promise<ContentItemWithDetails[]> {
    const results: ContentItemWithDetails[] = [];

    for (const { itemId, scheduledDate } of items) {
      const updated = await this.reschedule(itemId, scheduledDate);
      results.push(updated);
    }

    return results;
  }

  // Get upcoming content (next 7 days)
  async getUpcomingContent(calendarId: string, days = 7): Promise<ContentItemWithDetails[]> {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const items = await prisma.contentItem.findMany({
      where: {
        calendarId,
        scheduledDate: {
          gte: now,
          lte: endDate,
        },
        status: {
          in: ['APPROVED', 'SCHEDULED'],
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return items as ContentItemWithDetails[];
  }

  // Get content pipeline summary
  async getPipelineSummary(calendarId: string): Promise<{
    total: number;
    byStatus: Record<ContentStatus, number>;
    upcoming: number;
    overdue: number;
  }> {
    const items = await prisma.contentItem.findMany({
      where: { calendarId },
    });

    const now = new Date();
    const byStatus: Record<ContentStatus, number> = {
      IDEA: 0,
      DRAFT: 0,
      REVIEW: 0,
      APPROVED: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };

    let upcoming = 0;
    let overdue = 0;

    for (const item of items) {
      byStatus[item.status as ContentStatus]++;

      if (item.scheduledDate) {
        if (item.scheduledDate > now && item.status !== 'PUBLISHED') {
          upcoming++;
        } else if (item.scheduledDate < now && item.status !== 'PUBLISHED') {
          overdue++;
        }
      }
    }

    return {
      total: items.length,
      byStatus,
      upcoming,
      overdue,
    };
  }

  // Calculate stats for calendar view
  private calculateStats(items: ContentItemWithDetails[]) {
    const byStatus: Record<ContentStatus, number> = {
      IDEA: 0,
      DRAFT: 0,
      REVIEW: 0,
      APPROVED: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };

    const byType: Record<ContentType, number> = {
      BLOG_POST: 0,
      SOCIAL_POST: 0,
      EMAIL: 0,
      VIDEO: 0,
      PODCAST: 0,
      WEBINAR: 0,
      EBOOK: 0,
      CASE_STUDY: 0,
      PRESS_RELEASE: 0,
      OTHER: 0,
    };

    const byChannel: Record<string, number> = {};

    for (const item of items) {
      byStatus[item.status]++;
      byType[item.contentType]++;

      for (const channel of item.channel) {
        byChannel[channel] = (byChannel[channel] || 0) + 1;
      }
    }

    return {
      total: items.length,
      byStatus,
      byType,
      byChannel,
    };
  }
}

export const contentCalendarService = new ContentCalendarService();
