import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:skillancer_mobile/core/network/api_client.dart';
import 'package:skillancer_mobile/core/storage/secure_storage.dart';

// Mock classes using mocktail
class MockSecureStorage extends Mock implements SecureStorage {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockSecureStorage mockSecureStorage;

  setUp(() {
    mockSecureStorage = MockSecureStorage();
  });

  group('ApiClient', () {
    test('should be instantiable with default parameters', () {
      final apiClient = ApiClient();
      expect(apiClient, isNotNull);
      expect(apiClient.baseUrl, ApiClient.defaultBaseUrl);
    });

    test('should accept custom baseUrl', () {
      final apiClient = ApiClient(baseUrl: 'https://custom.api.com');
      expect(apiClient.baseUrl, 'https://custom.api.com');
    });

    test('should accept custom secureStorage', () {
      final apiClient = ApiClient(secureStorage: mockSecureStorage);
      expect(apiClient, isNotNull);
    });

    test('should accept custom timeout', () {
      final apiClient = ApiClient(timeout: const Duration(seconds: 60));
      expect(apiClient, isNotNull);
    });

    test('should accept maxRetries parameter', () {
      final apiClient = ApiClient(maxRetries: 5);
      expect(apiClient, isNotNull);
    });

    test('should accept enableTokenRefresh parameter', () {
      final apiClient = ApiClient(enableTokenRefresh: false);
      expect(apiClient, isNotNull);
    });

    test('should accept all custom parameters', () {
      final apiClient = ApiClient(
        baseUrl: 'https://custom.api.com',
        timeout: const Duration(seconds: 60),
        secureStorage: mockSecureStorage,
        maxRetries: 5,
        enableTokenRefresh: false,
      );
      expect(apiClient, isNotNull);
      expect(apiClient.baseUrl, 'https://custom.api.com');
    });
  });

  group('ApiError', () {
    test('should create ApiError with required fields', () {
      final error = ApiError(
        code: 'TEST_ERROR',
        message: 'Test error message',
      );

      expect(error.code, 'TEST_ERROR');
      expect(error.message, 'Test error message');
      expect(error.statusCode, isNull);
      expect(error.details, isNull);
    });

    test('should create ApiError with all fields', () {
      final error = ApiError(
        code: 'HTTP_400',
        message: 'Bad request',
        statusCode: 400,
        details: {'field': 'email', 'error': 'Invalid format'},
      );

      expect(error.code, 'HTTP_400');
      expect(error.message, 'Bad request');
      expect(error.statusCode, 400);
      expect(error.details, isNotNull);
    });

    test('isNetworkError should return true for network errors', () {
      final timeoutError = ApiError(
        code: 'TIMEOUT',
        message: 'Connection timed out',
      );
      final connectionError = ApiError(
        code: 'NO_CONNECTION',
        message: 'No internet connection',
      );

      expect(timeoutError.isNetworkError, isTrue);
      expect(connectionError.isNetworkError, isTrue);
    });

    test('isNetworkError should return false for other errors', () {
      final httpError = ApiError(
        code: 'HTTP_500',
        message: 'Server error',
        statusCode: 500,
      );

      expect(httpError.isNetworkError, isFalse);
    });

    test('isAuthError should return true for 401 and 403', () {
      final unauthorizedError = ApiError(
        code: 'HTTP_401',
        message: 'Unauthorized',
        statusCode: 401,
      );
      final forbiddenError = ApiError(
        code: 'HTTP_403',
        message: 'Forbidden',
        statusCode: 403,
      );

      expect(unauthorizedError.isAuthError, isTrue);
      expect(forbiddenError.isAuthError, isTrue);
    });

    test('isAuthError should return false for other status codes', () {
      final badRequestError = ApiError(
        code: 'HTTP_400',
        message: 'Bad request',
        statusCode: 400,
      );

      expect(badRequestError.isAuthError, isFalse);
    });

    test('isServerError should return true for 5xx status codes', () {
      final serverError = ApiError(
        code: 'HTTP_500',
        message: 'Internal server error',
        statusCode: 500,
      );
      final badGatewayError = ApiError(
        code: 'HTTP_502',
        message: 'Bad gateway',
        statusCode: 502,
      );

      expect(serverError.isServerError, isTrue);
      expect(badGatewayError.isServerError, isTrue);
    });

    test('isServerError should return false for non-5xx status codes', () {
      final clientError = ApiError(
        code: 'HTTP_400',
        message: 'Bad request',
        statusCode: 400,
      );

      expect(clientError.isServerError, isFalse);
    });

    test('toString should format error correctly', () {
      final error = ApiError(
        code: 'TEST_ERROR',
        message: 'Test message',
      );

      expect(error.toString(), 'ApiError(TEST_ERROR): Test message');
    });
  });
}
