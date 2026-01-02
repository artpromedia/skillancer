import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../domain/models/executive_profile.dart';

/// Banner showing executive vetting status and progress
class VettingStatusBanner extends StatelessWidget {
  final VettingStatus status;
  final int referencesProvided;
  final int referencesVerified;

  const VettingStatusBanner({
    super.key,
    required this.status,
    this.referencesProvided = 0,
    this.referencesVerified = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _getBackgroundColor(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _getBorderColor(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_getIcon(), color: _getIconColor(context), size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getTitle(),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _getSubtitle(),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildProgressIndicator(context),
          const SizedBox(height: 12),
          _buildActionButton(context),
        ],
      ),
    );
  }

  Color _getBackgroundColor(BuildContext context) {
    return switch (status) {
      VettingStatus.approved => Colors.green.withOpacity(0.1),
      VettingStatus.rejected => Colors.red.withOpacity(0.1),
      VettingStatus.suspended => Colors.orange.withOpacity(0.1),
      _ => Theme.of(context).colorScheme.primaryContainer.withOpacity(0.5),
    };
  }

  Color _getBorderColor(BuildContext context) {
    return switch (status) {
      VettingStatus.approved => Colors.green.withOpacity(0.3),
      VettingStatus.rejected => Colors.red.withOpacity(0.3),
      VettingStatus.suspended => Colors.orange.withOpacity(0.3),
      _ => Theme.of(context).colorScheme.primary.withOpacity(0.3),
    };
  }

  IconData _getIcon() {
    return switch (status) {
      VettingStatus.approved => Icons.verified,
      VettingStatus.rejected => Icons.cancel,
      VettingStatus.suspended => Icons.pause_circle,
      VettingStatus.pending => Icons.hourglass_empty,
      VettingStatus.applicationReview => Icons.rate_review,
      VettingStatus.interviewScheduled => Icons.event,
      VettingStatus.interviewCompleted => Icons.check_circle_outline,
      VettingStatus.referenceCheck => Icons.people_outline,
    };
  }

  Color _getIconColor(BuildContext context) {
    return switch (status) {
      VettingStatus.approved => Colors.green,
      VettingStatus.rejected => Colors.red,
      VettingStatus.suspended => Colors.orange,
      _ => Theme.of(context).colorScheme.primary,
    };
  }

  String _getTitle() {
    return switch (status) {
      VettingStatus.pending => 'Application Pending',
      VettingStatus.applicationReview => 'Under Review',
      VettingStatus.interviewScheduled => 'Interview Scheduled',
      VettingStatus.interviewCompleted => 'Interview Completed',
      VettingStatus.referenceCheck => 'Reference Check',
      VettingStatus.approved => 'Verified Executive',
      VettingStatus.rejected => 'Application Not Approved',
      VettingStatus.suspended => 'Account Suspended',
    };
  }

  String _getSubtitle() {
    return switch (status) {
      VettingStatus.pending => 'Your application is waiting to be reviewed',
      VettingStatus.applicationReview => 'Our team is reviewing your profile',
      VettingStatus.interviewScheduled => 'Your interview has been scheduled',
      VettingStatus.interviewCompleted => 'Awaiting interview evaluation',
      VettingStatus.referenceCheck =>
        'Verifying references ($referencesVerified/$referencesProvided verified)',
      VettingStatus.approved => 'You are a verified Skillancer executive',
      VettingStatus.rejected => 'Contact support for more information',
      VettingStatus.suspended => 'Contact support to resolve this issue',
    };
  }

  Widget _buildProgressIndicator(BuildContext context) {
    final steps = [
      VettingStatus.pending,
      VettingStatus.applicationReview,
      VettingStatus.interviewScheduled,
      VettingStatus.interviewCompleted,
      VettingStatus.referenceCheck,
      VettingStatus.approved,
    ];

    final currentIndex = steps.indexOf(status);
    if (currentIndex < 0 || status == VettingStatus.rejected || status == VettingStatus.suspended) {
      return const SizedBox.shrink();
    }

    final progress = (currentIndex + 1) / steps.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Progress',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: Colors.grey.withOpacity(0.2),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(BuildContext context) {
    if (status == VettingStatus.approved) {
      return const SizedBox.shrink();
    }

    final (label, route) = switch (status) {
      VettingStatus.pending => ('Complete Profile', '/executive/profile/edit'),
      VettingStatus.referenceCheck => ('Add References', '/executive/references'),
      VettingStatus.rejected || VettingStatus.suspended => ('Contact Support', '/support'),
      _ => ('View Status', '/executive/vetting-status'),
    };

    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: () => context.push(route),
        child: Text(label),
      ),
    );
  }
}
