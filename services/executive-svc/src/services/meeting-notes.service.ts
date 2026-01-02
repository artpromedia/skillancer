import { prisma } from '@skillancer/database';

// Meeting Notes Service
// Manages meeting notes, action items, and recurring meetings

export interface CreateMeetingInput {
  engagementId: string;
  title: string;
  meetingDate: Date;
  attendees: string[]; // user IDs
  agenda?: string;
  notes: string;
  decisions?: string[];
  createdBy: string;
}

export interface MeetingNotesInput {
  meetingId: string;
  notes: string;
  decisions?: string[];
}

export interface ActionItemInput {
  meetingNoteId?: string;
  engagementId: string;
  title: string;
  description?: string;
  assigneeId: string;
  dueDate?: Date;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class MeetingNotesService {
  // Create meeting
  async createMeeting(input: CreateMeetingInput) {
    return prisma.meetingNote.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        meetingDate: input.meetingDate,
        attendees: input.attendees,
        agenda: input.agenda,
        notes: input.notes,
        decisions: input.decisions || [],
        createdBy: input.createdBy,
      },
    });
  }

  // Get meetings
  async getMeetings(
    engagementId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      attendeeId?: string;
    }
  ) {
    const where: any = { engagementId };

    if (options?.startDate && options?.endDate) {
      where.meetingDate = {
        gte: options.startDate,
        lte: options.endDate,
      };
    }
    if (options?.attendeeId) where.attendees = { has: options.attendeeId };

    return prisma.meetingNote.findMany({
      where,
      include: {
        actionItems: true,
      },
      orderBy: { meetingDate: 'desc' },
    });
  }

  // Get single meeting with details
  async getMeeting(id: string) {
    return prisma.meetingNote.findUnique({
      where: { id },
      include: {
        actionItems: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  // Update meeting notes
  async updateMeetingNotes(input: MeetingNotesInput) {
    return prisma.meetingNote.update({
      where: { id: input.meetingId },
      data: {
        notes: input.notes,
        decisions: input.decisions || [],
      },
    });
  }

  // Create action item
  async createActionItem(input: ActionItemInput) {
    return prisma.actionItem.create({
      data: {
        engagementId: input.engagementId,
        meetingNoteId: input.meetingNoteId,
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        priority: input.priority || 'MEDIUM',
        status: 'TODO',
      },
    });
  }

  // Get action items
  async getActionItems(
    engagementId: string,
    options?: {
      assigneeId?: string;
      status?: string;
      priority?: string;
      overdue?: boolean;
    }
  ) {
    const where: any = { engagementId };

    if (options?.assigneeId) where.assigneeId = options.assigneeId;
    if (options?.status) where.status = options.status;
    if (options?.priority) where.priority = options.priority;
    if (options?.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { not: 'DONE' };
    }

    return prisma.actionItem.findMany({
      where,
      include: {
        meetingNote: { select: { id: true, title: true, meetingDate: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  // Update action item status
  async updateActionItem(
    id: string,
    data: Partial<{
      status: string;
      completedAt: Date;
    }>
  ) {
    const updateData: any = { ...data };
    if (data.status === 'DONE') {
      updateData.completedAt = new Date();
    }

    return prisma.actionItem.update({
      where: { id },
      data: updateData,
    });
  }

  // Complete action item
  async completeActionItem(id: string) {
    return this.updateActionItem(id, {
      status: 'DONE',
      completedAt: new Date(),
    });
  }

  // Get action items widget data
  async getActionItemsWidgetData(engagementId: string) {
    const items = await this.getActionItems(engagementId);

    const total = items.length;
    const todo = items.filter((i) => i.status === 'TODO').length;
    const inProgress = items.filter((i) => i.status === 'IN_PROGRESS').length;
    const done = items.filter((i) => i.status === 'DONE').length;
    const overdue = items.filter(
      (i) => i.status !== 'DONE' && i.dueDate && i.dueDate < new Date()
    ).length;

    const byPriority = {
      high: items.filter((i) => i.priority === 'HIGH' && i.status !== 'DONE').length,
      medium: items.filter((i) => i.priority === 'MEDIUM' && i.status !== 'DONE').length,
      low: items.filter((i) => i.priority === 'LOW' && i.status !== 'DONE').length,
    };

    const byAssignee: Record<string, { assigneeId: string; count: number }> = {};
    for (const item of items.filter((i) => i.status !== 'DONE')) {
      if (!byAssignee[item.assigneeId]) {
        byAssignee[item.assigneeId] = { assigneeId: item.assigneeId, count: 0 };
      }
      byAssignee[item.assigneeId].count++;
    }

    return {
      total,
      todo,
      inProgress,
      done,
      overdue,
      byPriority,
      byAssignee: Object.values(byAssignee).sort((a, b) => b.count - a.count),
      highPriorityItems: items
        .filter((i) => i.priority === 'HIGH' && i.status !== 'DONE')
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          title: i.title,
          priority: i.priority,
          dueDate: i.dueDate,
          assigneeId: i.assigneeId,
          isOverdue: i.dueDate && i.dueDate < new Date(),
        })),
    };
  }

  // Get upcoming meetings widget
  async getUpcomingMeetingsWidget(engagementId: string, days: number = 7) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const meetings = await this.getMeetings(engagementId, {
      startDate: new Date(),
      endDate,
    });

    return {
      count: meetings.length,
      meetings: meetings.slice(0, 5).map((m) => ({
        id: m.id,
        title: m.title,
        meetingDate: m.meetingDate,
        attendeesCount: m.attendees.length,
        hasAgenda: !!m.agenda,
      })),
    };
  }
}

export const meetingNotesService = new MeetingNotesService();
