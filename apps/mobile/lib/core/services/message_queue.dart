import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/messages/domain/models/message.dart';

/// Queued message entry
class QueuedMessage {
  final Message message;
  final DateTime queuedAt;
  final int attemptCount;

  const QueuedMessage({
    required this.message,
    required this.queuedAt,
    this.attemptCount = 0,
  });

  QueuedMessage copyWith({
    Message? message,
    DateTime? queuedAt,
    int? attemptCount,
  }) {
    return QueuedMessage(
      message: message ?? this.message,
      queuedAt: queuedAt ?? this.queuedAt,
      attemptCount: attemptCount ?? this.attemptCount,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'message': message.toJson(),
      'queuedAt': queuedAt.toIso8601String(),
      'attemptCount': attemptCount,
    };
  }

  factory QueuedMessage.fromJson(Map<String, dynamic> json) {
    return QueuedMessage(
      message: Message.fromJson(json['message'] as Map<String, dynamic>),
      queuedAt: DateTime.parse(json['queuedAt'] as String),
      attemptCount: json['attemptCount'] as int? ?? 0,
    );
  }
}

/// Callback for sending a message
typedef MessageSender = Future<Message?> Function(Message message);

/// Offline message queue for handling messages when offline
class MessageQueue {
  static const String _storageKey = 'offline_message_queue';
  static const int _maxRetries = 3;
  static const Duration _retryDelay = Duration(seconds: 2);
  static const Duration _staleMessageThreshold = Duration(hours: 24);

  final List<QueuedMessage> _queue = [];
  final StreamController<QueuedMessage> _queueUpdateController =
      StreamController<QueuedMessage>.broadcast();

  SharedPreferences? _prefs;
  bool _isProcessing = false;
  bool _isOnline = true;

  /// Stream of queue updates
  Stream<QueuedMessage> get queueUpdates => _queueUpdateController.stream;

  /// Get all queued messages
  List<QueuedMessage> get pendingMessages => List.unmodifiable(_queue);

  /// Get queued messages for a specific conversation
  List<QueuedMessage> getQueuedForConversation(String conversationId) {
    return _queue
        .where((q) => q.message.conversationId == conversationId)
        .toList();
  }

  /// Initialize the queue from storage
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    await _loadFromStorage();
    _cleanupStaleMessages();
  }

  /// Update online status
  void setOnlineStatus(bool isOnline) {
    final wasOffline = !_isOnline;
    _isOnline = isOnline;

    // If we just came back online, start processing the queue
    if (isOnline && wasOffline && _queue.isNotEmpty) {
      debugPrint(
          '[MessageQueue] Back online, processing ${_queue.length} queued messages');
    }
  }

  /// Add a message to the queue
  Future<void> enqueue(Message message) async {
    final queuedMessage = QueuedMessage(
      message: message.copyWith(status: MessageStatus.pending),
      queuedAt: DateTime.now(),
    );

    _queue.add(queuedMessage);
    await _saveToStorage();
    _queueUpdateController.add(queuedMessage);

    debugPrint('[MessageQueue] Enqueued message: ${message.localId}');
  }

  /// Process the queue with a sender function
  Future<void> processQueue(MessageSender sender) async {
    if (_isProcessing || _queue.isEmpty || !_isOnline) {
      return;
    }

    _isProcessing = true;

    try {
      // Process messages in order
      final messagesToProcess = List<QueuedMessage>.from(_queue);

      for (final queued in messagesToProcess) {
        if (!_isOnline) break;

        final success = await _processMessage(queued, sender);

        if (success) {
          _queue.remove(queued);
        } else if (queued.attemptCount >= _maxRetries) {
          // Mark as failed and keep in queue for manual retry
          final failedQueued = queued.copyWith(
            message: queued.message.copyWith(
              status: MessageStatus.failed,
              errorMessage: 'Failed after $_maxRetries attempts',
            ),
            attemptCount: queued.attemptCount,
          );

          final index = _queue.indexOf(queued);
          if (index != -1) {
            _queue[index] = failedQueued;
          }
          _queueUpdateController.add(failedQueued);
        } else {
          // Increment attempt count
          final retryQueued = queued.copyWith(
            attemptCount: queued.attemptCount + 1,
          );

          final index = _queue.indexOf(queued);
          if (index != -1) {
            _queue[index] = retryQueued;
          }

          // Wait before next retry
          await Future.delayed(_retryDelay * (queued.attemptCount + 1));
        }
      }

      await _saveToStorage();
    } finally {
      _isProcessing = false;
    }
  }

  Future<bool> _processMessage(
    QueuedMessage queued,
    MessageSender sender,
  ) async {
    try {
      // Update status to sending
      final sendingMessage = queued.message.copyWith(
        status: MessageStatus.sending,
      );
      _queueUpdateController.add(queued.copyWith(message: sendingMessage));

      // Try to send
      final result = await sender(queued.message);
      return result != null;
    } catch (e) {
      debugPrint('[MessageQueue] Failed to send message: $e');
      return false;
    }
  }

  /// Retry a specific failed message
  Future<bool> retryMessage(String localId, MessageSender sender) async {
    final index = _queue.indexWhere((q) => q.message.localId == localId);
    if (index == -1) return false;

    final queued = _queue[index];
    if (queued.message.status != MessageStatus.failed) return false;

    // Reset for retry
    final retryQueued = queued.copyWith(
      message: queued.message.copyWith(
        status: MessageStatus.pending,
        retryCount: queued.message.retryCount + 1,
        errorMessage: null,
      ),
      attemptCount: 0,
    );

    _queue[index] = retryQueued;
    _queueUpdateController.add(retryQueued);

    // Process this message
    final success = await _processMessage(retryQueued, sender);

    if (success) {
      _queue.removeAt(index);
    } else {
      _queue[index] = retryQueued.copyWith(
        message: retryQueued.message.copyWith(
          status: MessageStatus.failed,
          errorMessage: 'Retry failed',
        ),
      );
      _queueUpdateController.add(_queue[index]);
    }

    await _saveToStorage();
    return success;
  }

  /// Remove a message from the queue (e.g., when user deletes it)
  Future<void> removeFromQueue(String localId) async {
    _queue.removeWhere((q) => q.message.localId == localId);
    await _saveToStorage();
    debugPrint('[MessageQueue] Removed message: $localId');
  }

  /// Mark a message as sent (called when server confirms receipt)
  Future<void> markAsSent(String localId) async {
    final index = _queue.indexWhere((q) => q.message.localId == localId);
    if (index != -1) {
      _queue.removeAt(index);
      await _saveToStorage();
      debugPrint('[MessageQueue] Marked as sent and removed: $localId');
    }
  }

  /// Clean up stale messages (older than threshold)
  void _cleanupStaleMessages() {
    final now = DateTime.now();
    _queue.removeWhere((q) {
      final age = now.difference(q.queuedAt);
      return age > _staleMessageThreshold;
    });
  }

  Future<void> _loadFromStorage() async {
    try {
      final jsonString = _prefs?.getString(_storageKey);
      if (jsonString != null) {
        final jsonList = jsonDecode(jsonString) as List;
        _queue.clear();
        _queue.addAll(
          jsonList
              .map((j) => QueuedMessage.fromJson(j as Map<String, dynamic>))
              .toList(),
        );
        debugPrint(
            '[MessageQueue] Loaded ${_queue.length} messages from storage');
      }
    } catch (e) {
      debugPrint('[MessageQueue] Error loading from storage: $e');
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final jsonList = _queue.map((q) => q.toJson()).toList();
      await _prefs?.setString(_storageKey, jsonEncode(jsonList));
    } catch (e) {
      debugPrint('[MessageQueue] Error saving to storage: $e');
    }
  }

  /// Clear all queued messages
  Future<void> clear() async {
    _queue.clear();
    await _prefs?.remove(_storageKey);
    debugPrint('[MessageQueue] Queue cleared');
  }

  /// Dispose resources
  void dispose() {
    _queueUpdateController.close();
  }
}
