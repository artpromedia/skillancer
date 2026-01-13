import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

/// Connectivity status
enum ConnectivityStatus {
  online,
  offline,
  limited;

  bool get isOnline => this == ConnectivityStatus.online;
  bool get isOffline => this == ConnectivityStatus.offline;
}

/// Service to monitor network connectivity
class ConnectivityService {
  static ConnectivityService? _instance;

  final Connectivity _connectivity = Connectivity();
  final StreamController<ConnectivityStatus> _statusController =
      StreamController<ConnectivityStatus>.broadcast();

  ConnectivityStatus _currentStatus = ConnectivityStatus.online;
  StreamSubscription<ConnectivityResult>? _subscription;

  ConnectivityService._() {
    _init();
  }

  factory ConnectivityService() {
    _instance ??= ConnectivityService._();
    return _instance!;
  }

  void _init() {
    // Check initial status
    _checkConnectivity();

    // Listen for changes
    _subscription = _connectivity.onConnectivityChanged.listen((result) {
      _updateStatus(result);
    });
  }

  Future<void> _checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _updateStatus(result);
  }

  void _updateStatus(ConnectivityResult result) {
    ConnectivityStatus newStatus;

    if (result == ConnectivityResult.none) {
      newStatus = ConnectivityStatus.offline;
    } else if (result == ConnectivityResult.wifi ||
        result == ConnectivityResult.ethernet) {
      newStatus = ConnectivityStatus.online;
    } else if (result == ConnectivityResult.mobile) {
      newStatus = ConnectivityStatus.online;
    } else if (result == ConnectivityResult.vpn) {
      newStatus = ConnectivityStatus.online;
    } else {
      newStatus = ConnectivityStatus.limited;
    }

    if (newStatus != _currentStatus) {
      _currentStatus = newStatus;
      _statusController.add(newStatus);
    }
  }

  /// Current connectivity status
  ConnectivityStatus get currentStatus => _currentStatus;

  /// Stream of connectivity status changes
  Stream<ConnectivityStatus> get statusStream => _statusController.stream;

  /// Check if currently online
  bool get isOnline => _currentStatus.isOnline;

  /// Check if currently offline
  bool get isOffline => _currentStatus.isOffline;

  /// Dispose resources
  void dispose() {
    _subscription?.cancel();
    _statusController.close();
  }
}

/// Widget that shows offline indicator
class OfflineIndicator extends StatelessWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<ConnectivityStatus>(
      stream: ConnectivityService().statusStream,
      initialData: ConnectivityService().currentStatus,
      builder: (context, snapshot) {
        final status = snapshot.data ?? ConnectivityStatus.online;

        if (status.isOnline) {
          return const SizedBox.shrink();
        }

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
          color: status == ConnectivityStatus.offline
              ? Colors.red.shade700
              : Colors.orange.shade700,
          child: SafeArea(
            bottom: false,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  status == ConnectivityStatus.offline
                      ? Icons.wifi_off
                      : Icons.signal_wifi_statusbar_connected_no_internet_4,
                  color: Colors.white,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  status == ConnectivityStatus.offline
                      ? 'You are offline'
                      : 'Limited connectivity',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Mixin for widgets that need connectivity awareness
mixin ConnectivityAware<T extends StatefulWidget> on State<T> {
  late StreamSubscription<ConnectivityStatus> _connectivitySubscription;
  ConnectivityStatus _connectivityStatus = ConnectivityStatus.online;

  bool get isOnline => _connectivityStatus.isOnline;
  bool get isOffline => _connectivityStatus.isOffline;

  @override
  void initState() {
    super.initState();
    _connectivityStatus = ConnectivityService().currentStatus;
    _connectivitySubscription =
        ConnectivityService().statusStream.listen((status) {
      if (mounted) {
        setState(() => _connectivityStatus = status);
        onConnectivityChanged(status);
      }
    });
  }

  @override
  void dispose() {
    _connectivitySubscription.cancel();
    super.dispose();
  }

  /// Override this to handle connectivity changes
  void onConnectivityChanged(ConnectivityStatus status) {}
}
