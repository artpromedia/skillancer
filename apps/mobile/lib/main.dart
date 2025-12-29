import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/services/crash_reporting_service.dart';
import 'core/storage/local_cache.dart';
import 'features/notifications/data/services/push_notification_service.dart';

/// Main entry point for the Skillancer mobile app
void main() async {
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

  // Initialize error handling
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    CrashReportingService.recordFlutterError(details);
  };

  try {
    // Initialize Firebase
    await Firebase.initializeApp();

    // Initialize Hive for local storage
    await Hive.initFlutter();

    // Initialize local cache
    await LocalCache.initialize();

    // Initialize push notifications
    await PushNotificationService.initialize();
  } catch (e, stackTrace) {
    debugPrint('Initialization error: $e');
    CrashReportingService.recordError(e, stackTrace);
  }

  // Run the app with Riverpod
  runApp(
    const ProviderScope(
      child: SkillancerApp(),
    ),
  );
}
