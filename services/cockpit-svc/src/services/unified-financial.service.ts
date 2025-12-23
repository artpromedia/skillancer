/**
 * Unified Financial Service
 * Consolidates transactions from all sources into unified view
 */

import {
  type PrismaClient,
  UnifiedTransactionSource,
  UnifiedTransactionType,
  UnifiedSyncStatus,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { currencyService } from './currency.service';
import { UnifiedTransactionRepository } from '../repositories/unified-transaction.repository';

import type {
  SourceTransaction,
  UnifiedTransactionData,
  ConsolidatedDashboard,
} from '../types/unified-financial.types';

export class UnifiedFinancialService {
  private txRepo: UnifiedTransactionRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.txRepo = new UnifiedTransactionRepository(prisma);
  }

  /**
   * Ingest transaction from any source
   */
  async ingestTransaction(
    tx: SourceTransaction,
    userId: string,
    baseCurrency = 'USD'
  ): Promise<string> {
    const deduplicationKey = this.generateDeduplicationKey(tx);

    // Check for duplicate
    const existing = await this.txRepo.findByDeduplicationKey(userId, deduplicationKey);
    if (existing) {
      logger.debug('Duplicate transaction skipped', {
        externalId: tx.externalId,
        source: tx.source,
      });
      return existing.id;
    }

    // Convert currency
    const conversion = await currencyService.convert(
      tx.amount,
      tx.currency,
      baseCurrency,
      tx.transactionDate
    );

    const data: UnifiedTransactionData = {
      userId,
      source: tx.source,
      transactionType: tx.type,
      externalId: tx.externalId,
      deduplicationKey,
      originalAmount: tx.amount,
      originalCurrency: tx.currency,
      convertedAmount: conversion.convertedAmount,
      baseCurrency,
      exchangeRate: conversion.rate,
      exchangeRateDate: conversion.rateDate,
      netAmount: conversion.convertedAmount,
      transactionDate: tx.transactionDate,
      description: tx.description,
      category: tx.category,
      taxDeductible: false,
      syncStatus: UnifiedSyncStatus.SYNCED,
      lastSyncedAt: new Date(),
      metadata: tx.metadata,
    };

    const created = await this.txRepo.create(data);
    logger.info('Transaction ingested', { id: created.id, source: tx.source });
    return created.id;
  }

  /**
   * Get consolidated dashboard data
   */
  async getDashboard(userId: string, baseCurrency = 'USD'): Promise<ConsolidatedDashboard> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [monthlyAgg, yearlyAgg, bySource, monthlyTrend] = await Promise.all([
      this.txRepo.getAggregatesBySource(userId, monthStart, now),
      this.txRepo.getAggregatesBySource(userId, yearStart, now),
      this.txRepo.getAggregatesBySource(userId, yearStart, now),
      this.txRepo.getMonthlyTotals(userId, new Date(now.getFullYear() - 1, now.getMonth(), 1), now),
    ]);

    const mtdIncome = monthlyAgg.reduce((sum, s) => sum + s.totalIncome, 0);
    const mtdExpense = monthlyAgg.reduce((sum, s) => sum + s.totalExpense, 0);
    const ytdIncome = yearlyAgg.reduce((sum, s) => sum + s.totalIncome, 0);
    const ytdExpense = yearlyAgg.reduce((sum, s) => sum + s.totalExpense, 0);

    return {
      userId,
      baseCurrency,
      generatedAt: now,
      currentPeriod: {
        start: monthStart,
        end: now,
        type: 'MONTHLY' as any,
        totalIncome: mtdIncome,
        totalExpenses: mtdExpense,
        netProfit: mtdIncome - mtdExpense,
        profitMargin: mtdIncome > 0 ? ((mtdIncome - mtdExpense) / mtdIncome) * 100 : 0,
      },
      yearToDate: {
        totalIncome: ytdIncome,
        totalExpenses: ytdExpense,
        netProfit: ytdIncome - ytdExpense,
        profitMargin: ytdIncome > 0 ? ((ytdIncome - ytdExpense) / ytdIncome) * 100 : 0,
        taxableIncome: ytdIncome - ytdExpense,
        estimatedTax: (ytdIncome - ytdExpense) * 0.25,
      },
      incomeBySource: bySource.map((s) => ({
        source: s.source,
        amount: s.totalIncome,
        percentage: ytdIncome > 0 ? (s.totalIncome / ytdIncome) * 100 : 0,
        transactionCount: s.count,
      })),
      topClients: [],
      recentTransactions: [],
      monthlyTrend: monthlyTrend.map((m) => ({
        month: m.month,
        income: m.income,
        expenses: m.expense,
        netProfit: m.net,
      })),
      pendingSyncs: [],
      alerts: [],
    };
  }

  private generateDeduplicationKey(tx: SourceTransaction): string {
    return `${tx.source}:${tx.externalId}:${tx.transactionDate.toISOString().slice(0, 10)}:${tx.amount}`;
  }
}
