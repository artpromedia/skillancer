import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// A centered circular progress indicator with optional message.
///
/// Can be used inline or as a full-screen loading overlay.
class LoadingIndicator extends StatelessWidget {
  /// Optional message displayed below the spinner.
  final String? message;

  /// Color of the progress indicator. Defaults to [AppTheme.primaryColor].
  final Color? color;

  /// Diameter of the progress indicator.
  final double size;

  /// Stroke width of the circular indicator.
  final double strokeWidth;

  const LoadingIndicator({
    super.key,
    this.message,
    this.color,
    this.size = 36.0,
    this.strokeWidth = 3.0,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: size,
              height: size,
              child: CircularProgressIndicator(
                strokeWidth: strokeWidth,
                valueColor: AlwaysStoppedAnimation<Color>(
                  color ?? AppTheme.primaryColor,
                ),
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: AppTheme.spacingMd),
              Text(
                message!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.neutral500,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Shows a full-screen semi-transparent loading overlay.
  ///
  /// Typically used with [Stack] or [Overlay] to block interaction
  /// while an async operation completes.
  static Widget overlay({
    String? message,
    Color? barrierColor,
    Color? indicatorColor,
  }) {
    return _LoadingOverlay(
      message: message,
      barrierColor: barrierColor,
      indicatorColor: indicatorColor,
    );
  }
}

/// Full-screen semi-transparent loading overlay.
class _LoadingOverlay extends StatelessWidget {
  final String? message;
  final Color? barrierColor;
  final Color? indicatorColor;

  const _LoadingOverlay({
    this.message,
    this.barrierColor,
    this.indicatorColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: barrierColor ?? Colors.black.withOpacity(0.4),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingXl,
            vertical: AppTheme.spacingLg,
          ),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(
                  strokeWidth: 3.0,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    indicatorColor ?? AppTheme.primaryColor,
                  ),
                ),
              ),
              if (message != null) ...[
                const SizedBox(height: AppTheme.spacingMd),
                Text(
                  message!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.neutral600,
                      ),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
