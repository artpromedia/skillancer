import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../../../core/network/api_client.dart';

/// Push notification service
class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final ApiClient _apiClient;

  PushNotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  Future<void> initialize() async {
    // Request permission
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (kDebugMode) {
      print('Push notification permission: ${settings.authorizationStatus}');
    }

    // Get FCM token and send to backend
    final token = await _messaging.getToken();
    if (token != null) {
      await _registerDeviceToken(token);
    }

    // Handle token refresh
    _messaging.onTokenRefresh.listen(_onTokenRefresh);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    // Handle background message tap
    FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpenedApp);

    // Check for initial message (app opened from terminated state)
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessage(initialMessage);
    }
  }

  Future<void> _registerDeviceToken(String token) async {
    final deviceId = await _getDeviceId();
    try {
      await _apiClient.post('/notifications/devices', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'deviceId': deviceId,
      });
      if (kDebugMode) {
        print('FCM Token registered with backend');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to register FCM token: $e');
      }
      // Queue for later if offline
      _apiClient.queueOfflineRequest('POST', '/notifications/devices', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'deviceId': deviceId,
      });
    }
  }

  Future<String> _getDeviceId() async {
    // Use a unique identifier for the device
    // In production, use device_info_plus package for more reliable ID
    return '${Platform.operatingSystem}_${Platform.localHostname}';
  }

  void _onTokenRefresh(String token) {
    // Send refreshed token to backend
    _registerDeviceToken(token);
    if (kDebugMode) {
      print('FCM Token refreshed: $token');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    if (kDebugMode) {
      print('Foreground message: ${message.notification?.title}');
    }

    // TODO: Show local notification or in-app alert
  }

  void _onMessageOpenedApp(RemoteMessage message) {
    _handleMessage(message);
  }

  void _handleMessage(RemoteMessage message) {
    final data = message.data;
    final type = data['type'] as String?;
    final id = data['id'] as String?;

    if (kDebugMode) {
      print('Handle message: type=$type, id=$id');
    }

    // TODO: Navigate based on notification type
    // This would typically call a navigation service
  }

  Future<String?> getToken() async {
    return _messaging.getToken();
  }

  Future<void> subscribeToTopic(String topic) async {
    await _messaging.subscribeToTopic(topic);
  }

  Future<void> unsubscribeFromTopic(String topic) async {
    await _messaging.unsubscribeFromTopic(topic);
  }

  /// Unregister device token when user logs out
  Future<void> unregisterDeviceToken() async {
    try {
      final deviceId = await _getDeviceId();
      await _apiClient.delete('/notifications/devices/$deviceId');
      if (kDebugMode) {
        print('FCM Token unregistered from backend');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to unregister FCM token: $e');
      }
    }
  }
}

/// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    print('Background message: ${message.notification?.title}');
  }
}
