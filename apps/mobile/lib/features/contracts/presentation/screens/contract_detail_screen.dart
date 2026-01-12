import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/contract.dart';

/// Contract detail screen
class ContractDetailScreen extends ConsumerWidget {
  final String contractId;

  const ContractDetailScreen({super.key, required this.contractId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractsAsync = ref.watch(myContractsProvider);

    return contractsAsync.when(
      data: (contracts) {
        final contract = contracts.cast<Contract?>().firstWhere(
          (c) => c?.id == contractId,
          orElse: () => null,
        );

        if (contract == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Contract Details')),
            body: const Center(child: Text('Contract not found')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('Contract Details'),
            actions: [
              PopupMenuButton<String>(
                onSelected: (value) {
                  // Handle menu actions
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'milestones',
                    child: Text('View Milestones'),
                  ),
                  const PopupMenuItem(
                    value: 'messages',
                    child: Text('Messages'),
                  ),
                  const PopupMenuItem(
                    value: 'files',
                    child: Text('Shared Files'),
                  ),
                ],
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Contract title and status
                _ContractHeader(contract: contract),
                const SizedBox(height: AppTheme.spacingLg),

                // Client info
                _ClientSection(contract: contract),
                const SizedBox(height: AppTheme.spacingLg),

                // Contract details
                _DetailsSection(contract: contract),
                const SizedBox(height: AppTheme.spacingLg),

                // Milestones preview
                _MilestonesPreview(contract: contract),
                const SizedBox(height: AppTheme.spacingLg),

                // Quick actions
                _QuickActions(contract: contract),
              ],
            ),
          ),
        );
      },
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(title: const Text('Contract Details')),
        body: Center(child: Text('Error: $error')),
      ),
    );
  }
}

class _ContractHeader extends StatelessWidget {
  final Contract contract;

  const _ContractHeader({required this.contract});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    contract.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                _StatusChip(status: contract.status),
              ],
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              contract.description,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final ContractStatus status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status) {
      case ContractStatus.active:
        color = Colors.green;
        break;
      case ContractStatus.pending:
        color = Colors.orange;
        break;
      case ContractStatus.completed:
        color = Colors.blue;
        break;
      case ContractStatus.cancelled:
        color = Colors.red;
        break;
      case ContractStatus.paused:
        color = Colors.grey;
        break;
      case ContractStatus.disputed:
        color = Colors.deepOrange;
        break;
    }

    return Chip(
      label: Text(
        status.displayName.toUpperCase(),
        style: const TextStyle(color: Colors.white, fontSize: 12),
      ),
      backgroundColor: color,
      padding: EdgeInsets.zero,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}

class _ClientSection extends StatelessWidget {
  final Contract contract;

  const _ClientSection({required this.contract});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(contract.clientName[0].toUpperCase()),
        ),
        title: Text(contract.clientName),
        subtitle: const Text('Client'),
        trailing: IconButton(
          icon: const Icon(Icons.message),
          onPressed: () {
            // Navigate to messages
          },
        ),
      ),
    );
  }
}

class _DetailsSection extends StatelessWidget {
  final Contract contract;

  const _DetailsSection({required this.contract});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final dateFormat = DateFormat('MMM d, yyyy');
    final isHourly = contract.hourlyRate > 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Contract Details',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Divider(),
            _DetailRow(
              label: 'Total Amount',
              value: currencyFormat.format(contract.totalAmount),
            ),
            _DetailRow(
              label: 'Paid',
              value: currencyFormat.format(contract.paidAmount),
            ),
            _DetailRow(
              label: 'Start Date',
              value: dateFormat.format(contract.startDate),
            ),
            if (contract.endDate != null)
              _DetailRow(
                label: 'End Date',
                value: dateFormat.format(contract.endDate!),
              ),
            _DetailRow(
              label: 'Payment Type',
              value: isHourly ? 'Hourly' : 'Fixed Price',
            ),
            if (isHourly)
              _DetailRow(
                label: 'Hourly Rate',
                value: '${currencyFormat.format(contract.hourlyRate)}/hr',
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingXs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Text(value, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _MilestonesPreview extends StatelessWidget {
  final Contract contract;

  const _MilestonesPreview({required this.contract});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Milestones',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                TextButton(
                  onPressed: () {
                    // Navigate to milestones
                  },
                  child: const Text('View All'),
                ),
              ],
            ),
            const Divider(),
            // Placeholder for milestones list
            const ListTile(
              leading: Icon(Icons.check_circle_outline),
              title: Text('Project Setup'),
              subtitle: Text('Completed'),
            ),
            const ListTile(
              leading: Icon(Icons.radio_button_unchecked),
              title: Text('Development Phase'),
              subtitle: Text('In Progress'),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  final Contract contract;

  const _QuickActions({required this.contract});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () {
              context.push('/time/add');
            },
            icon: const Icon(Icons.timer),
            label: const Text('Log Time'),
          ),
        ),
        const SizedBox(width: AppTheme.spacingMd),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              // Submit work
            },
            icon: const Icon(Icons.upload),
            label: const Text('Submit Work'),
          ),
        ),
      ],
    );
  }
}
