import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Size variants for [StatusBadge].
enum BadgeSize {
  /// Compact badge with smaller text and padding.
  small,

  /// Standard badge size.
  regular,
}

/// Predefined status styles for common use cases.
enum StatusType {
  active,
  pending,
  completed,
  cancelled,
  rejected,
  draft,
  inProgress,
  paused,
  custom,
}

/// A colored badge/chip for displaying status labels.
///
/// Provides predefined styles for common statuses (active, pending, etc.)
/// and supports fully custom colors and text.
class StatusBadge extends StatelessWidget {
  /// The status label text.
  final String label;

  /// Background color of the badge. Overrides [statusType] color.
  final Color? backgroundColor;

  /// Text/foreground color of the badge. Overrides [statusType] color.
  final Color? foregroundColor;

  /// Predefined status type that determines colors automatically.
  final StatusType statusType;

  /// Size variant of the badge.
  final BadgeSize badgeSize;

  /// Optional icon displayed before the label.
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.custom,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for an active/open status.
  const StatusBadge.active({
    super.key,
    this.label = 'Active',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.active,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a pending/awaiting status.
  const StatusBadge.pending({
    super.key,
    this.label = 'Pending',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.pending,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a completed/done status.
  const StatusBadge.completed({
    super.key,
    this.label = 'Completed',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.completed,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a cancelled status.
  const StatusBadge.cancelled({
    super.key,
    this.label = 'Cancelled',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.cancelled,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a rejected status.
  const StatusBadge.rejected({
    super.key,
    this.label = 'Rejected',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.rejected,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a draft status.
  const StatusBadge.draft({
    super.key,
    this.label = 'Draft',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.draft,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for an in-progress status.
  const StatusBadge.inProgress({
    super.key,
    this.label = 'In Progress',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.inProgress,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  /// Badge for a paused status.
  const StatusBadge.paused({
    super.key,
    this.label = 'Paused',
    this.backgroundColor,
    this.foregroundColor,
    this.statusType = StatusType.paused,
    this.badgeSize = BadgeSize.regular,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _resolveColors();
    final isSmall = badgeSize == BadgeSize.small;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isSmall ? AppTheme.spacingSm : AppTheme.spacingSm + 2,
        vertical: isSmall ? 2.0 : AppTheme.spacingXs,
      ),
      decoration: BoxDecoration(
        color: colors.$1.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        border: Border.all(
          color: colors.$1.withOpacity(0.24),
          width: 0.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: isSmall ? 10 : 14,
              color: colors.$2,
            ),
            SizedBox(width: isSmall ? 2 : AppTheme.spacingXs),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: isSmall ? 10 : 12,
              fontWeight: FontWeight.w600,
              color: colors.$2,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  /// Returns (background tint color, foreground/text color) for the badge.
  (Color, Color) _resolveColors() {
    if (backgroundColor != null && foregroundColor != null) {
      return (backgroundColor!, foregroundColor!);
    }

    return switch (statusType) {
      StatusType.active => (AppTheme.successColor, _darken(AppTheme.successColor)),
      StatusType.pending => (AppTheme.warningColor, _darken(AppTheme.warningColor)),
      StatusType.completed => (AppTheme.infoColor, _darken(AppTheme.infoColor)),
      StatusType.cancelled => (AppTheme.neutral400, AppTheme.neutral600),
      StatusType.rejected => (AppTheme.errorColor, _darken(AppTheme.errorColor)),
      StatusType.draft => (AppTheme.neutral400, AppTheme.neutral600),
      StatusType.inProgress => (AppTheme.primaryColor, _darken(AppTheme.primaryColor)),
      StatusType.paused => (AppTheme.accentColor, _darken(AppTheme.accentColor)),
      StatusType.custom => (
          backgroundColor ?? AppTheme.neutral400,
          foregroundColor ?? AppTheme.neutral700,
        ),
    };
  }

  /// Darkens a color for better text contrast on a light tinted background.
  static Color _darken(Color color) {
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withLightness((hsl.lightness - 0.15).clamp(0.0, 1.0))
        .withSaturation((hsl.saturation + 0.1).clamp(0.0, 1.0))
        .toColor();
  }
}
