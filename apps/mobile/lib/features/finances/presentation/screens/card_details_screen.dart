import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/models/finance_models.dart';
import '../../providers/finances_providers.dart';

/// Card Details Screen
/// Sprint M5: Freelancer Financial Services
class CardDetailsScreen extends ConsumerStatefulWidget {
  final String cardId;

  const CardDetailsScreen({
    super.key,
    required this.cardId,
  });

  @override
  ConsumerState<CardDetailsScreen> createState() => _CardDetailsScreenState();
}

class _CardDetailsScreenState extends ConsumerState<CardDetailsScreen> {
  bool _showCardDetails = false;
  Map<String, String>? _sensitiveDetails;
  bool _loadingSensitive = false;

  Future<void> _loadSensitiveDetails() async {
    if (_sensitiveDetails != null) {
      setState(() => _showCardDetails = !_showCardDetails);
      return;
    }

    setState(() => _loadingSensitive = true);

    try {
      final repo = ref.read(financesRepositoryProvider);
      final details = await repo.getCardSensitiveDetails(widget.cardId);
      setState(() {
        _sensitiveDetails = details;
        _showCardDetails = true;
        _loadingSensitive = false;
      });
    } catch (e) {
      setState(() => _loadingSensitive = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load card details: $e')),
        );
      }
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cardAsync = ref.watch(cardProvider(widget.cardId));
    final transactionsAsync =
        ref.watch(cardTransactionsProvider(widget.cardId));
    final currencyFormat = NumberFormat.currency(symbol: '\$');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Card Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () =>
                context.push('/finances/cards/${widget.cardId}/settings'),
          ),
        ],
      ),
      body: cardAsync.when(
        data: (card) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Card Visual
              _CardVisual(
                card: card,
                showDetails: _showCardDetails,
                sensitiveDetails: _sensitiveDetails,
                onToggleDetails: _loadSensitiveDetails,
                onCopy: _copyToClipboard,
                isLoading: _loadingSensitive,
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Quick Actions
              Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: card.isFrozen ? Icons.play_arrow : Icons.pause,
                      label: card.isFrozen ? 'Unfreeze' : 'Freeze',
                      color: card.isFrozen ? Colors.green : Colors.blue,
                      onTap: () async {
                        final actions = ref.read(cardActionsProvider.notifier);
                        if (card.isFrozen) {
                          await actions.unfreezeCard(card.id);
                        } else {
                          await actions.freezeCard(card.id);
                        }
                        ref.invalidate(cardProvider(widget.cardId));
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.phone_iphone,
                      label: 'Add to Wallet',
                      color: Colors.purple,
                      onTap: card.digitalWalletEnabled
                          ? null
                          : () => _showAddToWalletSheet(context, card),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionButton(
                      icon: Icons.tune,
                      label: 'Limits',
                      color: Colors.orange,
                      onTap: () => context.push(
                        '/finances/cards/${widget.cardId}/limits',
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Spending Limits
              _SpendingLimitsSection(
                limits: card.spendingLimits,
                currencyFormat: currencyFormat,
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Recent Transactions
              _TransactionsSection(
                transactionsAsync: transactionsAsync,
                currencyFormat: currencyFormat,
                onViewAll: () => context.push(
                  '/finances/cards/${widget.cardId}/transactions',
                ),
              ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Failed to load card: $e'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(cardProvider(widget.cardId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddToWalletSheet(BuildContext context, SkillancerCard card) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Add to Digital Wallet',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            ListTile(
              leading: const Icon(Icons.apple, size: 32),
              title: const Text('Apple Pay'),
              subtitle: const Text('Add to Apple Wallet'),
              onTap: () async {
                Navigator.pop(context);
                final repo = ref.read(financesRepositoryProvider);
                await repo.enableDigitalWallet(card.id, 'apple');
                ref.invalidate(cardProvider(widget.cardId));
              },
            ),
            ListTile(
              leading: const Icon(Icons.g_mobiledata, size: 32),
              title: const Text('Google Pay'),
              subtitle: const Text('Add to Google Wallet'),
              onTap: () async {
                Navigator.pop(context);
                final repo = ref.read(financesRepositoryProvider);
                await repo.enableDigitalWallet(card.id, 'google');
                ref.invalidate(cardProvider(widget.cardId));
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _CardVisual extends StatelessWidget {
  final SkillancerCard card;
  final bool showDetails;
  final Map<String, String>? sensitiveDetails;
  final VoidCallback onToggleDetails;
  final void Function(String, String) onCopy;
  final bool isLoading;

  const _CardVisual({
    required this.card,
    required this.showDetails,
    this.sensitiveDetails,
    required this.onToggleDetails,
    required this.onCopy,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    final isVirtual = card.type == CardType.virtual;

    return Container(
      width: double.infinity,
      height: 220,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: card.isFrozen
              ? [Colors.grey.shade400, Colors.grey.shade500]
              : isVirtual
                  ? [const Color(0xFF1a1a2e), const Color(0xFF16213e)]
                  : [const Color(0xFF0f0c29), const Color(0xFF302b63)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SKILLANCER',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 3,
                    ),
                  ),
                  if (isVirtual)
                    const Text(
                      'VIRTUAL CARD',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 10,
                        letterSpacing: 1,
                      ),
                    ),
                ],
              ),
              if (card.isFrozen)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.ac_unit, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text(
                        'FROZEN',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),

          const Spacer(),

          // Card Number
          Row(
            children: [
              Expanded(
                child: Text(
                  showDetails && sensitiveDetails != null
                      ? sensitiveDetails!['number'] ??
                          '•••• •••• •••• ${card.last4}'
                      : '•••• •••• •••• ${card.last4}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 3,
                  ),
                ),
              ),
              if (showDetails && sensitiveDetails != null)
                IconButton(
                  icon: const Icon(Icons.copy, color: Colors.white54, size: 18),
                  onPressed: () =>
                      onCopy(sensitiveDetails!['number'] ?? '', 'Card number'),
                ),
            ],
          ),

          const SizedBox(height: 16),

          // Bottom row
          Row(
            children: [
              // Expiry
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'EXPIRES',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 9,
                      letterSpacing: 1,
                    ),
                  ),
                  Text(
                    card.expiryFormatted,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),

              const SizedBox(width: 32),

              // CVV
              if (showDetails && sensitiveDetails != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CVV',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 9,
                        letterSpacing: 1,
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          sensitiveDetails!['cvv'] ?? '•••',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () =>
                              onCopy(sensitiveDetails!['cvv'] ?? '', 'CVV'),
                          child: const Icon(Icons.copy,
                              color: Colors.white54, size: 14),
                        ),
                      ],
                    ),
                  ],
                ),

              const Spacer(),

              // Show/hide toggle
              TextButton.icon(
                onPressed: isLoading ? null : onToggleDetails,
                icon: isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white54,
                        ),
                      )
                    : Icon(
                        showDetails ? Icons.visibility_off : Icons.visibility,
                        color: Colors.white54,
                        size: 18,
                      ),
                label: Text(
                  showDetails ? 'Hide' : 'Show',
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withOpacity(onTap == null ? 0.05 : 0.1),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              Icon(
                icon,
                color: onTap == null ? Colors.grey : color,
                size: 24,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: TextStyle(
                  color: onTap == null ? Colors.grey : color,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SpendingLimitsSection extends StatelessWidget {
  final SpendingLimits limits;
  final NumberFormat currencyFormat;

  const _SpendingLimitsSection({
    required this.limits,
    required this.currencyFormat,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Spending Limits',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _LimitRow(
              label: 'Daily',
              used: limits.dailyUsed,
              limit: limits.daily,
              currencyFormat: currencyFormat,
            ),
            const SizedBox(height: 12),
            _LimitRow(
              label: 'Weekly',
              used: limits.weeklyUsed,
              limit: limits.weekly,
              currencyFormat: currencyFormat,
            ),
            const SizedBox(height: 12),
            _LimitRow(
              label: 'Monthly',
              used: limits.monthlyUsed,
              limit: limits.monthly,
              currencyFormat: currencyFormat,
            ),
          ],
        ),
      ),
    );
  }
}

class _LimitRow extends StatelessWidget {
  final String label;
  final double used;
  final double limit;
  final NumberFormat currencyFormat;

  const _LimitRow({
    required this.label,
    required this.used,
    required this.limit,
    required this.currencyFormat,
  });

  @override
  Widget build(BuildContext context) {
    final progress = limit > 0 ? (used / limit).clamp(0.0, 1.0) : 0.0;
    final remaining = limit - used;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
            Text(
              '${currencyFormat.format(remaining)} remaining',
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation(
              progress > 0.9 ? Colors.red : Colors.indigo,
            ),
          ),
        ),
      ],
    );
  }
}

class _TransactionsSection extends StatelessWidget {
  final AsyncValue<List<CardTransaction>> transactionsAsync;
  final NumberFormat currencyFormat;
  final VoidCallback onViewAll;

  const _TransactionsSection({
    required this.transactionsAsync,
    required this.currencyFormat,
    required this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Transactions',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            TextButton(
              onPressed: onViewAll,
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        transactionsAsync.when(
          data: (transactions) {
            if (transactions.isEmpty) {
              return const Card(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: Text('No transactions yet'),
                  ),
                ),
              );
            }
            return Card(
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: transactions.take(5).length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final tx = transactions[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                          _getCategoryColor(tx.category).withOpacity(0.1),
                      child: Icon(
                        _getCategoryIcon(tx.category),
                        color: _getCategoryColor(tx.category),
                        size: 20,
                      ),
                    ),
                    title: Text(tx.merchantName),
                    subtitle: Text(
                      DateFormat.MMMd().format(tx.createdAt),
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: Text(
                      '-${currencyFormat.format(tx.amount)}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  );
                },
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Failed to load transactions: $e'),
            ),
          ),
        ),
      ],
    );
  }

  IconData _getCategoryIcon(TransactionCategory category) {
    switch (category) {
      case TransactionCategory.software:
        return Icons.code;
      case TransactionCategory.office:
        return Icons.business;
      case TransactionCategory.travel:
        return Icons.flight;
      case TransactionCategory.meals:
        return Icons.restaurant;
      case TransactionCategory.professional:
        return Icons.work;
      case TransactionCategory.advertising:
        return Icons.campaign;
      case TransactionCategory.utilities:
        return Icons.power;
      case TransactionCategory.equipment:
        return Icons.computer;
      case TransactionCategory.education:
        return Icons.school;
      default:
        return Icons.receipt;
    }
  }

  Color _getCategoryColor(TransactionCategory category) {
    switch (category) {
      case TransactionCategory.software:
        return Colors.blue;
      case TransactionCategory.office:
        return Colors.teal;
      case TransactionCategory.travel:
        return Colors.purple;
      case TransactionCategory.meals:
        return Colors.orange;
      case TransactionCategory.professional:
        return Colors.indigo;
      case TransactionCategory.advertising:
        return Colors.pink;
      case TransactionCategory.utilities:
        return Colors.amber;
      case TransactionCategory.equipment:
        return Colors.cyan;
      case TransactionCategory.education:
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}
