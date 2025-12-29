import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

/// Push notification service
class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

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

    // Get FCM token
    final token = await _messaging.getToken();
    if (kDebugMode) {
      print('FCM Token: $token');
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

  void _onTokenRefresh(String token) {
    // TODO: Send token to backend
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
}

/// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    print('Background message: ${message.notification?.title}');
  }
}
