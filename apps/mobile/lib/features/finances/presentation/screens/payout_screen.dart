import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/models/finance_models.dart';
import '../../providers/finances_providers.dart';

/// Payout Request Screen
/// Sprint M5: Freelancer Financial Services
class PayoutScreen extends ConsumerStatefulWidget {
  const PayoutScreen({super.key});

  @override
  ConsumerState<PayoutScreen> createState() => _PayoutScreenState();
}

class _PayoutScreenState extends ConsumerState<PayoutScreen> {
  final _amountController = TextEditingController();
  PayoutSpeed _selectedSpeed = PayoutSpeed.instant;
  PayoutDestination _selectedDestination = PayoutDestination.skillancerCard;
  String? _selectedDestinationId;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  double get _amount {
    final text = _amountController.text.replaceAll(RegExp(r'[^\d.]'), '');
    return double.tryParse(text) ?? 0;
  }

  double get _fee {
    if (_selectedSpeed == PayoutSpeed.standard) return 0;
    if (_selectedDestination == PayoutDestination.skillancerCard) {
      return _amount * 0.01; // 1% fee
    }
    return _amount * 0.015; // 1.5% fee for external
  }

  double get _netAmount => _amount - _fee;

  @override
  Widget build(BuildContext context) {
    final balanceAsync = ref.watch(balanceProvider);
    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final requestState = ref.watch(payoutRequestProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Payout'),
      ),
      body: balanceAsync.when(
        data: (balance) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Available Balance
              Container(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                decoration: BoxDecoration(
                  color: Colors.indigo.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Available for Payout',
                      style: TextStyle(color: Colors.indigo),
                    ),
                    Text(
                      currencyFormat.format(balance.payableBalance),
                      style: const TextStyle(
                        color: Colors.indigo,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Amount Input
              const Text(
                'Amount',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                style:
                    const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  prefixText: '\$ ',
                  prefixStyle: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade700,
                  ),
                  hintText: '0.00',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  suffixIcon: TextButton(
                    onPressed: () {
                      _amountController.text =
                          balance.payableBalance.toStringAsFixed(2);
                      setState(() {});
                    },
                    child: const Text('MAX'),
                  ),
                ),
                onChanged: (_) => setState(() {}),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Payout Speed
              const Text(
                'Payout Speed',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              _SpeedSelector(
                selectedSpeed: _selectedSpeed,
                destination: _selectedDestination,
                onChanged: (speed) => setState(() => _selectedSpeed = speed),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Destination
              const Text(
                'Send To',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              _DestinationSelector(
                selectedDestination: _selectedDestination,
                onChanged: (dest) => setState(() {
                  _selectedDestination = dest;
                  // Reset to instant for Skillancer card
                  if (dest == PayoutDestination.skillancerCard) {
                    _selectedSpeed = PayoutSpeed.instant;
                  }
                }),
              ),

              const SizedBox(height: AppTheme.spacingLg),

              // Fee Breakdown
              Container(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    _SummaryRow(
                      label: 'Amount',
                      value: currencyFormat.format(_amount),
                    ),
                    const SizedBox(height: 8),
                    _SummaryRow(
                      label: _selectedSpeed == PayoutSpeed.instant
                          ? 'Instant Fee (${_selectedDestination == PayoutDestination.skillancerCard ? '1%' : '1.5%'})'
                          : 'Fee',
                      value: '-${currencyFormat.format(_fee)}',
                      valueColor: _fee > 0 ? Colors.red : null,
                    ),
                    const Divider(height: 24),
                    _SummaryRow(
                      label: 'You\'ll Receive',
                      value: currencyFormat.format(_netAmount),
                      isBold: true,
                    ),
                    if (_selectedSpeed == PayoutSpeed.instant)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            Icon(Icons.bolt,
                                color: Colors.amber.shade700, size: 16),
                            const SizedBox(width: 4),
                            Text(
                              'Arrives in seconds',
                              style: TextStyle(
                                color: Colors.amber.shade700,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: AppTheme.spacingXl),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _amount >= 5 && _amount <= balance.payableBalance
                      ? _submitPayout
                      : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: requestState.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          _selectedSpeed == PayoutSpeed.instant
                              ? 'Instant Payout'
                              : 'Standard Payout (1-2 days)',
                          style: const TextStyle(fontSize: 16),
                        ),
                ),
              ),

              if (_amount > 0 && _amount < 5)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Minimum payout amount is \$5.00',
                    style: TextStyle(color: Colors.red.shade700, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }

  Future<void> _submitPayout() async {
    final notifier = ref.read(payoutRequestProvider.notifier);

    final success = await notifier.requestPayout(
      amount: _amount,
      speed: _selectedSpeed,
      destination: _selectedDestination,
      destinationId: _selectedDestinationId ?? 'default',
    );

    if (success && mounted) {
      _showSuccessDialog();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(ref.read(payoutRequestProvider).error ?? 'Payout failed'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showSuccessDialog() {
    final payout = ref.read(payoutRequestProvider).payout;
    final currencyFormat = NumberFormat.currency(symbol: '\$');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.check_circle,
                color: Colors.green.shade600,
                size: 48,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Payout Initiated!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              currencyFormat.format(payout?.netAmount ?? 0),
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              payout?.speed == PayoutSpeed.instant
                  ? 'Arriving in seconds'
                  : 'Arriving in 1-2 business days',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              context.pop();
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }
}

class _SpeedSelector extends StatelessWidget {
  final PayoutSpeed selectedSpeed;
  final PayoutDestination destination;
  final ValueChanged<PayoutSpeed> onChanged;

  const _SpeedSelector({
    required this.selectedSpeed,
    required this.destination,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _SpeedOption(
          title: 'Instant',
          subtitle: 'Arrives in seconds',
          fee: destination == PayoutDestination.skillancerCard
              ? '1% fee'
              : '1.5% fee',
          icon: Icons.bolt,
          color: Colors.amber,
          isSelected: selectedSpeed == PayoutSpeed.instant,
          onTap: () => onChanged(PayoutSpeed.instant),
        ),
        const SizedBox(height: 8),
        _SpeedOption(
          title: 'Standard',
          subtitle: '1-2 business days',
          fee: 'Free',
          icon: Icons.schedule,
          color: Colors.grey,
          isSelected: selectedSpeed == PayoutSpeed.standard,
          onTap: () => onChanged(PayoutSpeed.standard),
        ),
      ],
    );
  }
}

class _SpeedOption extends StatelessWidget {
  final String title;
  final String subtitle;
  final String fee;
  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _SpeedOption({
    required this.title,
    required this.subtitle,
    required this.fee,
    required this.icon,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? color.withOpacity(0.1) : Colors.grey.shade100,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? color : Colors.transparent,
              width: 2,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: fee == 'Free'
                      ? Colors.green.shade100
                      : Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  fee,
                  style: TextStyle(
                    color: fee == 'Free'
                        ? Colors.green.shade700
                        : Colors.grey.shade700,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DestinationSelector extends StatelessWidget {
  final PayoutDestination selectedDestination;
  final ValueChanged<PayoutDestination> onChanged;

  const _DestinationSelector({
    required this.selectedDestination,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _DestinationOption(
          title: 'Skillancer Card',
          subtitle: '•••• 4242',
          icon: Icons.credit_card,
          color: Colors.indigo,
          isSelected: selectedDestination == PayoutDestination.skillancerCard,
          onTap: () => onChanged(PayoutDestination.skillancerCard),
          badge: 'Lowest Fee',
        ),
        const SizedBox(height: 8),
        _DestinationOption(
          title: 'External Debit Card',
          subtitle: 'Add or select a card',
          icon: Icons.add_card,
          color: Colors.teal,
          isSelected: selectedDestination == PayoutDestination.externalDebit,
          onTap: () => onChanged(PayoutDestination.externalDebit),
        ),
        const SizedBox(height: 8),
        _DestinationOption(
          title: 'Bank Account',
          subtitle: 'Standard payout only',
          icon: Icons.account_balance,
          color: Colors.blueGrey,
          isSelected: selectedDestination == PayoutDestination.bankAccount,
          onTap: () => onChanged(PayoutDestination.bankAccount),
        ),
      ],
    );
  }
}

class _DestinationOption extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;
  final String? badge;

  const _DestinationOption({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.isSelected,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? color.withOpacity(0.1) : Colors.grey.shade100,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? color : Colors.transparent,
              width: 2,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge!,
                              style: TextStyle(
                                color: Colors.green.shade700,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (isSelected) Icon(Icons.check_circle, color: color, size: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  final bool isBold;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.isBold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            fontSize: isBold ? 18 : 14,
          ),
        ),
      ],
    );
  }
}
