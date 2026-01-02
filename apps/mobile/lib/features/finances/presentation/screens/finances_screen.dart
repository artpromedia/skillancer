import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../providers/finances_providers.dart';
import '../widgets/balance_card.dart';
import '../widgets/card_preview.dart';
import '../widgets/tax_vault_card.dart';

/// Main Finances Dashboard Screen
/// Sprint M5: Freelancer Financial Services
class FinancesScreen extends ConsumerWidget {
  const FinancesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(balanceProvider);
    final cardsAsync = ref.watch(cardsProvider);
    final taxVaultAsync = ref.watch(taxVaultProvider);
    final currencyFormat = NumberFormat.currency(symbol: '\$');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Finances'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => context.push('/finances/transactions'),
            tooltip: 'Transaction History',
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push('/finances/settings'),
            tooltip: 'Settings',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(balanceProvider);
          ref.invalidate(cardsProvider);
          ref.invalidate(taxVaultProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Balance Card
              balanceAsync.when(
                data: (balance) => BalanceCard(
                  balance: balance,
                  onPayout: () => context.push('/finances/payout'),
                  onAddFunds: () => context.push('/finances/add-funds'),
                ),
                loading: () => const BalanceCardSkeleton(),
                error: (e, _) => _ErrorCard(
                  message: 'Failed to load balance',
                  onRetry: () => ref.invalidate(balanceProvider),
                ),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Quick Actions
              _QuickActions(
                onTapPayout: () => context.push('/finances/payout'),
                onTapCards: () => context.push('/finances/cards'),
                onTapTaxes: () => context.push('/finances/taxes'),
                onTapTransactions: () => context.push('/finances/transactions'),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Cards Section
              _SectionHeader(
                title: 'Your Cards',
                action: 'Manage',
                onAction: () => context.push('/finances/cards'),
              ),
              const SizedBox(height: AppTheme.spacingSm),
              cardsAsync.when(
                data: (cards) {
                  if (cards.isEmpty) {
                    return _EmptyCardsCard(
                      onGetCard: () => context.push('/finances/cards/request'),
                    );
                  }
                  return SizedBox(
                    height: 200,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: cards.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(width: AppTheme.spacingMd),
                      itemBuilder: (context, index) => CardPreview(
                        card: cards[index],
                        onTap: () =>
                            context.push('/finances/cards/${cards[index].id}'),
                      ),
                    ),
                  );
                },
                loading: () => const CardPreviewSkeleton(),
                error: (e, _) => _ErrorCard(
                  message: 'Failed to load cards',
                  onRetry: () => ref.invalidate(cardsProvider),
                ),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Tax Vault Section
              _SectionHeader(
                title: 'Tax Vault',
                action: 'Details',
                onAction: () => context.push('/finances/taxes'),
              ),
              const SizedBox(height: AppTheme.spacingSm),
              taxVaultAsync.when(
                data: (vault) => TaxVaultCard(
                  vault: vault,
                  onTap: () => context.push('/finances/taxes'),
                  onAddFunds: () => context.push('/finances/taxes/deposit'),
                ),
                loading: () => const TaxVaultCardSkeleton(),
                error: (e, _) => _ErrorCard(
                  message: 'Failed to load tax vault',
                  onRetry: () => ref.invalidate(taxVaultProvider),
                ),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Recent Transactions
              _SectionHeader(
                title: 'Recent Activity',
                action: 'See All',
                onAction: () => context.push('/finances/transactions'),
              ),
              const SizedBox(height: AppTheme.spacingSm),
              _RecentTransactionsPlaceholder(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Section header widget
class _SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    this.action,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            child: Text(action!),
          ),
      ],
    );
  }
}

/// Quick action buttons
class _QuickActions extends StatelessWidget {
  final VoidCallback onTapPayout;
  final VoidCallback onTapCards;
  final VoidCallback onTapTaxes;
  final VoidCallback onTapTransactions;

  const _QuickActions({
    required this.onTapPayout,
    required this.onTapCards,
    required this.onTapTaxes,
    required this.onTapTransactions,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _QuickActionButton(
          icon: Icons.send,
          label: 'Payout',
          color: Colors.green,
          onTap: onTapPayout,
        ),
        _QuickActionButton(
          icon: Icons.credit_card,
          label: 'Cards',
          color: Colors.indigo,
          onTap: onTapCards,
        ),
        _QuickActionButton(
          icon: Icons.savings,
          label: 'Taxes',
          color: Colors.orange,
          onTap: onTapTaxes,
        ),
        _QuickActionButton(
          icon: Icons.receipt_long,
          label: 'History',
          color: Colors.blueGrey,
          onTap: onTapTransactions,
        ),
      ],
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty cards placeholder
class _EmptyCardsCard extends StatelessWidget {
  final VoidCallback onGetCard;

  const _EmptyCardsCard({required this.onGetCard});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 180,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.grey.shade300, Colors.grey.shade200],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade400, width: 1),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onGetCard,
          borderRadius: BorderRadius.circular(16),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.add_card,
                  size: 48,
                  color: Colors.grey.shade600,
                ),
                const SizedBox(height: 12),
                Text(
                  'Get Your Skillancer Card',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.grey.shade700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Instant payouts, spending controls & more',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Recent transactions placeholder
class _RecentTransactionsPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: List.generate(
          3,
          (index) => Padding(
            padding: EdgeInsets.only(
              bottom: index < 2 ? AppTheme.spacingSm : 0,
            ),
            child: _TransactionPlaceholderRow(),
          ),
        ),
      ),
    );
  }
}

class _TransactionPlaceholderRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Colors.grey.shade300,
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 120,
                height: 14,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 4),
              Container(
                width: 80,
                height: 10,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 60,
          height: 14,
          decoration: BoxDecoration(
            color: Colors.grey.shade300,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ],
    );
  }
}

/// Error card widget
class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorCard({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade700),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: Colors.red.shade700),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
