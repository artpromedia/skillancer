import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../domain/models/engagement.dart';
import '../../domain/providers/executive_providers.dart';
import '../widgets/stats_card.dart';

/// Engagement detail screen showing full engagement info, OKRs, milestones, and time tracking
class EngagementDetailScreen extends ConsumerWidget {
  final String engagementId;

  const EngagementDetailScreen({super.key, required this.engagementId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final engagementAsync = ref.watch(engagementProvider(engagementId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Engagement'),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () => _showOptions(context, ref),
          ),
        ],
      ),
      body: engagementAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
        data: (engagement) => _buildContent(context, ref, engagement),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/executive/time-entry/$engagementId'),
        icon: const Icon(Icons.add),
        label: const Text('Log Time'),
      ),
    );
  }

  Widget _buildContent(
      BuildContext context, WidgetRef ref, ExecutiveEngagement engagement) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(engagementProvider(engagementId));
        ref.invalidate(engagementMilestonesProvider(engagementId));
        ref.invalidate(engagementTimeEntriesProvider(engagementId));
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
            _buildHeaderCard(context, engagement),
            const SizedBox(height: 24),

            // Quick stats
            _buildQuickStats(context, engagement),
            const SizedBox(height: 24),

            // OKRs section
            _buildOKRsSection(context, ref, engagement),
            const SizedBox(height: 24),

            // Milestones section
            _buildMilestonesSection(context, ref),
            const SizedBox(height: 24),

            // Recent time entries
            _buildTimeEntriesSection(context, ref),
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderCard(
      BuildContext context, ExecutiveEngagement engagement) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: engagement.clientLogoUrl != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(engagement.clientLogoUrl!,
                              fit: BoxFit.cover),
                        )
                      : Icon(
                          Icons.business,
                          color:
                              Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        engagement.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        engagement.clientName ?? 'Client',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ),
                _buildStatusBadge(context, engagement.status),
              ],
            ),
            if (engagement.description != null) ...[
              const SizedBox(height: 16),
              Text(engagement.description!),
            ],
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildInfoChip(
                    context, Icons.work_outline, engagement.role.displayName),
                const SizedBox(width: 12),
                _buildInfoChip(context, Icons.schedule,
                    '${engagement.hoursPerWeek}h/week'),
                const SizedBox(width: 12),
                _buildInfoChip(context, Icons.payments_outlined,
                    engagement.compensationDisplay),
              ],
            ),
            if (engagement.startDate != null) ...[
              const SizedBox(height: 12),
              Text(
                'Started ${DateFormat.yMMMd().format(engagement.startDate!)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context, EngagementStatus status) {
    final (color, bgColor) = switch (status) {
      EngagementStatus.active => (Colors.green, Colors.green.withOpacity(0.1)),
      EngagementStatus.paused => (
          Colors.orange,
          Colors.orange.withOpacity(0.1)
        ),
      _ => (Colors.blue, Colors.blue.withOpacity(0.1)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.displayName,
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildInfoChip(BuildContext context, IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14),
          const SizedBox(width: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }

  Widget _buildQuickStats(
      BuildContext context, ExecutiveEngagement engagement) {
    return Row(
      children: [
        Expanded(
          child: StatsCard(
            icon: Icons.timer_outlined,
            label: 'Hours Logged',
            value: engagement.totalHoursLogged.toStringAsFixed(1),
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatsCard(
            icon: Icons.flag_outlined,
            label: 'OKRs Progress',
            value: '${(engagement.objectivesProgress * 100).toInt()}%',
            color: Theme.of(context).colorScheme.secondary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatsCard(
            icon: Icons.check_circle_outline,
            label: 'Completed',
            value:
                '${engagement.completedObjectives}/${engagement.objectives.length}',
            color: Theme.of(context).colorScheme.tertiary,
          ),
        ),
      ],
    );
  }

  Widget _buildOKRsSection(
      BuildContext context, WidgetRef ref, ExecutiveEngagement engagement) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Objectives & Key Results',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton.icon(
              onPressed: () => context.push('/executive/okr/new/$engagementId'),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (engagement.objectives.isEmpty)
          Card(
            elevation: 0,
            color:
                Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.5),
            child: const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text('No objectives set yet'),
              ),
            ),
          )
        else
          ...engagement.objectives.map((obj) => _buildOKRCard(context, obj)),
      ],
    );
  }

  Widget _buildOKRCard(BuildContext context, ExecutiveObjective objective) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    objective.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: objective.completed
                        ? Colors.green.withOpacity(0.1)
                        : Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    objective.completed
                        ? 'Completed'
                        : '${(objective.overallProgress * 100).toInt()}%',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: objective.completed ? Colors.green : Colors.blue,
                    ),
                  ),
                ),
              ],
            ),
            if (objective.dueDate != null) ...[
              const SizedBox(height: 8),
              Text(
                'Due ${DateFormat.yMMMd().format(objective.dueDate!)}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
            if (objective.keyResults.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...objective.keyResults.map((kr) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Icon(
                          kr.completed
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          size: 16,
                          color: kr.completed ? Colors.green : Colors.grey,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                            child: Text(kr.description,
                                style: Theme.of(context).textTheme.bodySmall)),
                      ],
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMilestonesSection(BuildContext context, WidgetRef ref) {
    final milestonesAsync =
        ref.watch(engagementMilestonesProvider(engagementId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Milestones',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton.icon(
              onPressed: () =>
                  context.push('/executive/milestone/new/$engagementId'),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        milestonesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Text('Error: $error'),
          data: (milestones) {
            if (milestones.isEmpty) {
              return Card(
                elevation: 0,
                color: Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest
                    .withOpacity(0.5),
                child: const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('No milestones yet')),
                ),
              );
            }
            return Column(
              children: milestones
                  .take(3)
                  .map((m) => _buildMilestoneCard(context, m))
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildMilestoneCard(
      BuildContext context, ExecutiveMilestone milestone) {
    final isOverdue = milestone.isOverdue;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isOverdue
              ? Colors.red.withOpacity(0.5)
              : Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: ListTile(
        leading: Icon(
          milestone.isCompleted ? Icons.check_circle : Icons.flag_outlined,
          color: milestone.isCompleted
              ? Colors.green
              : (isOverdue ? Colors.red : Colors.orange),
        ),
        title: Text(
          milestone.title,
          style: TextStyle(
            decoration:
                milestone.isCompleted ? TextDecoration.lineThrough : null,
          ),
        ),
        subtitle: milestone.dueDate != null
            ? Text(
                'Due ${DateFormat.yMMMd().format(milestone.dueDate!)}',
                style: TextStyle(color: isOverdue ? Colors.red : null),
              )
            : null,
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/executive/milestone/${milestone.id}'),
      ),
    );
  }

  Widget _buildTimeEntriesSection(BuildContext context, WidgetRef ref) {
    final entriesAsync = ref.watch(engagementTimeEntriesProvider(engagementId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Time Entries',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton(
              onPressed: () =>
                  context.push('/executive/time-entries/$engagementId'),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        entriesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Text('Error: $error'),
          data: (entries) {
            if (entries.isEmpty) {
              return Card(
                elevation: 0,
                color: Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest
                    .withOpacity(0.5),
                child: const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('No time entries yet')),
                ),
              );
            }
            return Column(
              children: entries
                  .take(5)
                  .map((e) => _buildTimeEntryCard(context, e))
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildTimeEntryCard(BuildContext context, ExecutiveTimeEntry entry) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          child: Text(
            entry.hours.toStringAsFixed(1),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
        title: Text(entry.description ?? entry.category ?? 'Time entry'),
        subtitle: Text(DateFormat.yMMMd().format(entry.date)),
        trailing: entry.billable
            ? const Icon(Icons.attach_money, color: Colors.green, size: 18)
            : null,
      ),
    );
  }

  void _showOptions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit),
              title: const Text('Edit Engagement'),
              onTap: () {
                Navigator.pop(context);
                context.push('/executive/engagement/$engagementId/edit');
              },
            ),
            ListTile(
              leading: const Icon(Icons.pause),
              title: const Text('Pause Engagement'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Pause engagement
              },
            ),
            ListTile(
              leading: const Icon(Icons.check_circle),
              title: const Text('Complete Engagement'),
              onTap: () {
                Navigator.pop(context);
                // TODO: Complete engagement
              },
            ),
          ],
        ),
      ),
    );
  }
}
