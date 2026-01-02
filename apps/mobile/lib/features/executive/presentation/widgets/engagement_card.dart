import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../domain/models/engagement.dart';

/// Card widget for displaying engagement summary
class EngagementCard extends StatelessWidget {
  final ExecutiveEngagement engagement;
  final VoidCallback? onTap;

  const EngagementCard({
    super.key,
    required this.engagement,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: Theme.of(context).colorScheme.outlineVariant,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Client logo or placeholder
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: engagement.clientLogoUrl != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              engagement.clientLogoUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _buildPlaceholder(context),
                            ),
                          )
                        : _buildPlaceholder(context),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          engagement.title,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          engagement.clientName ?? 'Client',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildStatusBadge(context),
                ],
              ),
              const SizedBox(height: 16),
              // Progress and metrics
              Row(
                children: [
                  _buildMetric(
                    context,
                    Icons.schedule,
                    '${engagement.hoursPerWeek}h/week',
                  ),
                  const SizedBox(width: 16),
                  _buildMetric(
                    context,
                    Icons.payments_outlined,
                    engagement.compensationDisplay,
                  ),
                  const Spacer(),
                  if (engagement.lastActivityAt != null)
                    Text(
                      'Active ${timeago.format(engagement.lastActivityAt!)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
              if (engagement.objectives.isNotEmpty) ...[
                const SizedBox(height: 12),
                _buildObjectivesProgress(context),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    return Center(
      child: Icon(
        Icons.business,
        color: Theme.of(context).colorScheme.onPrimaryContainer,
        size: 24,
      ),
    );
  }

  Widget _buildStatusBadge(BuildContext context) {
    final (color, bgColor) = switch (engagement.status) {
      EngagementStatus.active => (Colors.green, Colors.green.withOpacity(0.1)),
      EngagementStatus.paused => (Colors.orange, Colors.orange.withOpacity(0.1)),
      EngagementStatus.proposal ||
      EngagementStatus.negotiating ||
      EngagementStatus.pendingApproval =>
        (Colors.blue, Colors.blue.withOpacity(0.1)),
      EngagementStatus.completed => (Colors.grey, Colors.grey.withOpacity(0.1)),
      EngagementStatus.terminated => (Colors.red, Colors.red.withOpacity(0.1)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        engagement.status.displayName,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildMetric(BuildContext context, IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildObjectivesProgress(BuildContext context) {
    final progress = engagement.objectivesProgress;
    final completed = engagement.completedObjectives;
    final total = engagement.objectives.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'OKRs Progress',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            Text(
              '$completed/$total completed',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
            backgroundColor: Colors.grey.withOpacity(0.2),
          ),
        ),
      ],
    );
  }
}
