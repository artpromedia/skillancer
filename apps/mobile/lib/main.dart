import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/connectivity/connectivity_service.dart';
import 'core/network/api_client.dart';
import 'core/services/crash_reporting_service.dart';
import 'core/services/offline_sync_manager.dart';
import 'core/storage/local_cache.dart';
import 'features/notifications/data/services/push_notification_service.dart';

/// Global container reference for accessing providers before runApp
late ProviderContainer _container;

/// Main entry point for the Skillancer mobile app
void main() async {
  // Run the app in a zone to catch all errors
  runZonedGuarded<Future<void>>(
    () async {
      // Ensure Flutter binding is initialized
      WidgetsFlutterBinding.ensureInitialized();

      // Set preferred orientations
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);

      // Set system UI overlay style
      SystemChrome.setSystemUIOverlayStyle(
        const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          systemNavigationBarColor: Colors.white,
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
      );

      try {
        // Initialize Firebase (required before Crashlytics)
        await Firebase.initializeApp();

        // Initialize Crashlytics (sets up error handlers)
        await CrashReportingService.initialize();

        // Initialize Hive for local storage
        await Hive.initFlutter();

        // Initialize local cache
        await LocalCache.initialize();

        // Initialize offline sync manager
        await _initializeOfflineSyncManager();

        // Initialize push notifications
        await PushNotificationService().initialize();
      } catch (e, stackTrace) {
        debugPrint('Initialization error: $e');
        await CrashReportingService.recordError(e, stackTrace, fatal: true);
      }

      // Create provider container with offline sync manager override
      _container = ProviderContainer();

      // Run the app with Riverpod
      runApp(
        UncontrolledProviderScope(
          container: _container,
          child: const SkillancerApp(),
        ),
      );
    },
    (error, stackTrace) async {
      // Catch any errors not caught by Flutter's error handlers
      debugPrint('Uncaught error: $error');
      await CrashReportingService.recordError(
        error,
        stackTrace,
        reason: 'Uncaught error in runZonedGuarded',
        fatal: true,
      );
    },
  );
}

/// Initialize the offline sync manager
Future<void> _initializeOfflineSyncManager() async {
  try {
    final connectivity = ConnectivityService();
    final apiClient = ApiClient();

    final syncManager = OfflineSyncManager(
      connectivity: connectivity,
      apiClient: apiClient,
    );

    await syncManager.initialize();

    debugPrint('[App] OfflineSyncManager initialized successfully');
    debugPrint(
        '[App] Pending operations: ${syncManager.pendingOperationsCount}');

    if (syncManager.lastSyncTime != null) {
      debugPrint('[App] Last sync: ${syncManager.lastSyncTime}');
    }
  } catch (e, stackTrace) {
    debugPrint('[App] Failed to initialize OfflineSyncManager: $e');
    await CrashReportingService.recordError(
      e,
      stackTrace,
      reason: 'OfflineSyncManager initialization failed',
      fatal: false,
    );
    // Don't rethrow - app can still work without offline sync
  }
}
