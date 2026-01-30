import '../../../../core/network/api_client.dart';
import '../../domain/models/notification.dart';

/// Notifications repository for fetching and managing notifications
class NotificationsRepository {
  final ApiClient _apiClient;

  NotificationsRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  /// Get user's notifications with pagination
  Future<NotificationsResult> getNotifications({
    int limit = 20,
    int offset = 0,
    String? channel,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'limit': limit,
        'offset': offset,
      };
      if (channel != null) queryParams['channel'] = channel;
      if (status != null) queryParams['status'] = status;

      final response = await _apiClient.get(
        '/notifications/history',
        queryParameters: queryParams,
      );

      final data = response.data as Map<String, dynamic>;
      final notificationsList =
          data['data'] as List? ?? data['notifications'] as List? ?? [];
      final notifications = notificationsList
          .map((n) => _mapToNotification(n as Map<String, dynamic>))
          .toList();

      final total = data['total'] as int? ?? notifications.length;
      final hasMore = offset + notifications.length < total;

      return NotificationsResult(
        notifications: notifications,
        total: total,
        hasMore: hasMore,
      );
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch notifications');
    }
  }

  /// Get unread notifications count
  Future<int> getUnreadCount() async {
    try {
      final response = await _apiClient.get('/notifications/stats');
      final data = response.data as Map<String, dynamic>;
      // Try different possible field names
      return data['unreadCount'] as int? ??
          data['pending'] as int? ??
          (data['data'] as Map<String, dynamic>?)?['unreadCount'] as int? ??
          0;
    } on ApiError {
      return 0;
    } catch (e) {
      return 0;
    }
  }

  /// Mark a notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      await _apiClient.post('/notifications/$notificationId/read');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(code: 'UPDATE_ERROR', message: 'Failed to mark as read');
    }
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead() async {
    try {
      await _apiClient.post('/notifications/read-all');
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'UPDATE_ERROR', message: 'Failed to mark all as read');
    }
  }

  /// Register device token for push notifications
  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    required String deviceId,
  }) async {
    try {
      await _apiClient.post('/notifications/devices', data: {
        'token': token,
        'platform': platform,
        'deviceId': deviceId,
      });
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'REGISTER_ERROR', message: 'Failed to register device');
    }
  }

  /// Unregister device token
  Future<void> unregisterDeviceToken(String deviceId) async {
    try {
      await _apiClient.delete('/notifications/devices/$deviceId');
    } on ApiError {
      // Ignore errors on unregister
    } catch (e) {
      // Ignore errors on unregister
    }
  }

  /// Get notification preferences
  Future<NotificationPreferences> getPreferences() async {
    try {
      final response = await _apiClient.get('/notifications/preferences');
      final data = response.data as Map<String, dynamic>;
      return NotificationPreferences.fromJson(
          data['data'] as Map<String, dynamic>? ?? data);
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'FETCH_ERROR', message: 'Failed to fetch preferences');
    }
  }

  /// Update notification preferences
  Future<void> updatePreferences(NotificationPreferences preferences) async {
    try {
      await _apiClient.put('/notifications/preferences',
          data: preferences.toJson());
    } on ApiError {
      rethrow;
    } catch (e) {
      throw ApiError(
          code: 'UPDATE_ERROR', message: 'Failed to update preferences');
    }
  }

  /// Map backend notification to AppNotification model
  AppNotification _mapToNotification(Map<String, dynamic> json) {
    // Handle different possible field names from backend
    final typeStr = json['type'] as String? ??
        json['category'] as String? ??
        json['notificationType'] as String? ??
        'general';

    final type = NotificationType.values.firstWhere(
      (t) => t.name.toLowerCase() == typeStr.toLowerCase(),
      orElse: () => NotificationType.general,
    );

    return AppNotification(
      id: json['id'] as String,
      type: type,
      title: json['title'] as String? ?? json['subject'] as String? ?? '',
      body: json['body'] as String? ?? json['content'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.tryParse(json['sentAt'] as String? ?? '') ??
          DateTime.now(),
      isRead: json['isRead'] as bool? ??
          json['read'] as bool? ??
          ((json['status'] as String?)?.toLowerCase() == 'read'),
      actionUrl: json['actionUrl'] as String? ?? json['deepLink'] as String?,
      data: json['data'] as Map<String, dynamic>? ??
          json['metadata'] as Map<String, dynamic>?,
    );
  }
}

/// Result wrapper for notifications
class NotificationsResult {
  final List<AppNotification> notifications;
  final int total;
  final bool hasMore;

  const NotificationsResult({
    required this.notifications,
    required this.total,
    required this.hasMore,
  });
}

/// Notification preferences model
class NotificationPreferences {
  final bool emailEnabled;
  final bool pushEnabled;
  final bool smsEnabled;
  final bool jobAlerts;
  final bool messageAlerts;
  final bool paymentAlerts;
  final bool marketingEmails;

  const NotificationPreferences({
    this.emailEnabled = true,
    this.pushEnabled = true,
    this.smsEnabled = false,
    this.jobAlerts = true,
    this.messageAlerts = true,
    this.paymentAlerts = true,
    this.marketingEmails = false,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) {
    return NotificationPreferences(
      emailEnabled: json['emailEnabled'] as bool? ?? true,
      pushEnabled: json['pushEnabled'] as bool? ?? true,
      smsEnabled: json['smsEnabled'] as bool? ?? false,
      jobAlerts: json['jobAlerts'] as bool? ?? true,
      messageAlerts: json['messageAlerts'] as bool? ?? true,
      paymentAlerts: json['paymentAlerts'] as bool? ?? true,
      marketingEmails: json['marketingEmails'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'emailEnabled': emailEnabled,
      'pushEnabled': pushEnabled,
      'smsEnabled': smsEnabled,
      'jobAlerts': jobAlerts,
      'messageAlerts': messageAlerts,
      'paymentAlerts': paymentAlerts,
      'marketingEmails': marketingEmails,
    };
  }

  NotificationPreferences copyWith({
    bool? emailEnabled,
    bool? pushEnabled,
    bool? smsEnabled,
    bool? jobAlerts,
    bool? messageAlerts,
    bool? paymentAlerts,
    bool? marketingEmails,
  }) {
    return NotificationPreferences(
      emailEnabled: emailEnabled ?? this.emailEnabled,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      jobAlerts: jobAlerts ?? this.jobAlerts,
      messageAlerts: messageAlerts ?? this.messageAlerts,
      paymentAlerts: paymentAlerts ?? this.paymentAlerts,
      marketingEmails: marketingEmails ?? this.marketingEmails,
    );
  }
}
