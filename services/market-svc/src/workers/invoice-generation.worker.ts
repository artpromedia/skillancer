/**
 * @module @skillancer/market-svc/workers/invoice-generation
 * Invoice Generation Worker - Automatically generates weekly invoices for hourly contracts
 */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default interval for running the invoice generation job (weekly)
 */
const DEFAULT_GENERATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Default interval for running the reminder job (daily)
 */
const DEFAULT_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Days before due date to send reminders
 */
const REMINDER_DAYS = [3, 1, 0] as const;

/**
 * Grace period days after due date before marking as overdue
 */
const OVERDUE_GRACE_DAYS = 1;

// =============================================================================
// INTERFACES
// =============================================================================

export interface InvoiceGenerationWorkerDeps {
  prisma: PrismaClient;
  logger: Logger;
  sendEmail?: (params: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
  }) => Promise<void>;
}

export interface InvoiceGenerationWorkerConfig {
  generationIntervalMs?: number;
  reminderIntervalMs?: number;
  enabled?: boolean;
}

export interface InvoiceGenerationResult {
  generatedCount: number;
  skippedCount: number;
  failedCount: number;
  contractIds: string[];
  errors: Array<{ contractId: string; error: string }>;
}

export interface ReminderResult {
  sentCount: number;
  failedCount: number;
  overdueMarked: number;
  invoiceIds: string[];
  errors: Array<{ invoiceId: string; error: string }>;
}

// =============================================================================
// WORKER CLASS
// =============================================================================

export interface InvoiceGenerationWorker {
  start(): void;
  stop(): void;
  runOnce(): Promise<InvoiceGenerationResult>;
  runReminders(): Promise<ReminderResult>;
}

export function createInvoiceGenerationWorker(
  deps: InvoiceGenerationWorkerDeps,
  config: InvoiceGenerationWorkerConfig = {}
): InvoiceGenerationWorker {
  const {
    generationIntervalMs = DEFAULT_GENERATION_INTERVAL_MS,
    reminderIntervalMs = DEFAULT_REMINDER_INTERVAL_MS,
    enabled = true,
  } = config;

  let generationTimer: NodeJS.Timeout | null = null;
  let reminderTimer: NodeJS.Timeout | null = null;
  let isRunning = false;

  const { prisma, logger, sendEmail } = deps;

  // ---------------------------------------------------------------------------
  // Helper: Get week boundaries
  // ---------------------------------------------------------------------------
  function getWeekBoundaries(): { weekStart: Date; weekEnd: Date } {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);
    weekEnd.setDate(weekEnd.getDate() - 1); // End is yesterday

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    return { weekStart, weekEnd };
  }

  // ---------------------------------------------------------------------------
  // Generate invoice for a single contract
  // ---------------------------------------------------------------------------
  async function generateInvoiceForContract(
    contract: {
      id: string;
      title: string;
      hourlyRate: number | null;
      freelancerUserId: string;
      clientUserId: string;
      freelancer: { email: string; displayName: string | null };
      client: { email: string; displayName: string | null };
    },
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ invoice: { id: string } | null; skipped: boolean }> {
    // Get unbilled time entries for this period
    const timeEntries = await prisma.timeEntryV2.findMany({
      where: {
        contractId: contract.id,
        status: 'APPROVED',
        invoicedAt: null,
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: { date: 'asc' },
    });

    if (timeEntries.length === 0) {
      return { invoice: null, skipped: true };
    }

    // Calculate total hours and amount
    const totalMinutes = timeEntries.reduce(
      (sum: number, entry: { durationMinutes: number }) => sum + entry.durationMinutes,
      0
    );
    const totalHours = totalMinutes / 60;
    const hourlyRate = contract.hourlyRate ?? 0;
    const totalAmount = Math.round(totalHours * hourlyRate * 100) / 100;

    if (totalAmount <= 0) {
      return { invoice: null, skipped: true };
    }

    // Calculate fees (10% platform fee)
    const platformFeePercent = 10;
    const platformFee = Math.round(totalAmount * platformFeePercent) / 100;
    const freelancerAmount = totalAmount - platformFee;

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    const invoiceNumber = `INV-${year}${month}-${timestamp}`;

    // Set due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    dueDate.setHours(23, 59, 59, 999);

    // Create invoice with line items
    const invoice = await prisma.$transaction(async (tx) => {
      // Create invoice
      const newInvoice = await tx.contractInvoice.create({
        data: {
          contractId: contract.id,
          invoiceNumber,
          status: 'DRAFT',
          subtotal: totalAmount,
          total: totalAmount,
          freelancerAmount,
          platformFee,
          issuedAt: new Date(),
          dueAt: dueDate,
          periodStart,
          periodEnd,
          clientUserId: contract.clientUserId,
          freelancerUserId: contract.freelancerUserId,
          reminderCount: 0,
          hoursLogged: totalHours,
          notes: `Weekly invoice for ${contract.title} (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})\nTotal hours: ${totalHours.toFixed(2)} @ $${hourlyRate}/hr`,
        },
      });

      // Create line items for each time entry
      for (const entry of timeEntries) {
        const entryHours = (entry as { durationMinutes: number }).durationMinutes / 60;
        const entryAmount = Math.round(entryHours * hourlyRate * 100) / 100;

        await tx.invoiceLineItem.create({
          data: {
            invoiceId: newInvoice.id,
            type: 'TIME_ENTRY',
            description:
              (entry as { description?: string }).description ||
              `Work on ${(entry as { date: Date }).date.toLocaleDateString()}`,
            quantity: entryHours,
            unitPrice: hourlyRate,
            amount: entryAmount,
            timeEntryId: (entry as { id: string }).id,
          },
        });

        // Mark time entry as invoiced
        await tx.timeEntryV2.update({
          where: { id: (entry as { id: string }).id },
          data: { invoicedAt: new Date() },
        });
      }

      return newInvoice;
    });

    logger.info({
      msg: 'Invoice generated',
      invoiceId: invoice.id,
      contractId: contract.id,
      amount: totalAmount,
      timeEntries: timeEntries.length,
      hours: totalHours,
    });

    return { invoice, skipped: false };
  }

  // ---------------------------------------------------------------------------
  // Run generation job
  // ---------------------------------------------------------------------------
  async function runGeneration(): Promise<InvoiceGenerationResult> {
    const result: InvoiceGenerationResult = {
      generatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      contractIds: [],
      errors: [],
    };

    try {
      const { weekStart, weekEnd } = getWeekBoundaries();

      // Find all active hourly contracts
      const contracts = await prisma.contractV2.findMany({
        where: {
          status: 'ACTIVE',
          rateType: 'HOURLY',
          hourlyRate: { not: null },
        },
        include: {
          freelancer: { select: { id: true, email: true, displayName: true } },
          client: { select: { id: true, email: true, displayName: true } },
        },
      });

      logger.info({
        msg: 'Starting invoice generation',
        contractCount: contracts.length,
        periodStart: weekStart.toISOString(),
        periodEnd: weekEnd.toISOString(),
      });

      for (const contract of contracts) {
        try {
          const { invoice, skipped } = await generateInvoiceForContract(
            {
              id: contract.id,
              title: contract.title,
              hourlyRate: contract.hourlyRate ? Number(contract.hourlyRate) : null,
              freelancerUserId: contract.freelancerUserId,
              clientUserId: contract.clientUserId,
              freelancer: contract.freelancer,
              client: contract.client,
            },
            weekStart,
            weekEnd
          );

          if (skipped) {
            result.skippedCount++;
          } else if (invoice) {
            result.generatedCount++;
            result.contractIds.push(contract.id);
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            contractId: contract.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          logger.error({
            msg: 'Failed to generate invoice for contract',
            contractId: contract.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info({
        msg: 'Invoice generation complete',
        generated: result.generatedCount,
        skipped: result.skippedCount,
        failed: result.failedCount,
      });
    } catch (error) {
      logger.error({
        msg: 'Invoice generation job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Run reminder job
  // ---------------------------------------------------------------------------
  async function runReminders(): Promise<ReminderResult> {
    const result: ReminderResult = {
      sentCount: 0,
      failedCount: 0,
      overdueMarked: 0,
      invoiceIds: [],
      errors: [],
    };

    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Find invoices needing reminders
      // Sent invoices with due date approaching
      for (const days of REMINDER_DAYS) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);

        const invoices = await prisma.contractInvoice.findMany({
          where: {
            status: { in: ['SENT', 'VIEWED'] },
            dueAt: {
              gte: targetDate,
              lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
            },
            reminderCount: { lt: 3 }, // Max 3 reminders
          },
          include: {
            contract: {
              select: {
                title: true,
                client: { select: { email: true, displayName: true } },
              },
            },
          },
        });

        for (const invoice of invoices) {
          try {
            // Send reminder email
            if (
              sendEmail &&
              (invoice as { contract?: { client?: { email?: string } } }).contract?.client?.email
            ) {
              const invoiceContract = invoice as {
                contract: { client: { email: string }; title: string };
              };
              await sendEmail({
                to: invoiceContract.contract.client.email,
                subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
                template: 'invoice-reminder',
                data: {
                  invoiceNumber: invoice.invoiceNumber,
                  amount: Number(invoice.total),
                  dueDate: invoice.dueAt,
                  contractTitle: invoiceContract.contract.title,
                  daysUntilDue: days,
                },
              });
            }

            // Update reminder count
            await prisma.contractInvoice.update({
              where: { id: invoice.id },
              data: {
                reminderCount: { increment: 1 },
                lastReminderSentAt: new Date(),
              },
            });

            result.sentCount++;
            result.invoiceIds.push(invoice.id);

            logger.info({
              msg: 'Invoice reminder sent',
              invoiceId: invoice.id,
              daysUntilDue: days,
            });
          } catch (error) {
            result.failedCount++;
            result.errors.push({
              invoiceId: invoice.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Mark overdue invoices
      const overdueDate = new Date(now);
      overdueDate.setDate(overdueDate.getDate() - OVERDUE_GRACE_DAYS);

      const overdueUpdate = await prisma.contractInvoice.updateMany({
        where: {
          status: { in: ['SENT', 'VIEWED'] },
          dueAt: { lt: overdueDate },
        },
        data: {
          status: 'OVERDUE',
        },
      });

      result.overdueMarked = overdueUpdate.count;

      if (overdueUpdate.count > 0) {
        logger.info({
          msg: 'Invoices marked as overdue',
          count: overdueUpdate.count,
        });
      }
    } catch (error) {
      logger.error({
        msg: 'Reminder job failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Worker lifecycle methods
  // ---------------------------------------------------------------------------
  function start(): void {
    if (!enabled) {
      logger.info({ msg: 'Invoice generation worker disabled' });
      return;
    }

    if (isRunning) {
      logger.warn({ msg: 'Invoice generation worker already running' });
      return;
    }

    isRunning = true;

    // Schedule invoice generation (weekly)
    generationTimer = setInterval(() => {
      void runGeneration();
    }, generationIntervalMs);

    // Schedule reminder job (daily)
    reminderTimer = setInterval(() => {
      void runReminders();
    }, reminderIntervalMs);

    logger.info({
      msg: 'Invoice generation worker started',
      generationIntervalMs,
      reminderIntervalMs,
    });

    // Run initial jobs after a short delay
    setTimeout(() => {
      void runReminders(); // Run reminders first
    }, 5000);
  }

  function stop(): void {
    if (generationTimer) {
      clearInterval(generationTimer);
      generationTimer = null;
    }
    if (reminderTimer) {
      clearInterval(reminderTimer);
      reminderTimer = null;
    }
    isRunning = false;
    logger.info({ msg: 'Invoice generation worker stopped' });
  }

  return {
    start,
    stop,
    runOnce: runGeneration,
    runReminders,
  };
}
