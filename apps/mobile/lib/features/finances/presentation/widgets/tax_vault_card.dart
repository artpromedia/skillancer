import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/models/finance_models.dart';

/// Tax Vault Card Widget for Finances Dashboard
/// Sprint M5: Freelancer Financial Services
class TaxVaultCard extends StatelessWidget {
  final TaxVaultSummary vault;
  final VoidCallback? onTap;
  final VoidCallback? onAddFunds;

  const TaxVaultCard({
    super.key,
    required this.vault,
    this.onTap,
    this.onAddFunds,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final progress = vault.progressToTarget;
    final nextQuarter = vault.nextQuarter;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.green.shade400, Colors.teal.shade500],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.green.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.savings,
                      color: Colors.white70,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Tax Vault',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    vault.settings.autoSaveEnabled
                        ? '${vault.settings.savingsRate.toInt()}% Auto-Save'
                        : 'Manual',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Balance
            Text(
              currencyFormat.format(vault.balance),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),

            const SizedBox(height: 16),

            // Progress bar
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Q${nextQuarter.quarter} Target',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      '${(progress * 100).toInt()}%',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: Colors.white.withOpacity(0.2),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${currencyFormat.format(vault.balance)} of ${currencyFormat.format(vault.targetQuarterly)}',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 10,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Next quarterly payment alert
            if (nextQuarter.isDueSoon || nextQuarter.isOverdue)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: nextQuarter.isOverdue
                      ? Colors.red.withOpacity(0.3)
                      : Colors.amber.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      nextQuarter.isOverdue
                          ? Icons.warning
                          : Icons.calendar_today,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        nextQuarter.isOverdue
                            ? 'Q${nextQuarter.quarter} payment is overdue!'
                            : 'Q${nextQuarter.quarter} due in ${nextQuarter.daysUntilDue} days',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Text(
                      currencyFormat.format(nextQuarter.estimatedAmount),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 12),

            // Add funds button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onAddFunds,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Funds'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Skeleton loader for tax vault card
class TaxVaultCardSkeleton extends StatelessWidget {
  const TaxVaultCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
