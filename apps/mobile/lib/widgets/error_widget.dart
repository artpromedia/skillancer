import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Displays an error state with icon, message, and optional retry button.
///
/// Used throughout the app when data fetching or operations fail.
class AppErrorWidget extends StatelessWidget {
  /// The error message to display.
  final String message;

  /// Optional detailed description shown below the main message.
  final String? description;

  /// The icon displayed above the error message.
  final IconData icon;

  /// Color of the icon. Defaults to [AppTheme.errorColor].
  final Color? iconColor;

  /// Size of the icon.
  final double iconSize;

  /// Label for the retry/action button. If null, no button is shown.
  final String? actionLabel;

  /// Callback invoked when the action button is pressed.
  final VoidCallback? onAction;

  const AppErrorWidget({
    super.key,
    required this.message,
    this.description,
    this.icon = Icons.error_outline_rounded,
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel,
    this.onAction,
  });

  /// Convenience constructor for network errors with a retry button.
  const AppErrorWidget.network({
    super.key,
    this.message = 'Unable to connect',
    this.description = 'Please check your internet connection and try again.',
    this.icon = Icons.wifi_off_rounded,
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel = 'Retry',
    this.onAction,
  });

  /// Convenience constructor for generic errors with a retry button.
  const AppErrorWidget.retry({
    super.key,
    this.message = 'Something went wrong',
    this.description,
    this.icon = Icons.error_outline_rounded,
    this.iconColor,
    this.iconSize = 56.0,
    this.actionLabel = 'Try Again',
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = iconColor ?? AppTheme.errorColor;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
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
              message,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
              textAlign: TextAlign.center,
            ),
            if (description != null) ...[
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                description!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.neutral500,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppTheme.spacingLg),
              SizedBox(
                width: 200,
                child: ElevatedButton(
                  onPressed: onAction,
                  child: Text(actionLabel!),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
