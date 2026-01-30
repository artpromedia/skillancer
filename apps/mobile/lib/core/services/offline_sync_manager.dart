import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';

import '../connectivity/connectivity_service.dart';
import '../network/api_client.dart';

/// Represents a pending operation that needs to be synced
class PendingOperation {
  final String id;
  final String type;
  final String endpoint;
  final String method;
  final Map<String, dynamic>? body;
  final DateTime createdAt;
  final int retryCount;
  final String? localId;

  PendingOperation({
    required this.id,
    required this.type,
    required this.endpoint,
    required this.method,
    this.body,
    required this.createdAt,
    this.retryCount = 0,
    this.localId,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'endpoint': endpoint,
        'method': method,
        'body': body,
        'createdAt': createdAt.toIso8601String(),
        'retryCount': retryCount,
        'localId': localId,
      };

  factory PendingOperation.fromJson(Map<String, dynamic> json) =>
      PendingOperation(
        id: json['id'] as String,
        type: json['type'] as String,
        endpoint: json['endpoint'] as String,
        method: json['method'] as String,
        body: json['body'] as Map<String, dynamic>?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        retryCount: json['retryCount'] as int? ?? 0,
        localId: json['localId'] as String?,
      );

  PendingOperation copyWith({int? retryCount}) => PendingOperation(
        id: id,
        type: type,
        endpoint: endpoint,
        method: method,
        body: body,
        createdAt: createdAt,
        retryCount: retryCount ?? this.retryCount,
        localId: localId,
      );
}

/// Sync status for the offline manager
enum SyncStatus {
  idle,
  syncing,
  error,
  completed;

  bool get isSyncing => this == SyncStatus.syncing;
}

/// Result of a sync operation
class SyncResult {
  final int successCount;
  final int failureCount;
  final List<String> errors;
  final DateTime syncedAt;

  SyncResult({
    required this.successCount,
    required this.failureCount,
    required this.errors,
    required this.syncedAt,
  });
}

/// Offline sync manager for handling offline-first operations
class OfflineSyncManager {
  static const String _pendingOpsBox = 'pending_operations';
  static const String _syncMetadataBox = 'sync_metadata';
  static const int _maxRetries = 3;
  static const Duration _syncInterval = Duration(minutes: 5);

  static OfflineSyncManager? _instance;

  final ConnectivityService _connectivity;
  final ApiClient _apiClient;
  final _uuid = const Uuid();

  late Box<Map> _pendingOpsBoxInstance;
  late Box<dynamic> _syncMetadataBoxInstance;

  final _syncStatusController = StreamController<SyncStatus>.broadcast();
  final _syncResultController = StreamController<SyncResult>.broadcast();
  final _pendingCountController = StreamController<int>.broadcast();

  SyncStatus _currentStatus = SyncStatus.idle;
  Timer? _autoSyncTimer;
  StreamSubscription? _connectivitySubscription;
  bool _isInitialized = false;

  OfflineSyncManager._({
    required ConnectivityService connectivity,
    required ApiClient apiClient,
  })  : _connectivity = connectivity,
        _apiClient = apiClient;

  factory OfflineSyncManager({
    required ConnectivityService connectivity,
    required ApiClient apiClient,
  }) {
    _instance ??= OfflineSyncManager._(
      connectivity: connectivity,
      apiClient: apiClient,
    );
    return _instance!;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /// Initialize the sync manager - call during app startup
  Future<void> initialize() async {
    if (_isInitialized) return;

    _pendingOpsBoxInstance = await Hive.openBox<Map>(_pendingOpsBox);
    _syncMetadataBoxInstance = await Hive.openBox<dynamic>(_syncMetadataBox);

    // Listen for connectivity changes
    _connectivitySubscription =
        _connectivity.statusStream.listen(_onConnectivityChanged);

    // Start auto-sync timer
    _startAutoSync();

    // Emit initial pending count
    _emitPendingCount();

    _isInitialized = true;

    // If online, sync immediately
    if (_connectivity.isOnline) {
      syncPendingOperations();
    }
  }

  void _onConnectivityChanged(ConnectivityStatus status) {
    if (status.isOnline && pendingOperationsCount > 0) {
      // Device came online and has pending operations
      syncPendingOperations();
    }
  }

  void _startAutoSync() {
    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(_syncInterval, (_) {
      if (_connectivity.isOnline && pendingOperationsCount > 0) {
        syncPendingOperations();
      }
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /// Current sync status
  SyncStatus get currentStatus => _currentStatus;

  /// Stream of sync status changes
  Stream<SyncStatus> get statusStream => _syncStatusController.stream;

  /// Stream of sync results
  Stream<SyncResult> get resultStream => _syncResultController.stream;

  /// Stream of pending operations count
  Stream<int> get pendingCountStream => _pendingCountController.stream;

  /// Number of pending operations
  int get pendingOperationsCount => _pendingOpsBoxInstance.length;

  /// Get all pending operations
  List<PendingOperation> get pendingOperations {
    return _pendingOpsBoxInstance.values
        .map((map) => PendingOperation.fromJson(Map<String, dynamic>.from(map)))
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  /// Queue an operation for offline sync
  Future<String> queueOperation({
    required String type,
    required String endpoint,
    required String method,
    Map<String, dynamic>? body,
    String? localId,
  }) async {
    final operation = PendingOperation(
      id: _uuid.v4(),
      type: type,
      endpoint: endpoint,
      method: method,
      body: body,
      createdAt: DateTime.now(),
      localId: localId ?? _uuid.v4(),
    );

    await _pendingOpsBoxInstance.put(operation.id, operation.toJson());
    _emitPendingCount();

    debugPrint('[OfflineSync] Queued operation: ${operation.type}');

    // Try to sync immediately if online
    if (_connectivity.isOnline) {
      syncPendingOperations();
    }

    return operation.localId!;
  }

  /// Remove a pending operation (e.g., when user cancels)
  Future<void> removeOperation(String operationId) async {
    await _pendingOpsBoxInstance.delete(operationId);
    _emitPendingCount();
  }

  /// Clear all pending operations
  Future<void> clearAllOperations() async {
    await _pendingOpsBoxInstance.clear();
    _emitPendingCount();
  }

  /// Manually trigger sync
  Future<SyncResult> syncPendingOperations() async {
    if (_currentStatus.isSyncing) {
      return SyncResult(
        successCount: 0,
        failureCount: 0,
        errors: ['Sync already in progress'],
        syncedAt: DateTime.now(),
      );
    }

    if (!_connectivity.isOnline) {
      return SyncResult(
        successCount: 0,
        failureCount: 0,
        errors: ['Device is offline'],
        syncedAt: DateTime.now(),
      );
    }

    _setStatus(SyncStatus.syncing);

    int successCount = 0;
    int failureCount = 0;
    final errors = <String>[];

    final operations = pendingOperations;

    for (final operation in operations) {
      try {
        await _executeOperation(operation);
        await _pendingOpsBoxInstance.delete(operation.id);
        successCount++;
        debugPrint('[OfflineSync] Synced: ${operation.type}');
      } catch (e) {
        failureCount++;
        errors.add('${operation.type}: $e');
        debugPrint('[OfflineSync] Failed: ${operation.type} - $e');

        // Update retry count
        if (operation.retryCount < _maxRetries) {
          final updated = operation.copyWith(
            retryCount: operation.retryCount + 1,
          );
          await _pendingOpsBoxInstance.put(operation.id, updated.toJson());
        } else {
          // Max retries reached, move to dead letter queue
          await _moveToDeadLetter(operation, e.toString());
          await _pendingOpsBoxInstance.delete(operation.id);
        }
      }
    }

    _emitPendingCount();
    _setStatus(failureCount > 0 ? SyncStatus.error : SyncStatus.completed);

    final result = SyncResult(
      successCount: successCount,
      failureCount: failureCount,
      errors: errors,
      syncedAt: DateTime.now(),
    );

    _syncResultController.add(result);
    await _saveLastSyncTime();

    // Reset status after a delay
    Future.delayed(const Duration(seconds: 3), () {
      if (_currentStatus != SyncStatus.syncing) {
        _setStatus(SyncStatus.idle);
      }
    });

    return result;
  }

  /// Get last successful sync time
  DateTime? get lastSyncTime {
    final timestamp = _syncMetadataBoxInstance.get('lastSyncTime');
    if (timestamp == null) return null;
    return DateTime.parse(timestamp as String);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  Future<void> _executeOperation(PendingOperation operation) async {
    switch (operation.method.toUpperCase()) {
      case 'POST':
        await _apiClient.post(operation.endpoint, data: operation.body);
        break;
      case 'PUT':
        await _apiClient.put(operation.endpoint, data: operation.body);
        break;
      case 'PATCH':
        await _apiClient.patch(operation.endpoint, data: operation.body);
        break;
      case 'DELETE':
        await _apiClient.delete(operation.endpoint);
        break;
      default:
        throw Exception('Unsupported method: ${operation.method}');
    }
  }

  Future<void> _moveToDeadLetter(
      PendingOperation operation, String error) async {
    final deadLetterBox = await Hive.openBox<Map>('dead_letter_operations');
    await deadLetterBox.put(operation.id, {
      ...operation.toJson(),
      'error': error,
      'movedAt': DateTime.now().toIso8601String(),
    });
    await deadLetterBox.close();

    debugPrint(
        '[OfflineSync] Moved to dead letter: ${operation.type} - $error');
  }

  void _setStatus(SyncStatus status) {
    _currentStatus = status;
    _syncStatusController.add(status);
  }

  void _emitPendingCount() {
    _pendingCountController.add(pendingOperationsCount);
  }

  Future<void> _saveLastSyncTime() async {
    await _syncMetadataBoxInstance.put(
      'lastSyncTime',
      DateTime.now().toIso8601String(),
    );
  }

  /// Dispose resources
  void dispose() {
    _autoSyncTimer?.cancel();
    _connectivitySubscription?.cancel();
    _syncStatusController.close();
    _syncResultController.close();
    _pendingCountController.close();
  }
}

// ============================================================================
// OFFLINE-CAPABLE REPOSITORY MIXIN
// ============================================================================

/// Mixin for repositories that need offline support
mixin OfflineCapable {
  OfflineSyncManager get syncManager;
  ConnectivityService get connectivity;

  /// Execute an operation with offline fallback
  Future<T> executeWithOfflineSupport<T>({
    required String operationType,
    required String endpoint,
    required String method,
    Map<String, dynamic>? body,
    required Future<T> Function() onlineAction,
    required T Function(String localId) offlineAction,
  }) async {
    if (connectivity.isOnline) {
      try {
        return await onlineAction();
      } catch (e) {
        // If online but failed, queue for retry
        final localId = await syncManager.queueOperation(
          type: operationType,
          endpoint: endpoint,
          method: method,
          body: body,
        );
        return offlineAction(localId);
      }
    } else {
      // Offline - queue and return optimistic result
      final localId = await syncManager.queueOperation(
        type: operationType,
        endpoint: endpoint,
        method: method,
        body: body,
      );
      return offlineAction(localId);
    }
  }
}

// ============================================================================
// SYNC STATUS WIDGET
// ============================================================================

/// Widget that shows sync status indicator
class SyncStatusIndicator extends StatelessWidget {
  final OfflineSyncManager syncManager;

  const SyncStatusIndicator({
    super.key,
    required this.syncManager,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SyncStatus>(
      stream: syncManager.statusStream,
      initialData: syncManager.currentStatus,
      builder: (context, statusSnapshot) {
        return StreamBuilder<int>(
          stream: syncManager.pendingCountStream,
          initialData: syncManager.pendingOperationsCount,
          builder: (context, countSnapshot) {
            final status = statusSnapshot.data ?? SyncStatus.idle;
            final count = countSnapshot.data ?? 0;

            if (count == 0 && status == SyncStatus.idle) {
              return const SizedBox.shrink();
            }

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _getStatusColor(status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _getStatusColor(status).withOpacity(0.3),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildStatusIcon(status),
                  const SizedBox(width: 8),
                  Text(
                    _getStatusText(status, count),
                    style: TextStyle(
                      color: _getStatusColor(status),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildStatusIcon(SyncStatus status) {
    switch (status) {
      case SyncStatus.syncing:
        return SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(_getStatusColor(status)),
          ),
        );
      case SyncStatus.error:
        return Icon(
          Icons.error_outline,
          size: 14,
          color: _getStatusColor(status),
        );
      case SyncStatus.completed:
        return Icon(
          Icons.check_circle_outline,
          size: 14,
          color: _getStatusColor(status),
        );
      case SyncStatus.idle:
        return Icon(
          Icons.cloud_queue,
          size: 14,
          color: _getStatusColor(status),
        );
    }
  }

  Color _getStatusColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.syncing:
        return Colors.blue;
      case SyncStatus.error:
        return Colors.red;
      case SyncStatus.completed:
        return Colors.green;
      case SyncStatus.idle:
        return Colors.grey;
    }
  }

  String _getStatusText(SyncStatus status, int count) {
    switch (status) {
      case SyncStatus.syncing:
        return 'Syncing $count...';
      case SyncStatus.error:
        return '$count pending';
      case SyncStatus.completed:
        return 'Synced';
      case SyncStatus.idle:
        return count > 0 ? '$count pending' : '';
    }
  }
}
