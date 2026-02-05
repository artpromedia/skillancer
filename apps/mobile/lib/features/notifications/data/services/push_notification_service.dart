import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../../../core/network/api_client.dart';

/// Callback type for handling notification-based navigation.
///
/// The service doesn't have direct access to GoRouter, so consumers
/// register a navigation callback (typically wired to GoRouter.go)
/// during app initialization.
typedef NotificationNavigationCallback = void Function(String route);

/// Push notification service
class PushNotificationService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final ApiClient _apiClient;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  /// Navigation callback set by the app layer to handle deep-link routing
  /// from notification taps.
  static NotificationNavigationCallback? onNavigate;

  /// Android notification channel used for foreground notifications.
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'skillancer_notifications',
    'Skillancer Notifications',
    description: 'Notifications from Skillancer',
    importance: Importance.high,
  );

  PushNotificationService({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  Future<void> initialize() async {
    // ── Initialise flutter_local_notifications ──────────────────────────
    await _initLocalNotifications();

    // ── Request FCM permission ──────────────────────────────────────────
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

  /// Configures the local notifications plugin for Android & iOS and creates
  /// the Android notification channel used by foreground messages.
  Future<void> _initLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );

    const darwinSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: darwinSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Create the Android notification channel.
    // On Android 8.0+ this is required for heads-up / high-importance
    // notifications to appear.
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);
  }

  /// Called when the user taps a local notification shown while the app was
  /// in the foreground.
  void _onNotificationTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) {
      _navigateTo(payload);
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

    final notification = message.notification;
    if (notification == null) return;

    // Build the route payload so tapping the local notification navigates
    // to the correct screen.
    final route = _routeForMessage(message);

    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: route,
    );
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

    final route = _routeForMessage(message);
    _navigateTo(route);
  }

  /// Determines the appropriate route path for a given [RemoteMessage] based
  /// on its `type` and entity `id` fields in `data`.
  String _routeForMessage(RemoteMessage message) {
    final data = message.data;
    final type = data['type'] as String?;

    switch (type) {
      case 'message':
        final conversationId = data['conversationId'] as String? ?? data['id'] as String?;
        return conversationId != null
            ? '/messages/$conversationId'
            : '/notifications';
      case 'proposal':
        final proposalId = data['proposalId'] as String? ?? data['id'] as String?;
        return proposalId != null
            ? '/proposals/$proposalId'
            : '/notifications';
      case 'contract':
        final contractId = data['contractId'] as String? ?? data['id'] as String?;
        return contractId != null
            ? '/contracts/$contractId'
            : '/notifications';
      case 'job':
        final jobId = data['jobId'] as String? ?? data['id'] as String?;
        return jobId != null ? '/jobs/$jobId' : '/notifications';
      case 'payment':
        final contractId = data['contractId'] as String? ?? data['id'] as String?;
        return contractId != null
            ? '/contracts/$contractId'
            : '/notifications';
      default:
        return '/notifications';
    }
  }

  /// Invokes the registered [onNavigate] callback to push the given route.
  void _navigateTo(String route) {
    if (onNavigate != null) {
      onNavigate!(route);
    } else if (kDebugMode) {
      print(
        'PushNotificationService: no navigation callback registered. '
        'Attempted to navigate to $route',
      );
    }
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
