import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/notification.dart';

/// Notifications screen
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () {
              // Mark all as read
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return const _EmptyState();
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (context, index) {
                return _NotificationTile(notification: notifications[index]);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(child: Text('Error: $error')),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;

  const _NotificationTile({required this.notification});

  IconData _getIcon() {
    switch (notification.type) {
      case NotificationType.proposal:
        return Icons.description_outlined;
      case NotificationType.job:
        return Icons.work_outline;
      case NotificationType.message:
        return Icons.chat_bubble_outline;
      case NotificationType.contract:
        return Icons.assignment_outlined;
      case NotificationType.payment:
        return Icons.payment_outlined;
      case NotificationType.milestone:
        return Icons.flag_outlined;
      case NotificationType.review:
        return Icons.star_outline;
      case NotificationType.general:
        return Icons.notifications_outlined;
    }
  }

  Color _getIconColor() {
    switch (notification.type) {
      case NotificationType.proposal:
        return AppTheme.primaryColor;
      case NotificationType.job:
        return AppTheme.accentColor;
      case NotificationType.message:
        return AppTheme.infoColor;
      case NotificationType.contract:
        return AppTheme.successColor;
      case NotificationType.payment:
        return AppTheme.successColor;
      case NotificationType.milestone:
        return AppTheme.warningColor;
      case NotificationType.review:
        return Colors.amber;
      case NotificationType.general:
        return AppTheme.neutral500;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color:
          notification.isRead ? null : AppTheme.primaryColor.withOpacity(0.05),
      child: ListTile(
        onTap: () {
          if (notification.actionUrl != null) {
            context.push(notification.actionUrl!);
          }
        },
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _getIconColor().withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            _getIcon(),
            color: _getIconColor(),
            size: 20,
          ),
        ),
        title: Text(
          notification.title,
          style: TextStyle(
            fontWeight:
                notification.isRead ? FontWeight.normal : FontWeight.bold,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              notification.body,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              timeago.format(notification.createdAt),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.notifications_off_outlined,
            size: 64,
            color: AppTheme.neutral400,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          Text(
            'No notifications',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'You\'re all caught up!',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
