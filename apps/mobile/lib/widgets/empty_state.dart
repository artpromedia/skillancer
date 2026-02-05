import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Displays an empty state with icon, title, subtitle, and optional action.
///
/// Used when lists or data collections are empty (no jobs, no proposals, etc.).
class EmptyState extends StatelessWidget {
  /// The icon displayed at the top of the empty state.
  final IconData icon;

  /// The primary title text.
  final String title;

  /// The secondary subtitle text with additional context.
  final String? subtitle;

  /// Color of the icon. Defaults to [AppTheme.neutral400].
  final Color? iconColor;

  /// Size of the icon.
  final double iconSize;

  /// Label for the optional action button.
  final String? actionLabel;

  /// Callback invoked when the action button is pressed.
  final VoidCallback? onAction;

  /// Optional custom widget displayed below the subtitle.
  final Widget? child;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
    this.child,
  });

  /// Empty state for when there are no jobs to display.
  const EmptyState.noJobs({
    super.key,
    this.icon = Icons.work_outline_rounded,
    this.title = 'No jobs found',
    this.subtitle = 'Try adjusting your filters or check back later for new opportunities.',
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
    this.child,
  });

  /// Empty state for when there are no proposals.
  const EmptyState.noProposals({
    super.key,
    this.icon = Icons.description_outlined,
    this.title = 'No proposals yet',
    this.subtitle = 'Browse available jobs and submit your first proposal.',
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel = 'Browse Jobs',
    this.onAction,
    this.child,
  });

  /// Empty state for when there are no messages.
  const EmptyState.noMessages({
    super.key,
    this.icon = Icons.chat_bubble_outline_rounded,
    this.title = 'No messages',
    this.subtitle = 'Your conversations with clients will appear here.',
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
    this.child,
  });

  /// Empty state for when there are no notifications.
  const EmptyState.noNotifications({
    super.key,
    this.icon = Icons.notifications_none_rounded,
    this.title = 'No notifications',
    this.subtitle = 'You\'re all caught up! New notifications will appear here.',
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
    this.child,
  });

  /// Empty state for search results.
  const EmptyState.noResults({
    super.key,
    this.icon = Icons.search_off_rounded,
    this.title = 'No results found',
    this.subtitle = 'Try different keywords or adjust your search criteria.',
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = iconColor ?? AppTheme.neutral400;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: effectiveIconColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: iconSize,
                color: effectiveIconColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacingLg),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
              textAlign: TextAlign.center,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.neutral500,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
            if (child != null) ...[
              const SizedBox(height: AppTheme.spacingMd),
              child!,
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppTheme.spacingLg),
              ElevatedButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
