import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// Size presets for [UserAvatar].
enum AvatarSize {
  /// 28px diameter
  small(14.0, 11.0, 7.0),

  /// 40px diameter
  medium(20.0, 14.0, 10.0),

  /// 56px diameter
  large(28.0, 18.0, 13.0),

  /// 80px diameter
  extraLarge(40.0, 24.0, 16.0);

  /// The radius of the avatar circle.
  final double radius;

  /// Font size for the initials fallback.
  final double fontSize;

  /// Radius of the online status indicator dot.
  final double indicatorRadius;

  const AvatarSize(this.radius, this.fontSize, this.indicatorRadius);
}

/// Circular avatar displaying a user's profile image or initials fallback.
///
/// Supports an optional online status indicator and configurable border ring.
class UserAvatar extends StatelessWidget {
  /// URL of the user's profile image. Falls back to initials if null.
  final String? imageUrl;

  /// The user's display name, used to derive initials.
  final String name;

  /// Size preset for the avatar.
  final AvatarSize size;

  /// Whether to show the green online status indicator.
  final bool showOnlineIndicator;

  /// Whether the user is currently online.
  final bool isOnline;

  /// Whether to show a border ring around the avatar.
  final bool showBorder;

  /// Color of the border ring. Defaults to [AppTheme.primaryColor].
  final Color? borderColor;

  /// Width of the border ring.
  final double borderWidth;

  /// Background color for the initials fallback.
  final Color? backgroundColor;

  const UserAvatar({
    super.key,
    this.imageUrl,
    required this.name,
    this.size = AvatarSize.medium,
    this.showOnlineIndicator = false,
    this.isOnline = false,
    this.showBorder = false,
    this.borderColor,
    this.borderWidth = 2.0,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final initials = _getInitials(name);
    final effectiveBgColor = backgroundColor ?? AppTheme.primaryColor;

    return SizedBox(
      width: (size.radius * 2) + (showBorder ? borderWidth * 2 : 0),
      height: (size.radius * 2) + (showBorder ? borderWidth * 2 : 0),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Avatar with optional border
          Container(
            decoration: showBorder
                ? BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: borderColor ?? AppTheme.primaryColor,
                      width: borderWidth,
                    ),
                  )
                : null,
            child: CircleAvatar(
              radius: size.radius,
              backgroundColor: effectiveBgColor.withOpacity(0.15),
              backgroundImage:
                  imageUrl != null ? NetworkImage(imageUrl!) : null,
              onBackgroundImageError: imageUrl != null
                  ? (_, __) {
                      // Silently fall back to initials on image load failure.
                    }
                  : null,
              child: imageUrl == null
                  ? Text(
                      initials,
                      style: TextStyle(
                        fontSize: size.fontSize,
                        fontWeight: FontWeight.w600,
                        color: effectiveBgColor,
                      ),
                    )
                  : null,
            ),
          ),

          // Online status indicator
          if (showOnlineIndicator)
            Positioned(
              right: showBorder ? borderWidth - 1 : 0,
              bottom: showBorder ? borderWidth - 1 : 0,
              child: Container(
                width: size.indicatorRadius,
                height: size.indicatorRadius,
                decoration: BoxDecoration(
                  color: isOnline
                      ? AppTheme.successColor
                      : AppTheme.neutral400,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Theme.of(context).colorScheme.surface,
                    width: 2.0,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Extracts up to two initials from the given [name].
  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}
