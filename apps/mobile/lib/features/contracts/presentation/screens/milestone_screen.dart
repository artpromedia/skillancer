import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/providers/providers.dart';
import '../../../../widgets/status_badge.dart';
import '../../../../widgets/loading_indicator.dart';
import '../../../../widgets/error_widget.dart';
import '../../../auth/domain/models/user.dart';
import '../../domain/models/contract.dart';

/// Screen displaying milestones for a contract as a visual timeline.
class MilestoneScreen extends ConsumerStatefulWidget {
  final String contractId;

  const MilestoneScreen({super.key, required this.contractId});

  @override
  ConsumerState<MilestoneScreen> createState() => _MilestoneScreenState();
}

class _MilestoneScreenState extends ConsumerState<MilestoneScreen> {
  bool _isPerformingAction = false;

  @override
  Widget build(BuildContext context) {
    final contractAsync = ref.watch(contractDetailProvider(widget.contractId));
    final currentUser = ref.watch(currentUserProvider);
    final isClient = currentUser?.role == UserRole.client;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Milestones'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(contractDetailProvider(widget.contractId));
            },
          ),
        ],
      ),
      body: contractAsync.when(
        data: (contract) {
          if (contract == null) {
            return const AppErrorWidget(
              message: 'Contract not found',
              description:
                  'The contract you are looking for could not be loaded.',
            );
          }

          final milestones = contract.milestones;
          if (milestones == null || milestones.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingXl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.flag_outlined,
                      size: 64,
                      color: AppTheme.neutral400,
                    ),
                    const SizedBox(height: AppTheme.spacingMd),
                    Text(
                      'No Milestones',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    Text(
                      'This contract does not have any milestones defined.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppTheme.neutral500,
                          ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return Stack(
            children: [
              Column(
                children: [
                  // Progress summary header
                  _ProgressHeader(
                    contract: contract,
                    milestones: milestones,
                  ),

                  // Milestone timeline list
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppTheme.spacingMd,
                        vertical: AppTheme.spacingSm,
                      ),
                      itemCount: milestones.length,
                      itemBuilder: (context, index) {
                        final milestone = milestones[index];
                        final isFirst = index == 0;
                        final isLast = index == milestones.length - 1;

                        return _MilestoneTimelineItem(
                          milestone: milestone,
                          isFirst: isFirst,
                          isLast: isLast,
                          isClient: isClient,
                          onApprove: isClient &&
                                  milestone.status == MilestoneStatus.submitted
                              ? () => _approveMilestone(milestone)
                              : null,
                          onRequestRevision: isClient &&
                                  milestone.status == MilestoneStatus.submitted
                              ? () => _requestRevision(milestone)
                              : null,
                          onSubmitWork: !isClient &&
                                  (milestone.status ==
                                          MilestoneStatus.inProgress ||
                                      milestone.status ==
                                          MilestoneStatus.rejected)
                              ? () => _navigateToSubmitWork(milestone)
                              : null,
                        );
                      },
                    ),
                  ),
                ],
              ),

              // Loading overlay
              if (_isPerformingAction)
                LoadingIndicator.overlay(
                  message: 'Processing...',
                ),
            ],
          );
        },
        loading: () => const LoadingIndicator(
          message: 'Loading milestones...',
        ),
        error: (error, stack) => AppErrorWidget.retry(
          message: 'Failed to load milestones',
          description: error.toString(),
          onAction: () {
            ref.invalidate(contractDetailProvider(widget.contractId));
          },
        ),
      ),
    );
  }

  void _navigateToSubmitWork(ContractMilestone milestone) {
    context.push(
      '/contracts/${widget.contractId}/milestones/${milestone.id}/submit',
    );
  }

  Future<void> _approveMilestone(ContractMilestone milestone) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Approve Milestone'),
        content: Text(
          'Are you sure you want to approve "${milestone.title}"? '
          'This will release the payment of '
          '\$${milestone.amount.toStringAsFixed(2)} to the freelancer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Approve'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isPerformingAction = true);
    try {
      final contractsRepo = ref.read(contractsRepositoryProvider);
      await contractsRepo.acceptDelivery(widget.contractId);
      ref.invalidate(contractDetailProvider(widget.contractId));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Milestone "${milestone.title}" approved'),
            backgroundColor: AppTheme.successColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to approve milestone: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPerformingAction = false);
      }
    }
  }

  Future<void> _requestRevision(ContractMilestone milestone) async {
    final notesController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Request Revision'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Please describe what changes are needed for "${milestone.title}":',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            TextField(
              controller: notesController,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Describe the revisions needed...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.warningColor,
            ),
            child: const Text('Request Revision'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isPerformingAction = true);
    try {
      final contractsRepo = ref.read(contractsRepositoryProvider);
      await contractsRepo.requestRevision(
        contractId: widget.contractId,
        description: notesController.text,
      );
      ref.invalidate(contractDetailProvider(widget.contractId));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Revision requested successfully'),
            backgroundColor: AppTheme.warningColor,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to request revision: $e'),
            backgroundColor: AppTheme.errorColor,
          ),
        );
      }
    } finally {
      notesController.dispose();
      if (mounted) {
        setState(() => _isPerformingAction = false);
      }
    }
  }
}

// =============================================================================
// Progress Header
// =============================================================================

class _ProgressHeader extends StatelessWidget {
  final Contract contract;
  final List<ContractMilestone> milestones;

  const _ProgressHeader({
    required this.contract,
    required this.milestones,
  });

  @override
  Widget build(BuildContext context) {
    final completedCount = milestones
        .where((m) =>
            m.status == MilestoneStatus.approved ||
            m.status == MilestoneStatus.paid)
        .length;
    final totalCount = milestones.length;
    final progress = totalCount > 0 ? completedCount / totalCount : 0.0;

    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final totalAmount =
        milestones.fold<double>(0.0, (sum, m) => sum + m.amount);
    final paidAmount = milestones
        .where((m) => m.status == MilestoneStatus.paid)
        .fold<double>(0.0, (sum, m) => sum + m.amount);

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).dividerTheme.color ?? AppTheme.neutral200,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Contract title
          Text(
            contract.title,
            style: Theme.of(context).textTheme.titleMedium,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppTheme.spacingMd),

          // Progress bar
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$completedCount of $totalCount milestones completed',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.neutral500,
                                  ),
                        ),
                        Text(
                          '${(progress * 100).toInt()}%',
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    color: AppTheme.primaryColor,
                                  ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        backgroundColor: AppTheme.neutral200,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          progress == 1.0
                              ? AppTheme.successColor
                              : AppTheme.primaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingMd),

          // Amount summary
          Row(
            children: [
              _SummaryChip(
                label: 'Total',
                value: currencyFormat.format(totalAmount),
                color: AppTheme.primaryColor,
              ),
              const SizedBox(width: AppTheme.spacingSm),
              _SummaryChip(
                label: 'Paid',
                value: currencyFormat.format(paidAmount),
                color: AppTheme.successColor,
              ),
              const SizedBox(width: AppTheme.spacingSm),
              _SummaryChip(
                label: 'Remaining',
                value: currencyFormat.format(totalAmount - paidAmount),
                color: AppTheme.warningColor,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingSm,
          vertical: AppTheme.spacingXs,
        ),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color: color.withOpacity(0.2),
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.neutral500,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Milestone Timeline Item
// =============================================================================

class _MilestoneTimelineItem extends StatelessWidget {
  final ContractMilestone milestone;
  final bool isFirst;
  final bool isLast;
  final bool isClient;
  final VoidCallback? onApprove;
  final VoidCallback? onRequestRevision;
  final VoidCallback? onSubmitWork;

  const _MilestoneTimelineItem({
    required this.milestone,
    required this.isFirst,
    required this.isLast,
    required this.isClient,
    this.onApprove,
    this.onRequestRevision,
    this.onSubmitWork,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(symbol: '\$');
    final dateFormat = DateFormat('MMM d, yyyy');

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline indicator
          SizedBox(
            width: 40,
            child: Column(
              children: [
                // Top connector line
                if (!isFirst)
                  Expanded(
                    flex: 1,
                    child: Container(
                      width: 2,
                      color: _isCompletedOrPaid
                          ? AppTheme.successColor
                          : AppTheme.neutral300,
                    ),
                  )
                else
                  const Spacer(),

                // Status dot
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _dotColor,
                    border: Border.all(
                      color: _dotBorderColor,
                      width: 2,
                    ),
                  ),
                  child: _dotIcon,
                ),

                // Bottom connector line
                if (!isLast)
                  Expanded(
                    flex: 1,
                    child: Container(
                      width: 2,
                      color: _isCompletedOrPaid
                          ? AppTheme.successColor
                          : AppTheme.neutral300,
                    ),
                  )
                else
                  const Spacer(),
              ],
            ),
          ),

          const SizedBox(width: AppTheme.spacingSm),

          // Milestone card
          Expanded(
            child: Card(
              margin: const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title and status badge row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            milestone.title,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        const SizedBox(width: AppTheme.spacingSm),
                        _buildStatusBadge(),
                      ],
                    ),

                    // Description
                    if (milestone.description != null &&
                        milestone.description!.isNotEmpty) ...[
                      const SizedBox(height: AppTheme.spacingSm),
                      Text(
                        milestone.description!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppTheme.neutral500,
                            ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],

                    const SizedBox(height: AppTheme.spacingMd),

                    // Amount and due date row
                    Row(
                      children: [
                        Icon(
                          Icons.attach_money,
                          size: 16,
                          color: AppTheme.neutral500,
                        ),
                        const SizedBox(width: AppTheme.spacingXs),
                        Text(
                          currencyFormat.format(milestone.amount),
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        if (milestone.dueDate != null) ...[
                          const SizedBox(width: AppTheme.spacingMd),
                          Icon(
                            Icons.calendar_today_outlined,
                            size: 14,
                            color: _isDueDateOverdue
                                ? AppTheme.errorColor
                                : AppTheme.neutral500,
                          ),
                          const SizedBox(width: AppTheme.spacingXs),
                          Text(
                            dateFormat.format(milestone.dueDate!),
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: _isDueDateOverdue
                                          ? AppTheme.errorColor
                                          : AppTheme.neutral500,
                                      fontWeight: _isDueDateOverdue
                                          ? FontWeight.w600
                                          : null,
                                    ),
                          ),
                        ],
                      ],
                    ),

                    // Action buttons
                    if (onApprove != null ||
                        onRequestRevision != null ||
                        onSubmitWork != null) ...[
                      const SizedBox(height: AppTheme.spacingMd),
                      const Divider(),
                      const SizedBox(height: AppTheme.spacingSm),
                      _buildActionButtons(context),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge() {
    return switch (milestone.status) {
      MilestoneStatus.pending => const StatusBadge.pending(
          label: 'Pending',
          badgeSize: BadgeSize.small,
        ),
      MilestoneStatus.inProgress => const StatusBadge.inProgress(
          label: 'In Progress',
          badgeSize: BadgeSize.small,
        ),
      MilestoneStatus.submitted => StatusBadge(
          label: 'Submitted',
          statusType: StatusType.custom,
          backgroundColor: AppTheme.infoColor,
          foregroundColor: AppTheme.infoColor,
          badgeSize: BadgeSize.small,
        ),
      MilestoneStatus.approved => const StatusBadge.completed(
          label: 'Approved',
          badgeSize: BadgeSize.small,
        ),
      MilestoneStatus.rejected => const StatusBadge.rejected(
          label: 'Revision Requested',
          badgeSize: BadgeSize.small,
        ),
      MilestoneStatus.paid => const StatusBadge.active(
          label: 'Paid',
          badgeSize: BadgeSize.small,
          icon: Icons.check_circle,
        ),
    };
  }

  Widget _buildActionButtons(BuildContext context) {
    // Client view: approve / request revision
    if (isClient) {
      return Row(
        children: [
          if (onRequestRevision != null)
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onRequestRevision,
                icon: const Icon(Icons.replay, size: 18),
                label: const Text('Request Revision'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.warningColor,
                  side: const BorderSide(color: AppTheme.warningColor),
                  padding: const EdgeInsets.symmetric(
                    vertical: AppTheme.spacingSm,
                  ),
                ),
              ),
            ),
          if (onRequestRevision != null && onApprove != null)
            const SizedBox(width: AppTheme.spacingSm),
          if (onApprove != null)
            Expanded(
              child: ElevatedButton.icon(
                onPressed: onApprove,
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Approve'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.successColor,
                  padding: const EdgeInsets.symmetric(
                    vertical: AppTheme.spacingSm,
                  ),
                ),
              ),
            ),
        ],
      );
    }

    // Freelancer view: submit work
    if (onSubmitWork != null) {
      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: onSubmitWork,
          icon: const Icon(Icons.upload_file, size: 18),
          label: Text(
            milestone.status == MilestoneStatus.rejected
                ? 'Resubmit Work'
                : 'Submit Work',
          ),
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(
              vertical: AppTheme.spacingSm,
            ),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  bool get _isCompletedOrPaid =>
      milestone.status == MilestoneStatus.approved ||
      milestone.status == MilestoneStatus.paid;

  bool get _isDueDateOverdue {
    if (milestone.dueDate == null) return false;
    if (_isCompletedOrPaid) return false;
    return milestone.dueDate!.isBefore(DateTime.now());
  }

  Color get _dotColor {
    return switch (milestone.status) {
      MilestoneStatus.pending => Colors.transparent,
      MilestoneStatus.inProgress => AppTheme.primaryColor.withOpacity(0.15),
      MilestoneStatus.submitted => AppTheme.infoColor.withOpacity(0.15),
      MilestoneStatus.approved => AppTheme.successColor,
      MilestoneStatus.rejected => AppTheme.errorColor.withOpacity(0.15),
      MilestoneStatus.paid => AppTheme.successColor,
    };
  }

  Color get _dotBorderColor {
    return switch (milestone.status) {
      MilestoneStatus.pending => AppTheme.neutral400,
      MilestoneStatus.inProgress => AppTheme.primaryColor,
      MilestoneStatus.submitted => AppTheme.infoColor,
      MilestoneStatus.approved => AppTheme.successColor,
      MilestoneStatus.rejected => AppTheme.errorColor,
      MilestoneStatus.paid => AppTheme.successColor,
    };
  }

  Widget? get _dotIcon {
    final iconData = switch (milestone.status) {
      MilestoneStatus.approved || MilestoneStatus.paid => Icons.check,
      MilestoneStatus.rejected => Icons.refresh,
      _ => null,
    };

    if (iconData == null) return null;

    return Icon(
      iconData,
      size: 14,
      color: _isCompletedOrPaid ? Colors.white : _dotBorderColor,
    );
  }
}
