import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/contract.dart';

/// Contracts list screen
class ContractsScreen extends ConsumerWidget {
  const ContractsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Contracts'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Active'),
              Tab(text: 'Completed'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _ContractsList(showActive: true),
            _ContractsList(showActive: false),
          ],
        ),
      ),
    );
  }
}

class _ContractsList extends ConsumerWidget {
  final bool showActive;

  const _ContractsList({required this.showActive});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contractsAsync = ref.watch(myContractsProvider);

    return contractsAsync.when(
      data: (contracts) {
        final filtered = contracts.where((c) {
          if (showActive) {
            return c.status == ContractStatus.active ||
                c.status == ContractStatus.pending ||
                c.status == ContractStatus.paused;
          } else {
            return c.status == ContractStatus.completed ||
                c.status == ContractStatus.cancelled;
          }
        }).toList();

        if (filtered.isEmpty) {
          return _EmptyState(showActive: showActive);
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myContractsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            itemCount: filtered.length,
            itemBuilder: (context, index) {
              return _ContractCard(contract: filtered[index]);
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(child: Text('Error: $error')),
    );
  }
}

class _ContractCard extends StatelessWidget {
  final Contract contract;

  const _ContractCard({required this.contract});

  Color _getStatusColor() {
    switch (contract.status) {
      case ContractStatus.active:
        return AppTheme.successColor;
      case ContractStatus.pending:
        return AppTheme.warningColor;
      case ContractStatus.paused:
        return AppTheme.neutral500;
      case ContractStatus.completed:
        return AppTheme.infoColor;
      case ContractStatus.cancelled:
        return AppTheme.errorColor;
      case ContractStatus.disputed:
        return AppTheme.errorColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: InkWell(
        onTap: () => context.push('/contracts/${contract.id}'),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status and client
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingSm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    ),
                    child: Text(
                      contract.status.displayName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _getStatusColor(),
                      ),
                    ),
                  ),
                  const Spacer(),
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: AppTheme.neutral200,
                    child: Text(
                      contract.clientName[0].toUpperCase(),
                      style: const TextStyle(fontSize: 10),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    contract.clientName,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Title
              Text(
                contract.title,
                style: Theme.of(context).textTheme.titleMedium,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),

              const SizedBox(height: AppTheme.spacingMd),

              // Progress bar
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: contract.progress,
                  backgroundColor: AppTheme.neutral200,
                  color: AppTheme.primaryColor,
                  minHeight: 6,
                ),
              ),

              const SizedBox(height: AppTheme.spacingSm),

              // Amount and progress
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '\$${contract.paidAmount.toStringAsFixed(0)} / \$${contract.totalAmount.toStringAsFixed(0)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    '${(contract.progress * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.primaryColor,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool showActive;

  const _EmptyState({required this.showActive});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.assignment_outlined,
            size: 64,
            color: AppTheme.neutral400,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          Text(
            showActive ? 'No active contracts' : 'No completed contracts',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}
