// @ts-nocheck
/**
 * Quarterly Tax Reminders Service
 * Schedule and manage quarterly tax payment reminders
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { getTaxVaultService } from './tax-vault-service.js';
import { getTaxCalculator } from './tax-calculator.js';

// ============================================================================
// TYPES
// ============================================================================

export interface QuarterlyReminder {
  id: string;
  userId: string;
  quarter: number;
  year: number;
  dueDate: Date;
  estimatedAmount: number;
  reminderDate: Date;
  status: ReminderStatus;
  channel: NotificationChannel[];
  sentAt?: Date;
  acknowledgedAt?: Date;
}

export type ReminderStatus = 'scheduled' | 'sent' | 'acknowledged' | 'paid' | 'overdue';
export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app';

export interface ReminderPreferences {
  userId: string;
  enabled: boolean;
  daysBeforeDue: number[];
  channels: NotificationChannel[];
  includePaymentLink: boolean;
  customMessage?: string;
}

export interface QuarterlyPaymentStatus {
  quarter: number;
  year: number;
  dueDate: Date;
  estimatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'upcoming' | 'due' | 'paid' | 'partial' | 'overdue';
  daysUntilDue: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_REMINDER_DAYS = [30, 14, 7, 1]; // Days before due date

const QUARTERLY_DUE_DATES: Record<number, { month: number; day: number }> = {
  1: { month: 3, day: 15 }, // April 15
  2: { month: 5, day: 15 }, // June 15
  3: { month: 8, day: 15 }, // September 15
  4: { month: 0, day: 15 }, // January 15 (next year)
};

// ============================================================================
// QUARTERLY REMINDERS SERVICE
// ============================================================================

export class QuarterlyRemindersService {
  private taxVaultService = getTaxVaultService();
  private taxCalculator = getTaxCalculator();

  // ==========================================================================
  // REMINDER PREFERENCES
  // ==========================================================================

  /**
   * Get or create reminder preferences
   */
  async getPreferences(userId: string): Promise<ReminderPreferences> {
    let prefs = await prisma.quarterlyReminderPrefs.findUnique({ where: { userId } });

    if (!prefs) {
      prefs = await prisma.quarterlyReminderPrefs.create({
        data: {
          userId,
          enabled: true,
          daysBeforeDue: DEFAULT_REMINDER_DAYS,
          channels: ['email', 'in_app'],
          includePaymentLink: true,
        },
      });
    }

    return {
      userId: prefs.userId,
      enabled: prefs.enabled,
      daysBeforeDue: prefs.daysBeforeDue as number[],
      channels: prefs.channels as NotificationChannel[],
      includePaymentLink: prefs.includePaymentLink,
      customMessage: prefs.customMessage || undefined,
    };
  }

  /**
   * Update reminder preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<ReminderPreferences, 'userId'>>
  ): Promise<ReminderPreferences> {
    const prefs = await prisma.quarterlyReminderPrefs.upsert({
      where: { userId },
      create: {
        userId,
        enabled: updates.enabled ?? true,
        daysBeforeDue: updates.daysBeforeDue ?? DEFAULT_REMINDER_DAYS,
        channels: updates.channels ?? ['email', 'in_app'],
        includePaymentLink: updates.includePaymentLink ?? true,
        customMessage: updates.customMessage,
      },
      update: {
        enabled: updates.enabled,
        daysBeforeDue: updates.daysBeforeDue,
        channels: updates.channels,
        includePaymentLink: updates.includePaymentLink,
        customMessage: updates.customMessage,
        updatedAt: new Date(),
      },
    });

    logger.info('Quarterly reminder preferences updated', { userId });

    return this.getPreferences(userId);
  }

  // ==========================================================================
  // PAYMENT STATUS
  // ==========================================================================

  /**
   * Get current quarterly payment status
   */
  async getPaymentStatus(userId: string): Promise<QuarterlyPaymentStatus> {
    const now = new Date();
    const currentQuarter = this.getCurrentQuarter();
    const year =
      currentQuarter.quarter === 4 && now.getMonth() === 0
        ? now.getFullYear() - 1
        : now.getFullYear();

    const dueDate = this.getQuarterDueDate(currentQuarter.quarter, year);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get estimated tax
    const estimate = await this.taxCalculator.calculateEstimate(userId, { year });
    const estimatedAmount = estimate.quarterlyPayment;

    // Get payments made this quarter
    const payments = await prisma.quarterlyTaxPayment.aggregate({
      where: {
        userId,
        quarter: currentQuarter.quarter,
        year,
      },
      _sum: { amount: true },
    });

    const paidAmount = payments._sum.amount?.toNumber() || 0;
    const remainingAmount = Math.max(0, estimatedAmount - paidAmount);

    let status: QuarterlyPaymentStatus['status'];
    if (paidAmount >= estimatedAmount) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    } else if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue <= 14) {
      status = 'due';
    } else {
      status = 'upcoming';
    }

    return {
      quarter: currentQuarter.quarter,
      year,
      dueDate,
      estimatedAmount,
      paidAmount,
      remainingAmount,
      status,
      daysUntilDue,
    };
  }

  /**
   * Get all quarterly statuses for the year
   */
  async getYearlyStatus(userId: string, year?: number): Promise<QuarterlyPaymentStatus[]> {
    const targetYear = year || new Date().getFullYear();
    const statuses: QuarterlyPaymentStatus[] = [];

    for (let quarter = 1; quarter <= 4; quarter++) {
      const dueDate = this.getQuarterDueDate(quarter, targetYear);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const estimate = await this.taxCalculator.calculateEstimate(userId, { year: targetYear });
      const estimatedAmount = estimate.quarterlyPayment;

      const payments = await prisma.quarterlyTaxPayment.aggregate({
        where: {
          userId,
          quarter,
          year: targetYear,
        },
        _sum: { amount: true },
      });

      const paidAmount = payments._sum.amount?.toNumber() || 0;
      const remainingAmount = Math.max(0, estimatedAmount - paidAmount);

      let status: QuarterlyPaymentStatus['status'];
      if (paidAmount >= estimatedAmount) {
        status = 'paid';
      } else if (paidAmount > 0) {
        status = 'partial';
      } else if (daysUntilDue < 0) {
        status = 'overdue';
      } else if (daysUntilDue <= 14) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      statuses.push({
        quarter,
        year: targetYear,
        dueDate,
        estimatedAmount,
        paidAmount,
        remainingAmount,
        status,
        daysUntilDue,
      });
    }

    return statuses;
  }

  // ==========================================================================
  // REMINDER SCHEDULING
  // ==========================================================================

  /**
   * Schedule reminders for a user
   */
  async scheduleReminders(userId: string): Promise<QuarterlyReminder[]> {
    const prefs = await this.getPreferences(userId);
    if (!prefs.enabled) {
      return [];
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const reminders: QuarterlyReminder[] = [];

    // Schedule for current and next year Q1
    for (let q = 1; q <= 4; q++) {
      const year = q === 4 ? currentYear : currentYear;
      const dueDate = this.getQuarterDueDate(q, year);

      // Skip if already past
      if (dueDate < now) continue;

      // Get estimated amount
      const estimate = await this.taxCalculator.calculateEstimate(userId, { year });
      const estimatedAmount = estimate.quarterlyPayment;

      // Create reminders for each configured day before due
      for (const daysBefore of prefs.daysBeforeDue) {
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);

        // Skip if reminder date is in the past
        if (reminderDate < now) continue;

        // Check if reminder already exists
        const existing = await prisma.quarterlyReminder.findFirst({
          where: {
            userId,
            quarter: q,
            year,
            reminderDate,
          },
        });

        if (!existing) {
          const reminder = await prisma.quarterlyReminder.create({
            data: {
              userId,
              quarter: q,
              year,
              dueDate,
              estimatedAmount,
              reminderDate,
              status: 'scheduled',
              channels: prefs.channels,
            },
          });

          reminders.push(this.mapReminder(reminder));
        }
      }
    }

    logger.info('Quarterly reminders scheduled', { userId, count: reminders.length });

    return reminders;
  }

  /**
   * Get pending reminders to send
   */
  async getPendingReminders(): Promise<QuarterlyReminder[]> {
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000); // Within next hour

    const reminders = await prisma.quarterlyReminder.findMany({
      where: {
        status: 'scheduled',
        reminderDate: {
          gte: now,
          lte: soon,
        },
      },
      include: {
        user: {
          select: { email: true, profile: true },
        },
      },
    });

    return reminders.map((r) => this.mapReminder(r));
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(reminderId: string): Promise<void> {
    await prisma.quarterlyReminder.update({
      where: { id: reminderId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Acknowledge reminder
   */
  async acknowledgeReminder(userId: string, reminderId: string): Promise<void> {
    await prisma.quarterlyReminder.updateMany({
      where: { id: reminderId, userId },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
    });
  }

  // ==========================================================================
  // NOTIFICATION CONTENT
  // ==========================================================================

  /**
   * Generate reminder notification content
   */
  async generateReminderContent(reminder: QuarterlyReminder): Promise<{
    subject: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
  }> {
    const vaultSummary = await this.taxVaultService.getVaultSummary(reminder.userId);
    const daysUntil = Math.ceil(
      (reminder.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    const hasEnough = vaultSummary.currentBalance >= reminder.estimatedAmount;
    const shortfall = Math.max(0, reminder.estimatedAmount - vaultSummary.currentBalance);

    let subject: string;
    let body: string;

    if (daysUntil <= 0) {
      subject = `⚠️ Q${reminder.quarter} Estimated Tax Payment Due Today`;
      body = `Your Q${reminder.quarter} ${reminder.year} estimated tax payment of $${reminder.estimatedAmount.toFixed(2)} is due today.`;
    } else if (daysUntil === 1) {
      subject = `🔔 Q${reminder.quarter} Tax Payment Due Tomorrow`;
      body = `Your Q${reminder.quarter} ${reminder.year} estimated tax payment of $${reminder.estimatedAmount.toFixed(2)} is due tomorrow.`;
    } else if (daysUntil <= 7) {
      subject = `📅 Q${reminder.quarter} Tax Payment Due in ${daysUntil} Days`;
      body = `Your Q${reminder.quarter} ${reminder.year} estimated tax payment of $${reminder.estimatedAmount.toFixed(2)} is due in ${daysUntil} days.`;
    } else {
      subject = `💰 Q${reminder.quarter} Tax Payment Reminder`;
      body = `Your Q${reminder.quarter} ${reminder.year} estimated tax payment of $${reminder.estimatedAmount.toFixed(2)} is due on ${reminder.dueDate.toLocaleDateString()}.`;
    }

    if (hasEnough) {
      body += `\n\n✅ Great news! Your Tax Vault has $${vaultSummary.currentBalance.toFixed(2)} - enough to cover this payment.`;
    } else {
      body += `\n\n⚠️ Your Tax Vault has $${vaultSummary.currentBalance.toFixed(2)}. You're $${shortfall.toFixed(2)} short.`;
    }

    return {
      subject,
      body,
      ctaText: hasEnough ? 'Make Payment' : 'Add to Tax Vault',
      ctaUrl: hasEnough
        ? `/finances/taxes/pay?quarter=${reminder.quarter}&year=${reminder.year}`
        : `/finances/taxes/vault`,
    };
  }

  /**
   * Get upcoming reminders for user
   */
  async getUpcomingReminders(userId: string, limit: number = 5): Promise<QuarterlyReminder[]> {
    const reminders = await prisma.quarterlyReminder.findMany({
      where: {
        userId,
        status: { in: ['scheduled', 'sent'] },
        reminderDate: { gte: new Date() },
      },
      orderBy: { reminderDate: 'asc' },
      take: limit,
    });

    return reminders.map((r) => this.mapReminder(r));
  }

  // ==========================================================================
  // OVERDUE HANDLING
  // ==========================================================================

  /**
   * Check and update overdue payments
   */
  async checkOverduePayments(): Promise<string[]> {
    const now = new Date();
    const overdueUserIds: string[] = [];

    // Get all users with tax vaults
    const vaults = await prisma.taxVault.findMany({
      select: { userId: true },
    });

    for (const vault of vaults) {
      const status = await this.getPaymentStatus(vault.userId);

      if (status.status === 'overdue') {
        // Create overdue notification if not already sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: vault.userId,
            type: 'tax_overdue',
            createdAt: { gte: today },
          },
        });

        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              userId: vault.userId,
              type: 'tax_overdue',
              title: `Q${status.quarter} Tax Payment Overdue`,
              message: `Your estimated tax payment of $${status.remainingAmount.toFixed(2)} was due on ${status.dueDate.toLocaleDateString()}.`,
              channel: 'email',
              data: {
                quarter: status.quarter,
                year: status.year,
                amount: status.remainingAmount,
              },
            },
          });

          overdueUserIds.push(vault.userId);
        }
      }
    }

    if (overdueUserIds.length > 0) {
      logger.info('Overdue tax payment notifications sent', { count: overdueUserIds.length });
    }

    return overdueUserIds;
  }

  // ==========================================================================
  // IRS PAYMENT INTEGRATION
  // ==========================================================================

  /**
   * Generate IRS EFTPS payment info
   */
  async getPaymentInstructions(
    userId: string,
    quarter: number,
    year: number
  ): Promise<{
    method: string;
    instructions: string[];
    links: Array<{ name: string; url: string }>;
    formNumber: string;
    dueDate: Date;
  }> {
    const dueDate = this.getQuarterDueDate(quarter, year);

    return {
      method: 'Electronic Federal Tax Payment System (EFTPS)',
      instructions: [
        'Visit EFTPS.gov and log in to your account',
        'Select "Make a Payment"',
        'Choose Form 1040-ES for estimated tax',
        `Select Q${quarter} ${year} as the tax period`,
        'Enter the payment amount',
        'Schedule the payment before the due date',
        'Save the confirmation number for your records',
      ],
      links: [
        { name: 'EFTPS', url: 'https://www.eftps.gov' },
        { name: 'IRS Direct Pay', url: 'https://www.irs.gov/payments/direct-pay' },
        { name: 'Form 1040-ES', url: 'https://www.irs.gov/forms-pubs/about-form-1040-es' },
      ],
      formNumber: '1040-ES',
      dueDate,
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getCurrentQuarter(): { quarter: number; year: number } {
    const now = new Date();
    const month = now.getMonth();

    // Map month to tax quarter
    if (month >= 0 && month <= 2) return { quarter: 1, year: now.getFullYear() };
    if (month >= 3 && month <= 5) return { quarter: 2, year: now.getFullYear() };
    if (month >= 6 && month <= 8) return { quarter: 3, year: now.getFullYear() };
    return { quarter: 4, year: now.getFullYear() };
  }

  private getQuarterDueDate(quarter: number, year: number): Date {
    const due = QUARTERLY_DUE_DATES[quarter];
    const dueYear = quarter === 4 ? year + 1 : year;
    return new Date(dueYear, due.month, due.day);
  }

  private mapReminder(r: any): QuarterlyReminder {
    return {
      id: r.id,
      userId: r.userId,
      quarter: r.quarter,
      year: r.year,
      dueDate: r.dueDate,
      estimatedAmount: r.estimatedAmount?.toNumber?.() ?? r.estimatedAmount,
      reminderDate: r.reminderDate,
      status: r.status,
      channel: r.channels as NotificationChannel[],
      sentAt: r.sentAt,
      acknowledgedAt: r.acknowledgedAt,
    };
  }
}

// Singleton instance
let quarterlyRemindersInstance: QuarterlyRemindersService | null = null;

export function getQuarterlyRemindersService(): QuarterlyRemindersService {
  if (!quarterlyRemindersInstance) {
    quarterlyRemindersInstance = new QuarterlyRemindersService();
  }
  return quarterlyRemindersInstance;
}

