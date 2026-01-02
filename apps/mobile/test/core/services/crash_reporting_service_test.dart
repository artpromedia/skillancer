import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skillancer_mobile/core/services/crash_reporting_service.dart';

void main() {
  group('CrashReportingService', () {
    test('recordFlutterError handles errors in debug mode', () {
      // In test environment (which is debug mode), this should just print
      final details = FlutterErrorDetails(
        exception: Exception('Test error'),
        stack: StackTrace.current,
        library: 'test',
        context: ErrorDescription('Testing error handling'),
      );

      // Should not throw
      expect(
        () => CrashReportingService.recordFlutterError(details),
        returnsNormally,
      );
    });

    test('recordError handles errors in debug mode', () {
      final error = Exception('Test error');
      final stackTrace = StackTrace.current;

      // Should not throw
      expect(
        () => CrashReportingService.recordError(error, stackTrace),
        returnsNormally,
      );
    });

    test('recordError handles null stack trace', () {
      final error = Exception('Test error without stack trace');

      expect(
        () => CrashReportingService.recordError(error, null),
        returnsNormally,
      );
    });

    test('setUserId does not throw', () {
      expect(
        () => CrashReportingService.setUserId('test-user-123'),
        returnsNormally,
      );
    });

    test('log does not throw', () {
      expect(
        () => CrashReportingService.log('Test log message'),
        returnsNormally,
      );
    });

    test('setCustomKey does not throw', () {
      expect(
        () => CrashReportingService.setCustomKey('test_key', 'test_value'),
        returnsNormally,
      );
    });
  });
}
