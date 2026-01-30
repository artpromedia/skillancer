import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/notification.dart';

/// Notifications screen with pagination, mark as read, and error handling
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(notificationsStateProvider.notifier).loadMoreNotifications();
    }
  }

  Future<void> _markAllAsRead() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark All as Read'),
        content: const Text(
            'Are you sure you want to mark all notifications as read?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Mark All'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(notificationsStateProvider.notifier).markAllAsRead();
    }
  }

  @override
  Widget build(BuildContext context) {
    final notificationsState = ref.watch(notificationsStateProvider);
    final isOnline = ref.watch(isOnlineProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (notificationsState.unreadCount > 0)
            TextButton(
              onPressed: _markAllAsRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: Column(
        children: [
          // Offline banner
          if (!isOnline)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppTheme.spacingSm),
              color: AppTheme.warningColor.withOpacity(0.1),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.cloud_off,
                    size: 16,
                    color: AppTheme.warningColor,
                  ),
                  const SizedBox(width: AppTheme.spacingSm),
                  Text(
                    'You\'re offline',
                    style: TextStyle(
                      color: AppTheme.warningColor,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          // Main content
          Expanded(
            child: _buildContent(notificationsState),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(NotificationsState state) {
    if (state.error != null && state.notifications.isEmpty) {
      return _ErrorState(
        error: state.error!,
        onRetry: () => ref.read(notificationsStateProvider.notifier).refresh(),
      );
    }

    if (state.isLoading && state.notifications.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.notifications.isEmpty) {
      return const _EmptyState();
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(notificationsStateProvider.notifier).refresh(),
      child: ListView.builder(
        controller: _scrollController,
        itemCount: state.notifications.length + (state.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == state.notifications.length) {
            return const Padding(
              padding: EdgeInsets.all(AppTheme.spacingMd),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          }

          return _NotificationTile(
            notification: state.notifications[index],
            onTap: () => _handleNotificationTap(state.notifications[index]),
          );
        },
      ),
    );
  }

  void _handleNotificationTap(AppNotification notification) {
    // Mark as read if unread
    if (!notification.isRead) {
      ref.read(notificationsStateProvider.notifier).markAsRead(notification.id);
    }

    // Navigate based on action URL or notification type
    if (notification.actionUrl != null) {
      context.push(notification.actionUrl!);
    } else {
      // Navigate based on type and data
      _navigateByType(notification);
    }
  }

  void _navigateByType(AppNotification notification) {
    final data = notification.data;

    switch (notification.type) {
      case NotificationType.job:
        final jobId = data?['jobId'] as String?;
        if (jobId != null) {
          context.push('/jobs/$jobId');
        }
        break;
      case NotificationType.proposal:
        final proposalId = data?['proposalId'] as String?;
        if (proposalId != null) {
          context.push('/proposals/$proposalId');
        }
        break;
      case NotificationType.message:
        final conversationId = data?['conversationId'] as String?;
        if (conversationId != null) {
          context.push('/messages/$conversationId');
        }
        break;
      case NotificationType.contract:
        final contractId = data?['contractId'] as String?;
        if (contractId != null) {
          context.push('/contracts/$contractId');
        }
        break;
      case NotificationType.payment:
        context.push('/earnings');
        break;
      case NotificationType.milestone:
        final contractId = data?['contractId'] as String?;
        if (contractId != null) {
          context.push('/contracts/$contractId');
        }
        break;
      case NotificationType.review:
        context.push('/profile');
        break;
      case NotificationType.general:
        // No specific navigation
        break;
    }
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

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
        onTap: onTap,
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
            Row(
              children: [
                Text(
                  timeago.format(notification.createdAt),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (!notification.isRead) ...[
                  const SizedBox(width: AppTheme.spacingSm),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppTheme.primaryColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
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

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorState({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppTheme.errorColor,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              'Failed to load notifications',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              error,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
