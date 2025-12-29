import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/proposal.dart';

/// Proposal detail screen
class ProposalDetailScreen extends ConsumerWidget {
  final String proposalId;

  const ProposalDetailScreen({super.key, required this.proposalId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final proposalAsync = ref.watch(proposalDetailProvider(proposalId));

    return proposalAsync.when(
      data: (proposal) {
        if (proposal == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Proposal not found')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('Proposal Details'),
            actions: [
              if (proposal.status == ProposalStatus.pending)
                PopupMenuButton<String>(
                  onSelected: (value) {
                    // Handle actions
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'edit',
                      child: Text('Edit Proposal'),
                    ),
                    const PopupMenuItem(
                      value: 'withdraw',
                      child: Text('Withdraw'),
                    ),
                  ],
                ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            children: [
              // Status timeline
              _StatusTimeline(status: proposal.status),

              const SizedBox(height: AppTheme.spacingLg),

              // Job info
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Job',
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Text(
                        proposal.jobTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 12,
                            backgroundColor: AppTheme.neutral200,
                            child: Text(
                              proposal.clientName[0].toUpperCase(),
                              style: const TextStyle(fontSize: 10),
                            ),
                          ),
                          const SizedBox(width: AppTheme.spacingSm),
                          Text(proposal.clientName),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: AppTheme.spacingMd),

              // Your proposal
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Your Proposal',
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                          Text(
                            'Submitted ${timeago.format(proposal.submittedAt)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppTheme.spacingMd),
                      Row(
                        children: [
                          _InfoItem(
                            icon: Icons.attach_money,
                            label: 'Bid',
                            value: '\$${proposal.bidAmount.toStringAsFixed(0)}',
                          ),
                          const SizedBox(width: AppTheme.spacingLg),
                          if (proposal.deliveryDays != null)
                            _InfoItem(
                              icon: Icons.access_time,
                              label: 'Delivery',
                              value: '${proposal.deliveryDays} days',
                            ),
                        ],
                      ),
                      const Divider(height: AppTheme.spacingLg),
                      Text(
                        'Cover Letter',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Text(proposal.coverLetter),
                    ],
                  ),
                ),
              ),

              // Milestones
              if (proposal.milestones != null && proposal.milestones!.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingMd),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTheme.spacingMd),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Milestones',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: AppTheme.spacingMd),
                        ...proposal.milestones!.map((m) => Padding(
                              padding: const EdgeInsets.only(
                                  bottom: AppTheme.spacingSm),
                              child: Row(
                                children: [
                                  Expanded(child: Text(m.title)),
                                  Text('\$${m.amount.toStringAsFixed(0)}'),
                                ],
                              ),
                            )),
                      ],
                    ),
                  ),
                ),
              ],

              const SizedBox(height: AppTheme.spacingLg),
            ],
          ),
          bottomNavigationBar: proposal.status == ProposalStatus.accepted
              ? Container(
                  padding: const EdgeInsets.all(AppTheme.spacingMd),
                  child: SafeArea(
                    child: ElevatedButton(
                      onPressed: () {
                        // Accept offer
                      },
                      child: const Text('Accept Offer'),
                    ),
                  ),
                )
              : null,
        );
      },
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Error: $error')),
      ),
    );
  }
}

class _StatusTimeline extends StatelessWidget {
  final ProposalStatus status;

  const _StatusTimeline({required this.status});

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Submitted', ProposalStatus.pending),
      ('Viewed', ProposalStatus.viewed),
      ('Shortlisted', ProposalStatus.shortlisted),
      ('Accepted', ProposalStatus.accepted),
    ];

    int currentStep = steps.indexWhere((s) => s.$2 == status);
    if (currentStep == -1) currentStep = 0;

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: AppTheme.neutral100,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Row(
        children: steps.asMap().entries.map((entry) {
          final index = entry.key;
          final step = entry.value;
          final isCompleted = index <= currentStep;
          final isLast = index == steps.length - 1;

          return Expanded(
            child: Row(
              children: [
                Column(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: isCompleted
                            ? AppTheme.primaryColor
                            : AppTheme.neutral300,
                        shape: BoxShape.circle,
                      ),
                      child: isCompleted
                          ? const Icon(Icons.check, size: 14, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      step.$1,
                      style: TextStyle(
                        fontSize: 10,
                        color: isCompleted ? AppTheme.primaryColor : AppTheme.neutral500,
                      ),
                    ),
                  ],
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: index < currentStep
                          ? AppTheme.primaryColor
                          : AppTheme.neutral300,
                    ),
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.neutral500),
        const SizedBox(width: AppTheme.spacingSm),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            Text(
              value,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
        ),
      ],
    );
  }
}
