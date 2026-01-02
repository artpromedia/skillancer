// @ts-nocheck
/**
 * @module @skillancer/market-svc/repositories/notification-template
 * Repository for notification template management
 */

import type { CreateTemplateParams, UpdateTemplateParams } from '../types/notification.types.js';
import type {
  NotificationTemplate,
  NotificationCategory,
  PrismaClient,
  Prisma,
} from '@skillancer/database';

export interface NotificationTemplateRepository {
  create(data: CreateTemplateParams): Promise<NotificationTemplate>;
  findById(id: string): Promise<NotificationTemplate | null>;
  findByType(type: string): Promise<NotificationTemplate | null>;
  findAll(options?: {
    isActive?: boolean;
    category?: NotificationCategory;
  }): Promise<NotificationTemplate[]>;
  update(id: string, data: UpdateTemplateParams): Promise<NotificationTemplate>;
  delete(id: string): Promise<void>;
  seedDefaultTemplates(): Promise<void>;
}

export function createNotificationTemplateRepository(
  prisma: PrismaClient
): NotificationTemplateRepository {
  return {
    async create(data: CreateTemplateParams): Promise<NotificationTemplate> {
      const createInput: Prisma.NotificationTemplateCreateInput = {
        type: data.type,
        name: data.name,
        category: data.category,
        inAppTitle: data.inAppTitle,
        inAppBody: data.inAppBody,
        defaultChannels: data.defaultChannels ?? ['IN_APP'],
      };

      if (data.description) createInput.description = data.description;
      if (data.emailSubject) createInput.emailSubject = data.emailSubject;
      if (data.emailHtmlTemplate) createInput.emailHtmlTemplate = data.emailHtmlTemplate;
      if (data.emailTextTemplate) createInput.emailTextTemplate = data.emailTextTemplate;
      if (data.pushTitle) createInput.pushTitle = data.pushTitle;
      if (data.pushBody) createInput.pushBody = data.pushBody;
      if (data.smsTemplate) createInput.smsTemplate = data.smsTemplate;
      if (data.defaultPriority) createInput.defaultPriority = data.defaultPriority;
      if (data.isGroupable !== undefined) createInput.isGroupable = data.isGroupable;
      if (data.groupKeyTemplate) createInput.groupKeyTemplate = data.groupKeyTemplate;

      return prisma.notificationTemplate.create({
        data: createInput,
      });
    },

    async findById(id: string): Promise<NotificationTemplate | null> {
      return prisma.notificationTemplate.findUnique({
        where: { id },
      });
    },

    async findByType(type: string): Promise<NotificationTemplate | null> {
      return prisma.notificationTemplate.findUnique({
        where: { type },
      });
    },

    async findAll(
      options: { isActive?: boolean; category?: NotificationCategory } = {}
    ): Promise<NotificationTemplate[]> {
      const where: Prisma.NotificationTemplateWhereInput = {};

      if (options.isActive !== undefined) where.isActive = options.isActive;
      if (options.category) where.category = options.category;

      return prisma.notificationTemplate.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    },

    async update(id: string, data: UpdateTemplateParams): Promise<NotificationTemplate> {
      const updateData: Prisma.NotificationTemplateUpdateInput = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.inAppTitle !== undefined) updateData.inAppTitle = data.inAppTitle;
      if (data.inAppBody !== undefined) updateData.inAppBody = data.inAppBody;
      if (data.emailSubject !== undefined) updateData.emailSubject = data.emailSubject;
      if (data.emailHtmlTemplate !== undefined)
        updateData.emailHtmlTemplate = data.emailHtmlTemplate;
      if (data.emailTextTemplate !== undefined)
        updateData.emailTextTemplate = data.emailTextTemplate;
      if (data.pushTitle !== undefined) updateData.pushTitle = data.pushTitle;
      if (data.pushBody !== undefined) updateData.pushBody = data.pushBody;
      if (data.smsTemplate !== undefined) updateData.smsTemplate = data.smsTemplate;
      if (data.defaultPriority !== undefined) updateData.defaultPriority = data.defaultPriority;
      if (data.defaultChannels !== undefined) updateData.defaultChannels = data.defaultChannels;
      if (data.isGroupable !== undefined) updateData.isGroupable = data.isGroupable;
      if (data.groupKeyTemplate !== undefined) updateData.groupKeyTemplate = data.groupKeyTemplate;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return prisma.notificationTemplate.update({
        where: { id },
        data: updateData,
      });
    },

    async delete(id: string): Promise<void> {
      await prisma.notificationTemplate.delete({
        where: { id },
      });
    },

    async seedDefaultTemplates(): Promise<void> {
      const defaultTemplates: CreateTemplateParams[] = [
        // Messages
        {
          type: 'NEW_MESSAGE',
          name: 'New Message',
          description: 'When you receive a new message',
          category: 'MESSAGES',
          inAppTitle: 'New message from {{senderName}}',
          inAppBody: '{{messagePreview}}',
          emailSubject: 'New message from {{senderName}}',
          emailHtmlTemplate:
            '<p>You have a new message from <strong>{{senderName}}</strong>:</p><p>{{messagePreview}}</p><p><a href="{{actionUrl}}">View Message</a></p>',
          emailTextTemplate:
            'You have a new message from {{senderName}}:\n\n{{messagePreview}}\n\nView: {{actionUrl}}',
          pushTitle: 'New message from {{senderName}}',
          pushBody: '{{messagePreview}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          isGroupable: true,
          groupKeyTemplate: 'messages:{{conversationId}}',
        },
        // Bids
        {
          type: 'BID_RECEIVED',
          name: 'Bid Received',
          description: 'When you receive a new bid on your project',
          category: 'PROJECTS',
          inAppTitle: 'New bid from {{freelancerName}}',
          inAppBody: '{{freelancerName}} bid {{bidAmount}} on {{projectTitle}}',
          emailSubject: 'New bid on {{projectTitle}}',
          emailHtmlTemplate:
            '<p><strong>{{freelancerName}}</strong> submitted a bid of <strong>{{bidAmount}}</strong> on your project <strong>{{projectTitle}}</strong>.</p><p><a href="{{actionUrl}}">Review Bid</a></p>',
          emailTextTemplate:
            '{{freelancerName}} submitted a bid of {{bidAmount}} on your project {{projectTitle}}.\n\nReview: {{actionUrl}}',
          pushTitle: 'New bid on {{projectTitle}}',
          pushBody: '{{freelancerName}} bid {{bidAmount}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          defaultPriority: 'HIGH',
        },
        {
          type: 'BID_ACCEPTED',
          name: 'Bid Accepted',
          description: 'When your bid is accepted',
          category: 'PROJECTS',
          inAppTitle: 'Your bid was accepted!',
          inAppBody: '{{clientName}} accepted your bid on {{projectTitle}}',
          emailSubject: 'Congratulations! Your bid was accepted',
          emailHtmlTemplate:
            '<p>Great news! <strong>{{clientName}}</strong> has accepted your bid on <strong>{{projectTitle}}</strong>.</p><p><a href="{{actionUrl}}">View Contract</a></p>',
          emailTextTemplate:
            'Great news! {{clientName}} has accepted your bid on {{projectTitle}}.\n\nView Contract: {{actionUrl}}',
          pushTitle: 'Bid Accepted! 🎉',
          pushBody: 'Your bid on {{projectTitle}} was accepted',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          defaultPriority: 'HIGH',
        },
        // Contracts
        {
          type: 'CONTRACT_STARTED',
          name: 'Contract Started',
          description: 'When a contract begins',
          category: 'CONTRACTS',
          inAppTitle: 'Contract started: {{contractTitle}}',
          inAppBody: 'Your contract with {{otherPartyName}} has started',
          emailSubject: 'Contract Started: {{contractTitle}}',
          emailHtmlTemplate:
            '<p>Your contract <strong>{{contractTitle}}</strong> with <strong>{{otherPartyName}}</strong> has officially started.</p><p><a href="{{actionUrl}}">View Contract</a></p>',
          emailTextTemplate:
            'Your contract {{contractTitle}} with {{otherPartyName}} has officially started.\n\nView: {{actionUrl}}',
          pushTitle: 'Contract Started',
          pushBody: '{{contractTitle}} with {{otherPartyName}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
        },
        {
          type: 'MILESTONE_COMPLETED',
          name: 'Milestone Completed',
          description: 'When a milestone is completed',
          category: 'CONTRACTS',
          inAppTitle: 'Milestone completed: {{milestoneName}}',
          inAppBody: '{{completedBy}} marked {{milestoneName}} as complete',
          emailSubject: 'Milestone Completed: {{milestoneName}}',
          emailHtmlTemplate:
            '<p>The milestone <strong>{{milestoneName}}</strong> on <strong>{{contractTitle}}</strong> has been completed by <strong>{{completedBy}}</strong>.</p><p><a href="{{actionUrl}}">Review Milestone</a></p>',
          emailTextTemplate:
            'The milestone {{milestoneName}} on {{contractTitle}} has been completed.\n\nReview: {{actionUrl}}',
          pushTitle: 'Milestone Completed',
          pushBody: '{{milestoneName}} on {{contractTitle}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
        },
        // Payments
        {
          type: 'PAYMENT_RECEIVED',
          name: 'Payment Received',
          description: 'When you receive a payment',
          category: 'PAYMENTS',
          inAppTitle: 'Payment received: {{amount}}',
          inAppBody: 'You received {{amount}} for {{contractTitle}}',
          emailSubject: 'Payment Received: {{amount}}',
          emailHtmlTemplate:
            '<p>You have received a payment of <strong>{{amount}}</strong> for <strong>{{contractTitle}}</strong>.</p><p><a href="{{actionUrl}}">View Details</a></p>',
          emailTextTemplate:
            'You have received a payment of {{amount}} for {{contractTitle}}.\n\nView: {{actionUrl}}',
          pushTitle: 'Payment Received 💰',
          pushBody: '{{amount}} for {{contractTitle}}',
          smsTemplate: 'You received {{amount}} for {{contractTitle}}. View: {{actionUrl}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          defaultPriority: 'HIGH',
        },
        {
          type: 'ESCROW_FUNDED',
          name: 'Escrow Funded',
          description: 'When funds are added to escrow',
          category: 'PAYMENTS',
          inAppTitle: 'Escrow funded: {{amount}}',
          inAppBody: '{{clientName}} funded escrow for {{contractTitle}}',
          emailSubject: 'Escrow Funded: {{amount}} for {{contractTitle}}',
          emailHtmlTemplate:
            '<p><strong>{{clientName}}</strong> has funded the escrow with <strong>{{amount}}</strong> for <strong>{{contractTitle}}</strong>.</p><p><a href="{{actionUrl}}">View Contract</a></p>',
          emailTextTemplate:
            '{{clientName}} has funded the escrow with {{amount}} for {{contractTitle}}.\n\nView: {{actionUrl}}',
          pushTitle: 'Escrow Funded',
          pushBody: '{{amount}} for {{contractTitle}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
        },
        // Reviews
        {
          type: 'REVIEW_RECEIVED',
          name: 'Review Received',
          description: 'When you receive a review',
          category: 'ACCOUNT',
          inAppTitle: 'New review from {{reviewerName}}',
          inAppBody: '{{reviewerName}} left you a {{rating}}-star review',
          emailSubject: 'You received a new review',
          emailHtmlTemplate:
            '<p><strong>{{reviewerName}}</strong> left you a <strong>{{rating}}-star</strong> review for <strong>{{contractTitle}}</strong>.</p><p>"{{reviewExcerpt}}"</p><p><a href="{{actionUrl}}">View Review</a></p>',
          emailTextTemplate:
            '{{reviewerName}} left you a {{rating}}-star review for {{contractTitle}}.\n\n"{{reviewExcerpt}}"\n\nView: {{actionUrl}}',
          pushTitle: 'New Review',
          pushBody: '{{reviewerName}} left a {{rating}}-star review',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
        },
        // System
        {
          type: 'SECURITY_ALERT',
          name: 'Security Alert',
          description: 'Security-related notifications',
          category: 'SYSTEM',
          inAppTitle: 'Security Alert',
          inAppBody: '{{alertMessage}}',
          emailSubject: 'Security Alert - Action Required',
          emailHtmlTemplate:
            '<p><strong>Security Alert:</strong></p><p>{{alertMessage}}</p><p>If you did not initiate this action, please <a href="{{actionUrl}}">secure your account</a> immediately.</p>',
          emailTextTemplate:
            'Security Alert:\n\n{{alertMessage}}\n\nIf you did not initiate this action, secure your account: {{actionUrl}}',
          pushTitle: '⚠️ Security Alert',
          pushBody: '{{alertMessage}}',
          smsTemplate:
            'Skillancer Security Alert: {{alertMessage}}. Secure your account: {{actionUrl}}',
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH', 'SMS'],
          defaultPriority: 'URGENT',
        },
      ];

      for (const template of defaultTemplates) {
        const existing = await prisma.notificationTemplate.findUnique({
          where: { type: template.type },
        });

        if (!existing) {
          await this.create(template);
        }
      }
    },
  };
}

