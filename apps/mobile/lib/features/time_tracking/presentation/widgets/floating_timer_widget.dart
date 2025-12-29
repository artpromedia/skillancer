import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Floating timer widget for persistent display
class FloatingTimerWidget extends StatelessWidget {
  final String time;
  final String? contractTitle;
  final bool isRunning;
  final VoidCallback onTap;
  final VoidCallback onStop;

  const FloatingTimerWidget({
    super.key,
    required this.time,
    this.contractTitle,
    required this.isRunning,
    required this.onTap,
    required this.onStop,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(AppTheme.spacingMd),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          color: AppTheme.primaryColor,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primaryColor.withOpacity(0.3),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Animated recording dot
            _AnimatedRecordingDot(isRunning: isRunning),
            const SizedBox(width: AppTheme.spacingSm),

            // Timer display
            Text(
              time,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),

            if (contractTitle != null) ...[
              Container(
                margin:
                    const EdgeInsets.symmetric(horizontal: AppTheme.spacingSm),
                width: 1,
                height: 20,
                color: Colors.white30,
              ),
              Flexible(
                child: Text(
                  contractTitle!,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],

            const SizedBox(width: AppTheme.spacingSm),
            IconButton(
              onPressed: onStop,
              icon: const Icon(Icons.stop, color: Colors.white),
              iconSize: 20,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimatedRecordingDot extends StatefulWidget {
  final bool isRunning;

  const _AnimatedRecordingDot({required this.isRunning});

  @override
  State<_AnimatedRecordingDot> createState() => _AnimatedRecordingDotState();
}

class _AnimatedRecordingDotState extends State<_AnimatedRecordingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _animation = Tween<double>(begin: 1.0, end: 0.3).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    if (widget.isRunning) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(_AnimatedRecordingDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRunning && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.isRunning && _controller.isAnimating) {
      _controller.stop();
      _controller.reset();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(_animation.value),
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }
}
