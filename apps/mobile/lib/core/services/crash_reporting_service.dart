import 'dart:async';
import 'dart:isolate';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Service for handling crash reporting and error tracking
/// Uses Firebase Crashlytics for production crash reporting
class CrashReportingService {
  CrashReportingService._();

  static FirebaseCrashlytics get _crashlytics => FirebaseCrashlytics.instance;

  /// Initialize crash reporting
  /// Call this after Firebase.initializeApp()
  static Future<void> initialize() async {
    if (kDebugMode) {
      // Disable Crashlytics collection in debug mode
      await _crashlytics.setCrashlyticsCollectionEnabled(false);
      debugPrint('[CrashReporting] Disabled in debug mode');
      return;
    }

    // Enable Crashlytics collection in release mode
    await _crashlytics.setCrashlyticsCollectionEnabled(true);

    // Pass all uncaught Flutter errors to Crashlytics
    FlutterError.onError = (errorDetails) {
      _crashlytics.recordFlutterFatalError(errorDetails);
    };

    // Pass all uncaught asynchronous errors to Crashlytics
    PlatformDispatcher.instance.onError = (error, stack) {
      _crashlytics.recordError(error, stack, fatal: true);
      return true;
    };

    // Catch errors from isolates
    Isolate.current.addErrorListener(RawReceivePort((pair) async {
      final List<dynamic> errorAndStacktrace = pair;
      await _crashlytics.recordError(
        errorAndStacktrace.first,
        errorAndStacktrace.last,
        fatal: true,
      );
    }).sendPort);
  }

  /// Record a Flutter error
  static void recordFlutterError(FlutterErrorDetails details) {
    if (kDebugMode) {
      debugPrint('Flutter Error: ${details.exception}');
      debugPrint('Stack trace:\n${details.stack}');
      return;
    }

    _crashlytics.recordFlutterError(details);
  }

  /// Record a Flutter fatal error (causes a crash report)
  static void recordFlutterFatalError(FlutterErrorDetails details) {
    if (kDebugMode) {
      debugPrint('Flutter Fatal Error: ${details.exception}');
      debugPrint('Stack trace:\n${details.stack}');
      return;
    }

    _crashlytics.recordFlutterFatalError(details);
  }

  /// Record a general error
  static Future<void> recordError(
    dynamic exception,
    StackTrace? stack, {
    String? reason,
    bool fatal = false,
    Iterable<Object> information = const [],
  }) async {
    if (kDebugMode) {
      debugPrint('Error: $exception');
      if (reason != null) {
        debugPrint('Reason: $reason');
      }
      if (stack != null) {
        debugPrint('Stack trace:\n$stack');
      }
      return;
    }

    await _crashlytics.recordError(
      exception,
      stack,
      reason: reason,
      fatal: fatal,
      information: information,
    );
  }

  /// Set user identifier for crash reports
  static Future<void> setUserId(String userId) async {
    if (kDebugMode) {
      debugPrint('[CrashReporting] Set user ID: $userId');
      return;
    }

    await _crashlytics.setUserIdentifier(userId);
  }

  /// Clear user identifier (e.g., on logout)
  static Future<void> clearUserId() async {
    if (kDebugMode) {
      debugPrint('[CrashReporting] Cleared user ID');
      return;
    }

    await _crashlytics.setUserIdentifier('');
  }

  /// Log a message (will appear in crash reports)
  static void log(String message) {
    if (kDebugMode) {
      debugPrint('[CrashReporting] $message');
      return;
    }

    _crashlytics.log(message);
  }

  /// Set a custom key-value pair for crash reports
  static Future<void> setCustomKey(String key, Object value) async {
    if (kDebugMode) {
      debugPrint('[CrashReporting] Set custom key: $key = $value');
      return;
    }

    await _crashlytics.setCustomKey(key, value);
  }

  /// Set multiple custom keys at once
  static Future<void> setCustomKeys(Map<String, Object> keysAndValues) async {
    if (kDebugMode) {
      debugPrint('[CrashReporting] Set custom keys: $keysAndValues');
      return;
    }

    for (final entry in keysAndValues.entries) {
      await _crashlytics.setCustomKey(entry.key, entry.value);
    }
  }

  /// Force a test crash (for testing Crashlytics integration)
  /// DO NOT use in production!
  static void testCrash() {
    if (kDebugMode) {
      debugPrint('[CrashReporting] Test crash triggered (ignored in debug)');
      return;
    }

    _crashlytics.crash();
  }

  /// Check if crash collection is enabled
  static Future<bool> isCrashlyticsCollectionEnabled() async {
    return _crashlytics.isCrashlyticsCollectionEnabled;
  }

  /// Check if there are unsent crash reports
  static Future<bool> checkForUnsentReports() async {
    return await _crashlytics.checkForUnsentReports();
  }

  /// Send any unsent crash reports
  static Future<void> sendUnsentReports() async {
    await _crashlytics.sendUnsentReports();
  }

  /// Delete any unsent crash reports
  static Future<void> deleteUnsentReports() async {
    await _crashlytics.deleteUnsentReports();
  }
}
