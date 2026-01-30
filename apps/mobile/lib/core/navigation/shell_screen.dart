import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/providers.dart';
import '../services/offline_sync_manager.dart' show SyncStatus;
import '../theme/app_theme.dart';
import 'app_router.dart';

/// Shell screen with bottom navigation
class ShellScreen extends ConsumerStatefulWidget {
  final Widget child;

  const ShellScreen({super.key, required this.child});

  @override
  ConsumerState<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends ConsumerState<ShellScreen> {
  int _currentIndex = 0;

  final List<_NavItem> _navItems = const [
    _NavItem(
      icon: Icons.work_outline,
      activeIcon: Icons.work,
      label: 'Jobs',
      route: AppRoutes.jobs,
    ),
    _NavItem(
      icon: Icons.description_outlined,
      activeIcon: Icons.description,
      label: 'Proposals',
      route: AppRoutes.proposals,
    ),
    _NavItem(
      icon: Icons.timer_outlined,
      activeIcon: Icons.timer,
      label: 'Time',
      route: AppRoutes.time,
    ),
    _NavItem(
      icon: Icons.chat_bubble_outline,
      activeIcon: Icons.chat_bubble,
      label: 'Messages',
      route: AppRoutes.messages,
    ),
    _NavItem(
      icon: Icons.person_outline,
      activeIcon: Icons.person,
      label: 'Profile',
      route: AppRoutes.profile,
    ),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _updateSelectedIndex();
  }

  void _updateSelectedIndex() {
    final location = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _navItems.length; i++) {
      if (location.startsWith(_navItems[i].route)) {
        if (_currentIndex != i) {
          setState(() => _currentIndex = i);
        }
        break;
      }
    }
  }

  void _onItemTapped(int index) {
    if (index == _currentIndex) {
      // Already on this tab, might want to pop to root
      return;
    }
    setState(() => _currentIndex = index);
    context.go(_navItems[index].route);
  }

  @override
  Widget build(BuildContext context) {
    final isOnline = ref.watch(isOnlineProvider);
    final syncStatus = ref.watch(offlineSyncStatusProvider);
    final pendingCount = ref.watch(pendingOperationsCountProvider);

    return Scaffold(
      body: Column(
        children: [
          // Offline indicator banner
          _OfflineBanner(
            isOnline: isOnline,
            syncStatus: syncStatus.valueOrNull,
            pendingCount: pendingCount.valueOrNull ?? 0,
            onSync: () {
              ref.read(offlineSyncManagerProvider).syncPendingOperations();
            },
          ),
          // Main content
          Expanded(child: widget.child),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onItemTapped,
          items: _navItems.map((item) {
            return BottomNavigationBarItem(
              icon: Icon(item.icon),
              activeIcon: Icon(item.activeIcon),
              label: item.label,
            );
          }).toList(),
        ),
      ),
    );
  }
}

/// Offline status banner
class _OfflineBanner extends StatelessWidget {
  final bool isOnline;
  final SyncStatus? syncStatus;
  final int pendingCount;
  final VoidCallback onSync;

  const _OfflineBanner({
    required this.isOnline,
    this.syncStatus,
    required this.pendingCount,
    required this.onSync,
  });

  @override
  Widget build(BuildContext context) {
    // Don't show anything if online and no pending operations
    if (isOnline && pendingCount == 0 && syncStatus != SyncStatus.syncing) {
      return const SizedBox.shrink();
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: _getBannerColor(),
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildIcon(),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _getMessage(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (isOnline &&
                  pendingCount > 0 &&
                  syncStatus != SyncStatus.syncing)
                TextButton(
                  onPressed: onSync,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: const Text('Sync Now'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getBannerColor() {
    if (!isOnline) {
      return Colors.grey.shade700;
    }
    if (syncStatus == SyncStatus.syncing) {
      return Colors.blue.shade600;
    }
    if (syncStatus == SyncStatus.error) {
      return Colors.orange.shade700;
    }
    if (pendingCount > 0) {
      return Colors.amber.shade700;
    }
    return Colors.green.shade600;
  }

  Widget _buildIcon() {
    if (syncStatus == SyncStatus.syncing) {
      return const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
        ),
      );
    }
    if (!isOnline) {
      return const Icon(Icons.cloud_off, color: Colors.white, size: 18);
    }
    if (syncStatus == SyncStatus.error) {
      return const Icon(Icons.error_outline, color: Colors.white, size: 18);
    }
    if (pendingCount > 0) {
      return const Icon(Icons.cloud_queue, color: Colors.white, size: 18);
    }
    return const Icon(Icons.cloud_done, color: Colors.white, size: 18);
  }

  String _getMessage() {
    if (!isOnline) {
      return pendingCount > 0
          ? 'You\'re offline • $pendingCount changes pending'
          : 'You\'re offline • Changes will sync when online';
    }
    if (syncStatus == SyncStatus.syncing) {
      return 'Syncing $pendingCount changes...';
    }
    if (syncStatus == SyncStatus.error) {
      return 'Sync failed • $pendingCount changes pending';
    }
    if (pendingCount > 0) {
      return '$pendingCount changes ready to sync';
    }
    return 'All changes synced';
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });
}

/// Badge for unread count
class UnreadBadge extends StatelessWidget {
  final int count;
  final Widget child;

  const UnreadBadge({
    super.key,
    required this.count,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return child;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        Positioned(
          right: -6,
          top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.errorColor,
              borderRadius: BorderRadius.circular(10),
            ),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            child: Text(
              count > 99 ? '99+' : count.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}
