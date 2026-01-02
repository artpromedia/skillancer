/**
 * Usage Billing Job
 *
 * Background job that runs daily to:
 * 1. Aggregate daily usage per customer
 * 2. Calculate overage charges
 * 3. Generate invoices at end of billing period
 * 4. Process payment retries for failed charges
 * 5. Send billing notifications
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { metrics } from '@skillancer/metrics';

// Types
interface UsageSummary {
  customerId: string;
  date: Date;
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  errorCount: number;
  bandwidthBytes: number;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  dueDate: Date;
}

interface BillingConfig {
  // Base plan prices (monthly)
  planPrices: Record<string, number>;
  // Overage rates per 1000 requests
  overageRates: Record<string, number>;
  // Plan limits (requests per month)
  planLimits: Record<string, number>;
  // Payment retry schedule (days after failure)
  retrySchedule: number[];
  // Tax rate (percentage)
  taxRate: number;
  // Grace period before suspension (days)
  suspensionGracePeriod: number;
}

const billingConfig: BillingConfig = {
  planPrices: {
    STARTER: 199,
    PROFESSIONAL: 499,
    ENTERPRISE: 0, // Custom pricing
  },
  overageRates: {
    STARTER: 0.5, // $0.50 per 1000 requests over limit
    PROFESSIONAL: 0.3,
    ENTERPRISE: 0.1,
  },
  planLimits: {
    STARTER: 1000,
    PROFESSIONAL: 10000,
    ENTERPRISE: 100000, // Default, can be customized
  },
  retrySchedule: [1, 3, 7], // Retry on day 1, 3, 7 after failure
  taxRate: 0, // No tax on B2B SaaS in most jurisdictions
  suspensionGracePeriod: 14,
};

/**
 * Main billing job entry point
 */
export async function runBillingJob(): Promise<void> {
  const startTime = Date.now();
  const jobId = `billing_${Date.now()}`;

  logger.info('Starting billing job', { jobId });

  try {
    // Step 1: Aggregate daily usage
    await aggregateDailyUsage(jobId);

    // Step 2: Check for billing period end
    const today = new Date();
    if (isBillingPeriodEnd(today)) {
      await generateMonthlyInvoices(jobId);
    }

    // Step 3: Process payment retries
    await processPaymentRetries(jobId);

    // Step 4: Check for accounts to suspend
    await checkSuspensions(jobId);

    // Step 5: Send usage alerts
    await sendUsageAlerts(jobId);

    const duration = Date.now() - startTime;
    logger.info('Billing job completed', { jobId, duration });
    metrics.recordHistogram('billing_job_duration_ms', duration);
  } catch (error) {
    logger.error('Billing job failed', { jobId, error });
    metrics.incrementCounter('billing_job_failures');
    throw error;
  }
}

/**
 * Aggregate daily API usage for each customer
 */
async function aggregateDailyUsage(jobId: string): Promise<void> {
  logger.info('Aggregating daily usage', { jobId });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  // Get all API usage records from yesterday
  // In real implementation, this would query APIUsage table
  const usageRecords = await prisma.aPIUsage.findMany({
    where: {
      timestamp: {
        gte: yesterday,
        lte: endOfYesterday,
      },
    },
    include: {
      apiKey: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Group by customer
  const usageByCustomer = new Map<string, UsageSummary>();

  for (const record of usageRecords) {
    const customerId = record.apiKey.customerId;

    if (!usageByCustomer.has(customerId)) {
      usageByCustomer.set(customerId, {
        customerId,
        date: yesterday,
        totalRequests: 0,
        requestsByEndpoint: {},
        errorCount: 0,
        bandwidthBytes: 0,
      });
    }

    const summary = usageByCustomer.get(customerId)!;
    summary.totalRequests++;
    summary.requestsByEndpoint[record.endpoint] =
      (summary.requestsByEndpoint[record.endpoint] || 0) + 1;

    if (record.statusCode >= 400) {
      summary.errorCount++;
    }

    summary.bandwidthBytes += record.responseSize || 0;
  }

  // Store daily summaries
  for (const summary of usageByCustomer.values()) {
    await prisma.aPIDailyUsage.upsert({
      where: {
        customerId_date: {
          customerId: summary.customerId,
          date: summary.date,
        },
      },
      update: {
        totalRequests: summary.totalRequests,
        requestsByEndpoint: summary.requestsByEndpoint,
        errorCount: summary.errorCount,
        bandwidthBytes: BigInt(summary.bandwidthBytes),
      },
      create: {
        customerId: summary.customerId,
        date: summary.date,
        totalRequests: summary.totalRequests,
        requestsByEndpoint: summary.requestsByEndpoint,
        errorCount: summary.errorCount,
        bandwidthBytes: BigInt(summary.bandwidthBytes),
      },
    });
  }

  logger.info('Daily usage aggregated', {
    jobId,
    customerCount: usageByCustomer.size,
    totalRecords: usageRecords.length,
  });
}

/**
 * Check if today is the end of a billing period
 */
function isBillingPeriodEnd(date: Date): boolean {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1; // Last day of month
}

/**
 * Generate monthly invoices for all customers
 */
async function generateMonthlyInvoices(jobId: string): Promise<void> {
  logger.info('Generating monthly invoices', { jobId });

  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get all active customers
  const customers = await prisma.aPICustomer.findMany({
    where: {
      status: 'active',
    },
  });

  let invoicesGenerated = 0;
  let totalRevenue = 0;

  for (const customer of customers) {
    try {
      const invoice = await generateCustomerInvoice(customer, periodStart, periodEnd);

      if (invoice.total > 0) {
        // Store invoice
        await prisma.aPIInvoice.create({
          data: {
            customerId: customer.id,
            periodStart,
            periodEnd,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            total: invoice.total,
            lineItems: invoice.lineItems,
            status: 'pending',
            dueDate: invoice.dueDate,
          },
        });

        // Queue for payment processing
        await queuePayment(customer.id, invoice.total);

        invoicesGenerated++;
        totalRevenue += invoice.total;
      }
    } catch (error) {
      logger.error('Failed to generate invoice', {
        jobId,
        customerId: customer.id,
        error,
      });
    }
  }

  logger.info('Monthly invoices generated', {
    jobId,
    invoicesGenerated,
    totalRevenue,
  });

  metrics.recordGauge('monthly_invoices_generated', invoicesGenerated);
  metrics.recordGauge('monthly_revenue', totalRevenue);
}

/**
 * Generate invoice for a single customer
 */
async function generateCustomerInvoice(
  customer: any,
  periodStart: Date,
  periodEnd: Date
): Promise<Invoice> {
  const lineItems: InvoiceLineItem[] = [];

  // Base plan charge
  const planPrice = billingConfig.planPrices[customer.plan] || 0;
  if (planPrice > 0) {
    lineItems.push({
      description: `${customer.plan} Plan - Monthly`,
      quantity: 1,
      unitPrice: planPrice,
      amount: planPrice,
    });
  }

  // Calculate total usage for the period
  const usageSummary = await prisma.aPIDailyUsage.aggregate({
    where: {
      customerId: customer.id,
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    _sum: {
      totalRequests: true,
    },
  });

  const totalRequests = usageSummary._sum.totalRequests || 0;
  const planLimit = customer.monthlyRequestLimit || billingConfig.planLimits[customer.plan];
  const overage = Math.max(0, totalRequests - planLimit);

  // Overage charges
  if (overage > 0) {
    const overageRate = billingConfig.overageRates[customer.plan] || 0.5;
    const overageCharge = Math.ceil(overage / 1000) * overageRate;

    lineItems.push({
      description: `API Overage (${overage.toLocaleString()} requests over ${planLimit.toLocaleString()} limit)`,
      quantity: Math.ceil(overage / 1000),
      unitPrice: overageRate,
      amount: overageCharge,
    });
  }

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * billingConfig.taxRate;
  const total = subtotal + tax;

  // Due date is 30 days from invoice generation
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  return {
    customerId: customer.id,
    periodStart,
    periodEnd,
    lineItems,
    subtotal,
    tax,
    total,
    dueDate,
  };
}

/**
 * Queue payment for processing
 */
async function queuePayment(customerId: string, amount: number): Promise<void> {
  // In production, this would integrate with Stripe or other payment processor
  logger.info('Payment queued', { customerId, amount });

  // Create payment intent record
  await prisma.aPIPaymentIntent.create({
    data: {
      customerId,
      amount,
      status: 'pending',
      attempts: 0,
    },
  });
}

/**
 * Process failed payment retries
 */
async function processPaymentRetries(jobId: string): Promise<void> {
  logger.info('Processing payment retries', { jobId });

  const failedPayments = await prisma.aPIPaymentIntent.findMany({
    where: {
      status: 'failed',
      attempts: {
        lt: billingConfig.retrySchedule.length,
      },
    },
    include: {
      customer: true,
    },
  });

  let retriesProcessed = 0;
  let retriesSucceeded = 0;

  for (const payment of failedPayments) {
    const daysSinceLastAttempt = Math.floor(
      (Date.now() - payment.lastAttemptAt!.getTime()) / (1000 * 60 * 60 * 24)
    );

    const nextRetryDay = billingConfig.retrySchedule[payment.attempts];

    if (daysSinceLastAttempt >= nextRetryDay) {
      try {
        // Attempt payment (would integrate with payment processor)
        const success = await attemptPayment(payment);

        await prisma.aPIPaymentIntent.update({
          where: { id: payment.id },
          data: {
            status: success ? 'succeeded' : 'failed',
            attempts: payment.attempts + 1,
            lastAttemptAt: new Date(),
          },
        });

        retriesProcessed++;
        if (success) {
          retriesSucceeded++;

          // Reactivate suspended account if needed
          if (payment.customer.status === 'suspended') {
            await prisma.aPICustomer.update({
              where: { id: payment.customerId },
              data: { status: 'active' },
            });
          }
        }
      } catch (error) {
        logger.error('Payment retry failed', {
          jobId,
          paymentId: payment.id,
          error,
        });
      }
    }
  }

  logger.info('Payment retries processed', {
    jobId,
    retriesProcessed,
    retriesSucceeded,
  });
}

/**
 * Attempt to process a payment
 */
async function attemptPayment(payment: any): Promise<boolean> {
  // In production, this would integrate with Stripe
  // For now, simulate 80% success rate
  logger.info('Attempting payment', {
    paymentId: payment.id,
    amount: payment.amount,
  });

  // Simulated payment processing
  return Math.random() > 0.2;
}

/**
 * Check for accounts that should be suspended
 */
async function checkSuspensions(jobId: string): Promise<void> {
  logger.info('Checking for accounts to suspend', { jobId });

  const gracePeriodAgo = new Date();
  gracePeriodAgo.setDate(gracePeriodAgo.getDate() - billingConfig.suspensionGracePeriod);

  // Find accounts with failed payments past grace period
  const accountsToSuspend = await prisma.aPICustomer.findMany({
    where: {
      status: 'active',
      paymentIntents: {
        some: {
          status: 'failed',
          attempts: billingConfig.retrySchedule.length,
          lastAttemptAt: {
            lt: gracePeriodAgo,
          },
        },
      },
    },
  });

  for (const account of accountsToSuspend) {
    await prisma.aPICustomer.update({
      where: { id: account.id },
      data: { status: 'suspended' },
    });

    // Send suspension notification
    await sendSuspensionNotification(account);

    logger.warn('Account suspended', {
      jobId,
      customerId: account.id,
      companyName: account.companyName,
    });
  }

  if (accountsToSuspend.length > 0) {
    metrics.incrementCounter('accounts_suspended', accountsToSuspend.length);
  }
}

/**
 * Send usage alerts to customers approaching limits
 */
async function sendUsageAlerts(jobId: string): Promise<void> {
  logger.info('Sending usage alerts', { jobId });

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get current month usage for all active customers
  const usageSummaries = await prisma.aPIDailyUsage.groupBy({
    by: ['customerId'],
    where: {
      date: {
        gte: monthStart,
      },
    },
    _sum: {
      totalRequests: true,
    },
  });

  // Get customer details
  const customers = await prisma.aPICustomer.findMany({
    where: {
      status: 'active',
      id: {
        in: usageSummaries.map((s) => s.customerId),
      },
    },
  });

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  let alertsSent = 0;

  for (const summary of usageSummaries) {
    const customer = customerMap.get(summary.customerId);
    if (!customer) continue;

    const limit = customer.monthlyRequestLimit || billingConfig.planLimits[customer.plan];
    const usage = summary._sum.totalRequests || 0;
    const usagePercent = (usage / limit) * 100;

    // Send alerts at 75%, 90%, and 100%
    if (usagePercent >= 75 && usagePercent < 90) {
      await sendUsageAlertEmail(customer, 75, usage, limit);
      alertsSent++;
    } else if (usagePercent >= 90 && usagePercent < 100) {
      await sendUsageAlertEmail(customer, 90, usage, limit);
      alertsSent++;
    } else if (usagePercent >= 100) {
      await sendUsageAlertEmail(customer, 100, usage, limit);
      alertsSent++;
    }
  }

  logger.info('Usage alerts sent', { jobId, alertsSent });
}

/**
 * Send usage alert email
 */
async function sendUsageAlertEmail(
  customer: any,
  threshold: number,
  currentUsage: number,
  limit: number
): Promise<void> {
  logger.info('Sending usage alert', {
    customerId: customer.id,
    threshold,
    currentUsage,
    limit,
  });

  // In production, this would integrate with notification service
  // For now, just log the alert
}

/**
 * Send suspension notification
 */
async function sendSuspensionNotification(customer: any): Promise<void> {
  logger.info('Sending suspension notification', {
    customerId: customer.id,
    email: customer.contactEmail,
  });

  // In production, this would send email via notification service
}

/**
 * Get billing summary for a customer
 */
export async function getCustomerBillingSummary(customerId: string): Promise<{
  currentPeriodUsage: number;
  currentPeriodLimit: number;
  estimatedBill: number;
  outstandingBalance: number;
  lastPaymentDate: Date | null;
  nextBillingDate: Date;
}> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const customer = await prisma.aPICustomer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get current period usage
  const usageSummary = await prisma.aPIDailyUsage.aggregate({
    where: {
      customerId,
      date: {
        gte: monthStart,
      },
    },
    _sum: {
      totalRequests: true,
    },
  });

  const currentPeriodUsage = usageSummary._sum.totalRequests || 0;
  const currentPeriodLimit =
    customer.monthlyRequestLimit || billingConfig.planLimits[customer.plan];

  // Calculate estimated bill
  const planPrice = billingConfig.planPrices[customer.plan] || 0;
  const overage = Math.max(0, currentPeriodUsage - currentPeriodLimit);
  const overageCharge =
    Math.ceil(overage / 1000) * (billingConfig.overageRates[customer.plan] || 0);
  const estimatedBill = planPrice + overageCharge;

  // Get outstanding invoices
  const outstandingInvoices = await prisma.aPIInvoice.aggregate({
    where: {
      customerId,
      status: 'pending',
    },
    _sum: {
      total: true,
    },
  });

  const outstandingBalance = outstandingInvoices._sum.total || 0;

  // Get last payment
  const lastPayment = await prisma.aPIPaymentIntent.findFirst({
    where: {
      customerId,
      status: 'succeeded',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return {
    currentPeriodUsage,
    currentPeriodLimit,
    estimatedBill,
    outstandingBalance,
    lastPaymentDate: lastPayment?.createdAt || null,
    nextBillingDate: nextMonth,
  };
}

// Export for scheduling
export default {
  name: 'intelligence-api-billing',
  schedule: '0 2 * * *', // Run at 2 AM daily
  run: runBillingJob,
};
